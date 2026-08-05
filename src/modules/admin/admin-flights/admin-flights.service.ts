import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { BookingStatus, EnumTransport, FlightStatus } from '@prisma/client';
import { PrismaService } from 'src/infra/db/prisma/prisma.service';
import { computeSeatPriceInCurrency } from 'src/shared/pricing/seat-fee.catalog';
import { UpdateFlightStatusDto, FlightStatusUpdate } from './dtos/update-flight-status.dto';
import { CreateFlightInstanceDto } from './dtos/create-flight-instance.dto';
import { GetFlightsQueryDto } from './dtos/get-flights.dto';
import { Logger } from 'nestjs-pino';
import {
  adminFlightFullInclude,
  mapAdminFlightToDto,
  type AdminFlightInstanceRecord,
} from './mappers/admin-flight.mapper';
import { FlightScheduleSyncService } from 'src/modules/flights/services/flight-schedule-sync.service';
import { OutboxService } from 'src/infra/outbox/outbox.service';
import {
  buildAdminFlightsStatsWhere,
  buildAdminFlightsWhere,
} from './utils/admin-flights-query.util';
import {
  airlineSupportsFirstClass,
  buildFlightFaresFromAdultPrices,
} from 'src/modules/flights/utils/offer/flight-fare-builder.util';
import { resolveAirportTimezone } from 'src/modules/flights/utils/datetime/airport-timezone.util';
import { zonedTimeToUtc } from 'src/shared/datetime/timezone-date.util';

const NOTIFIABLE_BOOKING_STATUSES: BookingStatus[] = [
  BookingStatus.PNR_CREATED,
  BookingStatus.SEATS_SELECTED,
  BookingStatus.PAYMENT_PENDING,
  BookingStatus.PAID,
  BookingStatus.TICKETING,
  BookingStatus.TICKETED,
];

@Injectable()
export class FlightsService {
  constructor(
    private prisma: PrismaService,
    private readonly logger: Logger,
    private readonly outbox: OutboxService,
    private readonly scheduleSync: FlightScheduleSyncService,
  ) {}

  async getFlights(query: GetFlightsQueryDto) {
    await this.autoCompletePastFlights();

    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const where = buildAdminFlightsWhere(query);
    const statsWhere = buildAdminFlightsStatsWhere();

    const [instances, total, statsInstances] = await this.prisma.$transaction([
      this.prisma.flightInstance.findMany({
        where,
        include: adminFlightFullInclude,
        orderBy: { departureDate: 'asc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.flightInstance.count({ where }),
      this.prisma.flightInstance.findMany({
        where: statsWhere,
        include: adminFlightFullInclude,
        take: 500,
      }),
    ]);

    return {
      data: instances.map(mapAdminFlightToDto),
      meta: {
        total,
        page,
        limit,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      },
      stats: this.computeStats(statsInstances),
    };
  }

  private computeStats(instances: AdminFlightInstanceRecord[]) {
    const statusCounts = {
      onTime: 0,
      delayed: 0,
      completed: 0,
      cancelled: 0,
    };

    let bookedSeats = 0;
    let totalSeats = 0;

    for (const instance of instances) {
      switch (instance.status) {
        case FlightStatus.SCHEDULED:
          statusCounts.onTime += 1;
          break;
        case FlightStatus.DELAYED:
          statusCounts.delayed += 1;
          break;
        case FlightStatus.COMPLETED:
          statusCounts.completed += 1;
          break;
        case FlightStatus.CANCELLED:
          statusCounts.cancelled += 1;
          break;
      }

      const seats = instance.aircraft?.aircraftLayout?.seats?.length ?? 0;
      totalSeats += seats;
      bookedSeats += Math.max(0, seats - (instance.seatsAvailable ?? 0));
    }

    return {
      total: instances.length,
      onTime: statusCounts.onTime,
      delayed: statusCounts.delayed,
      completed: statusCounts.completed,
      cancelled: statusCounts.cancelled,
      occupancy: totalSeats > 0 ? Math.round((bookedSeats / totalSeats) * 100) : 0,
    };
  }

  private async autoCompletePastFlights(): Promise<void> {
    const now = new Date();

    const candidates = await this.prisma.flightInstance.findMany({
      where: {
        status: { in: [FlightStatus.SCHEDULED, FlightStatus.DELAYED] },
        departureDate: { lt: now },
      },
      include: {
        flight: { select: { durationMinutes: true } },
      },
      take: 100,
    });

    const idsToComplete = candidates
      .filter((instance) => {
        const arrival = new Date(instance.departureDate);
        arrival.setMinutes(arrival.getMinutes() + (instance.flight?.durationMinutes ?? 0));
        return arrival <= now;
      })
      .map((instance) => instance.id);

    if (idsToComplete.length === 0) {
      return;
    }

    await this.prisma.flightInstance.updateMany({
      where: { id: { in: idsToComplete } },
      data: { status: FlightStatus.COMPLETED },
    });

    this.logger.log({ count: idsToComplete.length }, 'Auto-completed past flight instances');
  }

  async updateStatus(flightInstanceId: string, dto: UpdateFlightStatusDto) {
    const flight = await this.prisma.flightInstance.findUnique({
      where: { id: flightInstanceId },
      include: { bookings: true },
    });

    if (!flight) throw new NotFoundException('Flight instance not found');

    if (flight.status === 'COMPLETED' || flight.status === 'CANCELLED') {
      throw new BadRequestException('Flight already finished');
    }

    if (dto.status === FlightStatusUpdate.DELAYED) {
      if (!dto.delayMinutes || dto.delayMinutes <= 0) {
        throw new BadRequestException('Delay must be > 0');
      }

      const delay = dto.delayMinutes;

      const newDeparture = new Date(flight.departureDate);
      newDeparture.setMinutes(newDeparture.getMinutes() + delay);

      const notifiableBookings = flight.bookings.filter((booking) =>
        NOTIFIABLE_BOOKING_STATUSES.includes(booking.status),
      );

      const result = await this.prisma.$transaction(async (tx) => {
        const updated = await tx.flightInstance.update({
          where: { id: flightInstanceId },
          data: {
            status: 'DELAYED',
            delayMinutes: flight.delayMinutes + delay,
            departureDate: newDeparture,
            originalDepartureDate: flight.originalDepartureDate ?? flight.departureDate,
          },
          include: adminFlightFullInclude,
        });

        const occurredAt = new Date().toISOString();
        const totalDelayMinutes = flight.delayMinutes + delay;

        for (const booking of notifiableBookings) {
          await this.outbox.enqueue(tx, {
            aggregateId: booking.id,
            aggregateType: 'Booking',
            topic: 'flight.delayed',
            key: booking.id,
            payload: {
              bookingId: booking.id,
              userId: booking.userId,
              delayMinutes: totalDelayMinutes,
              newDeparture: newDeparture.toISOString(),
              occurredAt,
            },
            transport: EnumTransport.KAFKA,
          });
        }

        return updated;
      });

      await this.scheduleSync.onFlightInstanceUpdated(flightInstanceId);

      return mapAdminFlightToDto(result);
    }

    if (dto.status === FlightStatusUpdate.ON_TIME) {
      const updated = await this.prisma.flightInstance.update({
        where: { id: flightInstanceId },
        data: {
          status: 'SCHEDULED',
          delayMinutes: 0,
          departureDate: flight.originalDepartureDate || flight.departureDate,
        },
        include: adminFlightFullInclude,
      });

      await this.scheduleSync.onFlightInstanceUpdated(flightInstanceId);

      return mapAdminFlightToDto(updated);
    }

    if (dto.status === FlightStatusUpdate.CANCELLED) {
      const notifiableBookings = flight.bookings.filter((booking) =>
        NOTIFIABLE_BOOKING_STATUSES.includes(booking.status),
      );

      const result = await this.prisma.$transaction(async (tx) => {
        const updated = await tx.flightInstance.update({
          where: { id: flightInstanceId },
          data: { status: 'CANCELLED' },
          include: adminFlightFullInclude,
        });

        await tx.booking.updateMany({
          where: { flightInstanceId },
          data: { status: 'FAILED' },
        });

        const occurredAt = new Date().toISOString();

        for (const booking of notifiableBookings) {
          await this.outbox.enqueue(tx, {
            aggregateId: booking.id,
            aggregateType: 'Booking',
            topic: 'flight.cancelled',
            key: booking.id,
            payload: {
              bookingId: booking.id,
              userId: booking.userId,
              occurredAt,
            },
            transport: EnumTransport.KAFKA,
          });
        }

        return updated;
      });

      await this.scheduleSync.onFlightInstanceUpdated(flightInstanceId);

      return mapAdminFlightToDto(result);
    }

    if (dto.status === FlightStatusUpdate.COMPLETED) {
      const updated = await this.prisma.flightInstance.update({
        where: { id: flightInstanceId },
        data: { status: 'COMPLETED' },
        include: adminFlightFullInclude,
      });

      await this.scheduleSync.onFlightInstanceUpdated(flightInstanceId);

      return mapAdminFlightToDto(updated);
    }

    throw new BadRequestException('Unsupported status');
  }

  async getFlightTemplates(search?: string) {
    if (!search || search.trim().length < 2) {
      return [];
    }

    const flights = await this.prisma.flight.findMany({
      where: {
        OR: [
          {
            flightNumber: {
              contains: search,
              mode: 'insensitive',
            },
          },
          {
            airline: {
              name: {
                contains: search,
                mode: 'insensitive',
              },
            },
          },
          {
            departureAirport: {
              iataCode: {
                contains: search,
                mode: 'insensitive',
              },
            },
          },
          {
            arrivalAirport: {
              iataCode: {
                contains: search,
                mode: 'insensitive',
              },
            },
          },
        ],
      },
      include: {
        airline: true,
        departureAirport: true,
        arrivalAirport: true,
      },
      orderBy: {
        flightNumber: 'asc',
      },
      take: 15,
    });

    return flights.map((flight) => ({
      id: flight.id,
      flightNumber: flight.flightNumber,
      durationMinutes: flight.durationMinutes,
      airlineId: flight.airlineId,
      departureAirportId: flight.departureAirportId,
      arrivalAirportId: flight.arrivalAirportId,
      createdAt: flight.createdAt,
      supportsFirstClass: airlineSupportsFirstClass(flight.airline.code),
      airline: {
        id: flight.airline.id,
        name: flight.airline.name,
        code: flight.airline.code,
      },
      departureAirport: {
        id: flight.departureAirport.id,
        name: flight.departureAirport.name,
        iataCode: flight.departureAirport.iataCode,
        city: flight.departureAirport.city,
        timezone:
          flight.departureAirport.timezone ||
          resolveAirportTimezone(flight.departureAirport.iataCode),
      },
      arrivalAirport: {
        id: flight.arrivalAirport.id,
        name: flight.arrivalAirport.name,
        iataCode: flight.arrivalAirport.iataCode,
        city: flight.arrivalAirport.city,
        timezone:
          flight.arrivalAirport.timezone || resolveAirportTimezone(flight.arrivalAirport.iataCode),
      },
    }));
  }

  async create(dto: CreateFlightInstanceDto) {
    const flight = await this.prisma.flight.findUnique({
      where: {
        id: dto.flightId,
      },
      include: {
        airline: true,
        departureAirport: true,
      },
    });

    if (!flight) {
      throw new NotFoundException('Flight not found');
    }

    if (airlineSupportsFirstClass(flight.airline.code) && dto.fares.first == null) {
      throw new BadRequestException('First class adult price is required for this airline');
    }

    const aircraft = await this.prisma.aircraft.findUnique({
      where: {
        id: dto.aircraftId,
      },
      include: {
        aircraftLayout: {
          include: {
            seats: true,
          },
        },
      },
    });

    if (!aircraft) {
      throw new NotFoundException('Aircraft not found');
    }

    this.logger.debug({ aircraftId: aircraft.id, flightId: flight.id }, 'Creating flight instance');

    if (aircraft.airlineId !== flight.airlineId) {
      throw new BadRequestException('Aircraft does not belong to airline');
    }

    const seatsCount = aircraft.aircraftLayout?.seats.length ?? 0;

    if (!aircraft.aircraftLayout || seatsCount === 0) {
      throw new BadRequestException('Aircraft has no seat layout');
    }

    const [hoursRaw, minutesRaw] = dto.departureLocalTime.split(':');
    const hour = Number(hoursRaw);
    const minute = Number(minutesRaw);

    if (
      !Number.isInteger(hour) ||
      !Number.isInteger(minute) ||
      hour < 0 ||
      hour > 23 ||
      minute < 0 ||
      minute > 59
    ) {
      throw new BadRequestException('Invalid departureLocalTime');
    }

    const departureTimezone =
      flight.departureAirport.timezone || resolveAirportTimezone(flight.departureAirport.iataCode);

    const departureDate = zonedTimeToUtc(dto.departureLocalDate, departureTimezone, {
      hour,
      minute,
    });

    const instanceId = await this.prisma.$transaction(async (tx) => {
      const instance = await tx.flightInstance.create({
        data: {
          flightId: dto.flightId,
          aircraftId: dto.aircraftId,
          departureDate,
          seatsAvailable: seatsCount,
        },
      });

      await tx.flightFare.createMany({
        data: buildFlightFaresFromAdultPrices({
          instanceId: instance.id,
          currency: dto.currency,
          airlineCode: flight.airline.code,
          adultPrices: {
            economy: dto.fares.economy,
            premiumEconomy: dto.fares.premiumEconomy,
            business: dto.fares.business,
            first: dto.fares.first,
          },
        }),
      });

      await tx.flightSeat.createMany({
        data: aircraft.aircraftLayout!.seats.map((seat) => ({
          flightInstanceId: instance.id,
          seatNumber: seat.number,
          x: seat.x,
          y: seat.y,
          deck: seat.deck,
          seatType: seat.seatType,
          travelClass: seat.travelClass,
          isExitRow: seat.isExitRow,
          isExtraLegroom: seat.isExtraLegroom,
          isPremium: seat.isPremium,
          price: computeSeatPriceInCurrency(
            {
              seatType: seat.seatType,
              isExitRow: seat.isExitRow,
              isExtraLegroom: seat.isExtraLegroom,
              isPremium: seat.isPremium,
              travelClass: seat.travelClass,
            },
            dto.currency,
          ),
        })),
      });

      return instance.id;
    });

    const created = await this.prisma.flightInstance.findUniqueOrThrow({
      where: { id: instanceId },
      include: adminFlightFullInclude,
    });

    await this.scheduleSync.onFlightInstanceCreated(instanceId);

    return mapAdminFlightToDto(created);
  }
}

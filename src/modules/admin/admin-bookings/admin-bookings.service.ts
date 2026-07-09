import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/infra/db/prisma/prisma.service';
import { AdminBookingsQueryDto } from './dto/admin-bookings-query.dto';
import { BookingStatus, Prisma } from '@prisma/client';
import { BookingWithRelations } from './types/booking-with-relations.prisma';

@Injectable()
export class AdminBookingsService {
  constructor(private readonly prismaService: PrismaService) {}

  async findAll(query: AdminBookingsQueryDto) {
    const { search, status, page, limit } = query;

    const where: Prisma.BookingWhereInput = {};

    if (status && (status as string) !== 'all') {
      where.status = status;
    }

    if (search) {
      where.OR = [
        { id: { contains: search, mode: 'insensitive' } },
        { pnrLocator: { contains: search, mode: 'insensitive' } },
        {
          user: {
            firstName: { contains: search, mode: 'insensitive' },
          },
        },
        {
          user: {
            lastName: { contains: search, mode: 'insensitive' },
          },
        },
      ];
    }

    const [data, total] = await Promise.all([
      this.prismaService.booking.findMany({
        where,
        include: {
          user: true,
          transaction: true,
          travelers: true,
          flightInstance: {
            include: {
              flight: {
                include: {
                  segments: {
                    include: {
                      departureAirport: true,
                      arrivalAirport: true,
                    },
                  },
                  airline: true,
                },
              },
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
        skip: (page - 1) * limit,
        take: limit,
      }),

      this.prismaService.booking.count({ where }),
    ]);

    return {
      data: data.map((b) => this.mapBookingToAdminDto(b)),
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async updateStatus(id: string, status: BookingStatus) {
    const booking = await this.prismaService.booking.findUnique({
      where: { id },
    });

    if (!booking) {
      throw new NotFoundException('Booking not found');
    }

    return this.prismaService.booking.update({
      where: { id },
      data: { status },
    });
  }

  private mapBookingToAdminDto(b: BookingWithRelations) {
    const segments = (b.flightInstance?.flight?.segments || []).sort(
      (a, c) => a.segmentOrder - c.segmentOrder,
    );

    const firstSegment = segments[0];
    const lastSegment = segments[segments.length - 1];

    return {
      id: b.id,

      user: {
        firstName: b.user?.firstName ?? '',
        lastName: b.user?.lastName ?? '',
      },

      flight: {
        number: firstSegment?.flightNumber ?? '—',

        from: firstSegment?.departureAirport?.iataCode ?? '—',
        to: lastSegment?.arrivalAirport?.iataCode ?? '—',

        departureDate: firstSegment?.departureTime?.toISOString() ?? null,

        durationMinutes: b.flightInstance?.flight?.durationMinutes ?? 0,

        airline: b.flightInstance?.flight?.airline?.name ?? '—',
      },

      passengersCount: b.travelers?.length ?? 0,

      totalPrice: Number(b.totalPrice),
      currency: b.currency,

      status: b.status,

      transaction: b.transaction
        ? {
            id: b.transaction.id,
            status: b.transaction.status,
          }
        : undefined,
    };
  }
}

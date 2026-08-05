import { PassengerType, type Prisma, TravelClass } from '@prisma/client';
import { formatDateInTimeZone } from 'src/shared/datetime/timezone-date.util';

export const adminFlightFullInclude = {
  flight: {
    include: {
      airline: true,
      departureAirport: true,
      arrivalAirport: true,
    },
  },
  aircraft: {
    include: {
      aircraftLayout: {
        include: { seats: true },
      },
    },
  },
  fares: true,
  _count: {
    select: {
      bookings: true,
    },
  },
} satisfies Prisma.FlightInstanceInclude;

export type AdminFlightInstanceRecord = Prisma.FlightInstanceGetPayload<{
  include: typeof adminFlightFullInclude;
}>;

export function mapStatusToDb(status: string) {
  switch (status) {
    case 'on-time':
      return 'SCHEDULED';
    case 'delayed':
      return 'DELAYED';
    case 'cancelled':
      return 'CANCELLED';
    case 'completed':
      return 'COMPLETED';
    default:
      return 'SCHEDULED';
  }
}

export function mapAdminFlightToDto(flight: AdminFlightInstanceRecord) {
  const durationMinutes = flight.flight?.durationMinutes ?? 0;
  const departureTimezone = flight.flight?.departureAirport?.timezone ?? 'UTC';
  const arrivalTimezone = flight.flight?.arrivalAirport?.timezone ?? 'UTC';

  const arrivalDate = new Date(flight.departureDate);
  arrivalDate.setMinutes(arrivalDate.getMinutes() + durationMinutes);

  const totalSeats = flight.aircraft?.aircraftLayout?.seats?.length ?? 0;

  const adultFare = flight.fares.find(
    (fare) =>
      fare.passengerType === PassengerType.ADULT && fare.travelClass === TravelClass.ECONOMY,
  );

  return {
    id: flight.id,
    departureDate: flight.departureDate,
    arrivalDate,
    departureTimezone,
    arrivalTimezone,
    departureLocalDate: formatDateInTimeZone(flight.departureDate, departureTimezone),
    durationMinutes,
    price: Number(adultFare?.basePrice ?? 0),
    currency: adultFare?.currency ?? null,
    totalSeats,
    availableSeats: flight.seatsAvailable ?? 0,
    bookingsCount: flight._count?.bookings ?? 0,
    status: flight.status,
    delayMinutes: flight.delayMinutes ?? 0,
    flightNumber: flight.flight?.flightNumber ?? '—',
    airline: flight.flight?.airline?.name ?? '—',
    from: flight.flight?.departureAirport?.iataCode ?? '—',
    to: flight.flight?.arrivalAirport?.iataCode ?? '—',
  };
}

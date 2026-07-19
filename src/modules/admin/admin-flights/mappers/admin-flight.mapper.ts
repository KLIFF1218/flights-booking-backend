import { PassengerType, type Prisma, TravelClass } from '@prisma/client';

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
    durationMinutes,
    price: Number(adultFare?.basePrice ?? 0),
    currency: adultFare?.currency ?? null,
    totalSeats,
    availableSeats: flight.seatsAvailable ?? 0,
    status: flight.status,
    delayMinutes: flight.delayMinutes ?? 0,
    flightNumber: flight.flight?.flightNumber ?? '—',
    airline: flight.flight?.airline?.name ?? '—',
    from: flight.flight?.departureAirport?.iataCode ?? '—',
    to: flight.flight?.arrivalAirport?.iataCode ?? '—',
  };
}

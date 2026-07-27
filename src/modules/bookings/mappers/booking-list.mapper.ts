import type { BookingSnapshot } from '../interfaces/booking-snapshot.interface';
import type { BookingTicketDto } from '../types/booking-ticket';
import type { BookingListItemEntity } from '../types/booking-list-item';
import type { BookingListItemDto } from '../dtos/booking-list-item.dto';
import { mapOfferToBookingRoutes } from '../utils/booking-offer-routes.util';
import type { FlightStatus } from '@prisma/client';

const emptyFlight = {
  number: '',
  from: '',
  to: '',
  departureDate: null as string | null,
  arrivalDate: null as string | null,
  airline: '',
};

function buildOperationalAlert(
  flightInstance?: {
    status: FlightStatus;
    delayMinutes: number;
  } | null,
) {
  if (!flightInstance) {
    return null;
  }

  if (flightInstance.status === 'CANCELLED') {
    return {
      type: 'CANCELLED' as const,
      message: 'Flight cancelled. Contact support for a refund or rebooking.',
      delayMinutes: null,
    };
  }

  if (flightInstance.status === 'DELAYED' && flightInstance.delayMinutes > 0) {
    return {
      type: 'DELAYED' as const,
      message: `Flight delayed by ${flightInstance.delayMinutes} min.`,
      delayMinutes: flightInstance.delayMinutes,
    };
  }

  return null;
}

export function mapToListItem(booking: BookingListItemEntity): BookingListItemDto {
  const snapshot = booking.snapshot as unknown as BookingSnapshot;

  const offer = snapshot.offer;
  const routes = mapOfferToBookingRoutes(offer);
  const primaryRoute = routes[0];
  const liveDeparture = booking.flightInstance?.departureDate?.toISOString() ?? null;

  const fareDetails = snapshot.pricing?.travelers?.[0]?.fareDetailsBySegment?.[0];

  const flight = primaryRoute
    ? {
        number: primaryRoute.number,
        from: primaryRoute.from,
        to: primaryRoute.to,
        departureDate: liveDeparture ?? primaryRoute.departureDate,
        arrivalDate: primaryRoute.arrivalDate,
        airline: primaryRoute.airline,
      }
    : emptyFlight;

  const seatAssignmentsByTraveler = new Map(
    booking.seatAssignments?.map((assignment) => [assignment.travelerId, assignment]),
  );

  return {
    id: booking.id,
    pnrLocator: booking.pnrLocator,
    status: booking.status,
    totalPrice: Number(booking.totalPrice),
    currency: booking.currency,
    flightOrderId: booking.flightOrderId,
    createdAt: booking.createdAt,
    lastTicketingDate: booking.lastTicketingDate,
    provider: booking.provider,

    routes,

    flight,

    operationalAlert: buildOperationalAlert(booking.flightInstance),

    cabin: fareDetails?.cabin ?? 'ECONOMY',

    passengersCount: booking.travelers?.length ?? 0,

    travelers:
      booking.travelers?.map((traveler) => {
        const seatAssignment = seatAssignmentsByTraveler.get(traveler.id);

        return {
          id: traveler.id,
          firstName: traveler.firstName,
          lastName: traveler.lastName,
          seatNumber: seatAssignment?.seat?.seatNumber ?? null,
        };
      }) ?? [],

    tickets: [] as BookingTicketDto[],

    transaction: booking.transaction
      ? {
          id: booking.transaction.id,
        }
      : null,
  };
}

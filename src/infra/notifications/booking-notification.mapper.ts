import { UserNotificationType } from '@prisma/client';
import type { DomainEventEnvelope } from 'src/infra/kafka/domain-event-envelope.util';
import { resolveBookingIdFromEnvelope } from 'src/infra/kafka/domain-event-envelope.util';

export type BookingNotificationDraft = {
  userId: string;
  bookingId?: string;
  type: UserNotificationType;
  title: string;
  message: string;
};

/**
 * In-app notification triggers. Excluded on purpose (phase 1):
 * - booking.created — user is already in checkout; reduces noise
 * - booking.paid — ticket.issued is the single success notification
 */
const NOTIFICATION_EVENT_TYPES = new Set([
  'booking.expired',
  'booking.canceled',
  'booking.ticketing.failed',
  'payment.failed',
  'ticket.issued',
  'flight.delayed',
  'flight.cancelled',
]);

export function isNotificationEventType(eventType: string): boolean {
  return NOTIFICATION_EVENT_TYPES.has(eventType);
}

export function mapDomainEventToNotification(
  envelope: DomainEventEnvelope,
): BookingNotificationDraft | null {
  const payload = envelope.payload;
  const bookingId = resolveBookingIdFromEnvelope(envelope) ?? undefined;

  switch (envelope.eventType) {
    case 'booking.canceled': {
      return bookingNotificationFromBookingPayload(
        payload,
        bookingId,
        UserNotificationType.BOOKING_CANCELED,
        'Booking canceled',
        'Your booking has been canceled.',
      );
    }

    case 'booking.expired': {
      return bookingNotificationFromBookingPayload(
        payload,
        bookingId,
        UserNotificationType.BOOKING_EXPIRED,
        'Booking expired',
        'Your booking has expired. Search again to book a new flight.',
      );
    }

    case 'booking.ticketing.failed': {
      const reason = readString(payload.reason)?.replaceAll('_', ' ') ?? 'ticketing failed';
      return bookingNotificationFromBookingPayload(
        payload,
        bookingId,
        UserNotificationType.TICKETING_FAILED,
        'Ticketing failed',
        `We could not issue your ticket: ${reason}. Our team will contact you about a refund.`,
      );
    }

    case 'payment.failed': {
      const reason = readString(payload.reason)?.replaceAll('_', ' ') ?? 'payment failed';
      return bookingNotificationFromBookingPayload(
        payload,
        bookingId,
        UserNotificationType.PAYMENT_FAILED,
        'Payment failed',
        `Payment could not be completed: ${reason}.`,
      );
    }

    case 'ticket.issued': {
      const userId = readString(payload.userId);
      const ticketNumber = readString(payload.ticketNumber);
      if (!bookingId) {
        return null;
      }

      return {
        userId: userId ?? '',
        bookingId,
        type: UserNotificationType.TICKET_ISSUED,
        title: 'Ticket ready',
        message: ticketNumber
          ? `Ticket ${ticketNumber} has been issued. Check your email for the PDF.`
          : 'Your ticket has been issued. Check your email for the PDF.',
      };
    }

    case 'flight.delayed': {
      const userId = readString(payload.userId);
      const delayMinutes = readNumber(payload.delayMinutes);
      const newDeparture = readString(payload.newDeparture);
      if (!userId || delayMinutes === null || !newDeparture) {
        return null;
      }

      const departureLabel = new Date(newDeparture).toLocaleString('en-US');
      return {
        userId,
        bookingId,
        type: UserNotificationType.FLIGHT_DELAYED,
        title: 'Flight delay',
        message: `Flight delayed by ${delayMinutes} min. New departure time: ${departureLabel}`,
      };
    }

    case 'flight.cancelled': {
      const userId = readString(payload.userId);
      if (!userId) {
        return null;
      }

      return {
        userId,
        bookingId,
        type: UserNotificationType.FLIGHT_CANCELLED,
        title: 'Flight cancelled',
        message: 'Your flight has been cancelled. Contact support for a refund or rebooking.',
      };
    }

    default:
      return null;
  }
}

function bookingNotificationFromBookingPayload(
  payload: Record<string, unknown>,
  bookingId: string | undefined,
  type: UserNotificationType,
  title: string,
  message: string,
): BookingNotificationDraft | null {
  if (!bookingId) {
    return null;
  }

  return {
    userId: readString(payload.userId) ?? '',
    bookingId,
    type,
    title,
    message,
  };
}

function readString(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function readNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

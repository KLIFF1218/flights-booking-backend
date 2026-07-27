import type { TransactionStatusResponseDto } from '../dtos/transaction-status-response.dto';
import type { TicketWithUrls, TransactionWithBooking } from '../types/payment.types';

export class PaymentMapper {
  static toTransactionStatusResponse(
    tx: TransactionWithBooking,
    tickets: TicketWithUrls[],
    seatAssignmentsByTraveler: Map<string, string | null> = new Map(),
  ): TransactionStatusResponseDto {
    const booking = tx.booking;

    return {
      transactionId: tx.id,
      status: tx.status,
      externalId: tx.externalId,
      bookingId: tx.bookingId,
      bookingStatus: booking?.status ?? null,

      booking: booking
        ? {
            id: booking.id,
            pnr: booking.pnrLocator,
            snapshot: booking.snapshot,
            userEmail: booking.user?.email ?? null,

            travelers: booking.travelers.map((traveler) => ({
              id: traveler.id,
              firstName: traveler.firstName,
              lastName: traveler.lastName,
              seatNumber: seatAssignmentsByTraveler.get(traveler.id) ?? null,
            })),

            tickets,
          }
        : null,
    };
  }
}

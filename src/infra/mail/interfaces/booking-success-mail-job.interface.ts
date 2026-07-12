export interface BookingSuccessMailJob {
  email: string;
  bookingId: string;
  tickets: {
    travelerId: string;
    ticketNumber: string;
    downloadUrl: string;
  }[];
}

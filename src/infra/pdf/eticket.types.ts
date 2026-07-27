export interface EticketSegmentRow {
  itineraryLabel: string;
  flight: string;
  departureAirport: string;
  arrivalAirport: string;
  departureDate: string;
  departureTime: string;
  arrivalDate: string;
  arrivalTime: string;
  cabin: string;
  bookingClass: string;
  fareBasis: string;
  seat: string;
  baggage: string;
}

export interface EticketFareSummary {
  base: string;
  taxes: string;
  fees: string;
  seats: string;
  total: string;
  currency: string;
}

export interface EticketDocumentData {
  pnr: string;
  ticketNumber: string;
  issuedAt: string;
  passengerName: string;
  passengerType: string;
  dateOfBirth: string;
  nationality: string;
  passportNumber: string;
  origin: string;
  destination: string;
  segments: EticketSegmentRow[];
  fare: EticketFareSummary;
  bookingTotal: string;
  bookingCurrency: string;
}

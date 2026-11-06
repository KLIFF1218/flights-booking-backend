import { TravelClass } from '@prisma/client';
import { TicketIssuerService } from './ticket-issuer.service';
import { type TicketDocumentService } from './ticket-document.service';
import { type TicketPersistenceService } from './ticket-persistence.service';
import type { BookingSnapshot } from 'src/modules/bookings/interfaces/booking-snapshot.interface';

describe('TicketIssuerService', () => {
  let service: TicketIssuerService;

  const ticketDocument = {
    buildTicketPdfKey: jest.fn(),
    generatePdf: jest.fn(),
    uploadPdf: jest.fn(),
  };
  const ticketPersistence = {
    findTicketsByBookingId: jest.fn(),
    recordIssuedTicket: jest.fn(),
  };

  const traveler = {
    id: 'traveler-1',
    firstName: 'John',
    lastName: 'Doe',
    seatAssignments: [],
  };

  const snapshot = {
    offer: {
      id: 'offer-1',
      numberOfBookableSeats: 9,
      price: {
        total: '10000',
        currency: 'RUB',
        base: '8000',
        grandTotal: '10000',
      },
      itineraries: [
        {
          duration: 'PT2H',
          segments: [
            {
              id: 'seg-1',
              flightInstanceId: 'fi-1',
              from: 'SVO',
              to: 'LED',
              number: '100',
              carrierCode: 'SU',
              departure: { iataCode: 'SVO', at: '2026-08-01T10:00:00' },
              arrival: { iataCode: 'LED', at: '2026-08-01T12:00:00' },
              airline: 'Aeroflot',
              airlineIata: 'SU',
              aircraft: '320',
              operating: { carrierCode: 'SU' },
              duration: 'PT2H',
              blacklistedInEU: false,
            },
          ],
        },
      ],
      travelerPricings: [],
    },
    pricing: {
      id: 'pricing-1',
      price: {
        base: 8000,
        taxes: 1500,
        fees: 500,
        taxItems: [],
        feeItems: [],
        seats: 0,
        total: 10000,
        currency: 'RUB',
      },
      travelers: [],
      outbound: {
        from: 'SVO',
        to: 'LED',
        departureTime: '2026-08-01T10:00:00',
        arrivalTime: '2026-08-01T12:00:00',
        durationMinutes: 120,
        stops: 0,
        segments: [],
      },
    },
  } as unknown as BookingSnapshot;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new TicketIssuerService(
      ticketDocument as unknown as TicketDocumentService,
      ticketPersistence as unknown as TicketPersistenceService,
    );
    ticketDocument.buildTicketPdfKey.mockReturnValue('tickets/booking-1/traveler-1.pdf');
    ticketDocument.generatePdf.mockResolvedValue(Buffer.from('pdf'));
    ticketDocument.uploadPdf.mockResolvedValue(undefined);
    ticketPersistence.findTicketsByBookingId.mockResolvedValue([]);
    ticketPersistence.recordIssuedTicket.mockResolvedValue({
      id: 'ticket-1',
      ticketNumber: '555-1234567890',
    });
  });

  it('returns prefetched tickets keyed by traveler id', async () => {
    ticketPersistence.findTicketsByBookingId.mockResolvedValue([
      {
        travelerId: 'traveler-1',
        ticketNumber: '555-1234567890',
        pdfKey: 'tickets/booking-1/traveler-1.pdf',
      },
    ]);

    const map = await service.prefetchTicketsByTravelerId('booking-1');

    expect(map.get('traveler-1')).toEqual({
      travelerId: 'traveler-1',
      ticketNumber: '555-1234567890',
      pdfKey: 'tickets/booking-1/traveler-1.pdf',
    });
  });

  it('re-uploads pdf for existing ticket without creating a new db row', async () => {
    const prefetched = new Map([
      [
        'traveler-1',
        {
          travelerId: 'traveler-1',
          ticketNumber: '555-1234567890',
          pdfKey: 'tickets/booking-1/traveler-1.pdf',
        },
      ],
    ]);

    const result = await service.issueForTraveler(
      {
        bookingId: 'booking-1',
        pnrLocator: 'ABC123',
        traveler: traveler as any,
        snapshot,
      },
      prefetched,
    );

    expect(ticketPersistence.recordIssuedTicket).not.toHaveBeenCalled();
    expect(ticketDocument.uploadPdf).toHaveBeenCalledWith(
      'tickets/booking-1/traveler-1.pdf',
      Buffer.from('pdf'),
    );
    expect(result.pdfKey).toBe('tickets/booking-1/traveler-1.pdf');
  });

  it('persists ticket before uploading pdf for new travelers', async () => {
    const result = await service.issueForTraveler({
      bookingId: 'booking-1',
      pnrLocator: 'ABC123',
      traveler: traveler as any,
      snapshot,
      travelerPricing: {
        travelerId: '1',
        fareOption: 'STANDARD',
        travelerType: 'ADULT',
        price: {
          currency: 'RUB',
          total: '10000.00',
          base: '8000.00',
        },
        fareDetailsBySegment: [
          {
            segmentId: 'seg-1',
            cabin: TravelClass.ECONOMY,
            class: 'Y',
            fareBasis: 'ECONOMY',
            includedCheckedBags: { quantity: 1 },
            brandName: null,
          },
        ],
      },
    });

    expect(ticketPersistence.recordIssuedTicket).toHaveBeenCalled();
    expect(ticketDocument.uploadPdf).toHaveBeenCalled();
    const recordOrder = ticketPersistence.recordIssuedTicket.mock.invocationCallOrder[0];
    const uploadOrder = ticketDocument.uploadPdf.mock.invocationCallOrder[0];
    expect(recordOrder).toBeLessThan(uploadOrder);
    expect(ticketPersistence.recordIssuedTicket).toHaveBeenCalledWith(
      expect.objectContaining({
        bookingId: 'booking-1',
        travelerId: 'traveler-1',
        pdfKey: 'tickets/booking-1/traveler-1.pdf',
      }),
    );
    expect(result.pdfKey).toBe('tickets/booking-1/traveler-1.pdf');
  });
});

import { EnumTransport, TravelClass } from '@prisma/client';
import { TicketIssuerService } from './ticket-issuer.service';
import { type PrismaService } from 'src/infra/db/prisma/prisma.service';
import { type PdfService } from 'src/infra/pdf/pdf.service';
import { type S3Service } from 'src/infra/storage/s3.service';
import { type OutboxService } from 'src/infra/outbox/outbox.service';
import type { BookingSnapshot } from 'src/modules/bookings/interfaces/booking-snapshot.interface';

describe('TicketIssuerService', () => {
  let service: TicketIssuerService;

  const prisma = {
    ticket: {
      findFirst: jest.fn(),
    },
    $transaction: jest.fn(),
  };
  const pdfService = {
    generateEticket: jest.fn(),
  };
  const s3 = {
    uploadFile: jest.fn(),
    getDownloadUrl: jest.fn(),
  };
  const outbox = {
    enqueue: jest.fn(),
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
      prisma as unknown as PrismaService,
      pdfService as unknown as PdfService,
      s3 as unknown as S3Service,
      outbox as unknown as OutboxService,
    );
  });

  it('returns existing ticket without re-uploading pdf', async () => {
    prisma.ticket.findFirst.mockResolvedValue({
      id: 'ticket-1',
      travelerId: 'traveler-1',
      ticketNumber: '555-1234567890',
      pdfKey: 'tickets/booking-1/traveler-1.pdf',
    });
    s3.getDownloadUrl.mockResolvedValue('https://example.com/existing.pdf');

    const result = await service.issueForTraveler({
      bookingId: 'booking-1',
      pnrLocator: 'ABC123',
      traveler: traveler as any,
      snapshot,
    });

    expect(result).toEqual({
      travelerId: 'traveler-1',
      ticketNumber: '555-1234567890',
      pdfKey: 'tickets/booking-1/traveler-1.pdf',
    });
    expect(pdfService.generateEticket).not.toHaveBeenCalled();
    expect(s3.uploadFile).not.toHaveBeenCalled();
    expect(s3.getDownloadUrl).not.toHaveBeenCalled();
  });

  it('creates ticket, uploads pdf and enqueues outbox events', async () => {
    prisma.ticket.findFirst.mockResolvedValue(null);
    pdfService.generateEticket.mockResolvedValue(Buffer.from('pdf'));
    s3.uploadFile.mockResolvedValue('tickets/booking-1/traveler-1.pdf');
    s3.getDownloadUrl.mockResolvedValue('https://example.com/new.pdf');

    const tx = {
      ticket: {
        create: jest.fn().mockResolvedValue({
          id: 'ticket-1',
          ticketNumber: '555-1234567890',
        }),
      },
    };

    prisma.$transaction.mockImplementation(async (callback) => callback(tx));

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

    expect(pdfService.generateEticket).toHaveBeenCalled();
    expect(s3.uploadFile).toHaveBeenCalledWith({
      key: 'tickets/booking-1/traveler-1.pdf',
      body: Buffer.from('pdf'),
      contentType: 'application/pdf',
    });
    expect(outbox.enqueue).toHaveBeenCalledTimes(1);
    expect(outbox.enqueue).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({
        topic: 'ticket.issued',
        transport: EnumTransport.KAFKA,
      }),
    );
    expect(result.pdfKey).toBe('tickets/booking-1/traveler-1.pdf');
    expect(s3.getDownloadUrl).not.toHaveBeenCalled();
  });
});

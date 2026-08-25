import { NotFoundException } from '@nestjs/common';
import { BookingStatus, TicketStatus } from '@prisma/client';
import { BookingTicketService } from '../tickets/booking-ticket.service';
import { type BookingWorkflowService } from '../booking/booking-workflow.service';
import { type S3Service } from 'src/infra/storage/s3.service';
import { createBookingMetricsMock } from '../../metrics/booking-metrics.mock';

describe('BookingTicketService', () => {
  let service: BookingTicketService;
  const bookingWorkflow = {
    findBookingForUser: jest.fn(),
  };
  const s3 = {
    fileExists: jest.fn(),
    getDownloadUrl: jest.fn(),
  };
  const bookingMetrics = createBookingMetricsMock();

  beforeEach(() => {
    jest.clearAllMocks();
    service = new BookingTicketService(
      bookingWorkflow as unknown as BookingWorkflowService,
      s3 as unknown as S3Service,
      bookingMetrics,
    );
  });

  const booking = {
    id: 'booking-1',
    userId: 'user-1',
    status: BookingStatus.TICKETED,
    pnrLocator: 'ABC123',
    snapshot: {
      offer: {
        itineraries: [
          {
            segments: [
              {
                departure: { iataCode: 'SVO', at: '2026-08-01T10:00:00' },
                arrival: { iataCode: 'LED', at: '2026-08-01T12:00:00' },
              },
            ],
          },
        ],
      },
    },
    tickets: [
      {
        travelerId: 'traveler-1',
        ticketNumber: 'SC-ABCDEF123456',
        status: TicketStatus.ISSUED,
        pdfKey: 'tickets/booking-1/traveler-1.pdf',
      },
    ],
  };

  it('returns ticket urls for booking owner', async () => {
    bookingWorkflow.findBookingForUser.mockResolvedValue(booking);
    s3.fileExists.mockResolvedValue(true);
    s3.getDownloadUrl.mockResolvedValue('https://example.com/ticket.pdf');

    const result = await service.getTickets('booking-1', 'user-1', 'download');

    expect(bookingWorkflow.findBookingForUser).toHaveBeenCalledWith('booking-1', 'user-1', {
      tickets: true,
    });
    expect(s3.getDownloadUrl).toHaveBeenCalledWith(
      'tickets/booking-1/traveler-1.pdf',
      expect.objectContaining({
        disposition: 'attachment',
        fileName: 'E-Ticket-ABC123-SVO-LED-SC-ABCDEF123456.pdf',
      }),
    );
    expect(result).toEqual([
      {
        travelerId: 'traveler-1',
        ticketNumber: 'SC-ABCDEF123456',
        status: TicketStatus.ISSUED,
        previewUrl: 'https://example.com/ticket.pdf',
        downloadUrl: 'https://example.com/ticket.pdf',
        url: 'https://example.com/ticket.pdf',
      },
    ]);
  });

  it('throws when booking is not ticketed yet', async () => {
    bookingWorkflow.findBookingForUser.mockResolvedValue({
      ...booking,
      status: BookingStatus.PAID,
      tickets: [],
    });

    await expect(service.getTickets('booking-1', 'user-1')).rejects.toThrow(NotFoundException);
  });

  it('throws when pdf file is missing in storage', async () => {
    bookingWorkflow.findBookingForUser.mockResolvedValue(booking);
    s3.fileExists.mockResolvedValue(false);

    await expect(service.getTickets('booking-1', 'user-1')).rejects.toThrow(NotFoundException);
  });
});

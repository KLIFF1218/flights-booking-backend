import { Test, type TestingModule } from '@nestjs/testing';
import { BookingStatus, TransactionStatus } from '@prisma/client';
import { PaymentTransactionQueryService } from './payment-transaction-query.service';
import { PrismaService } from 'src/infra/db/prisma/prisma.service';
import { S3Service } from 'src/infra/storage/s3.service';
import { Logger } from 'nestjs-pino';

const mockPrismaService = {
  transaction: {
    findFirst: jest.fn(),
  },
};

const mockS3Service = {
  getDownloadUrl: jest.fn(),
};

describe('PaymentTransactionQueryService', () => {
  let service: PaymentTransactionQueryService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaymentTransactionQueryService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: S3Service, useValue: mockS3Service },
        { provide: Logger, useValue: { warn: jest.fn() } },
      ],
    }).compile();

    service = module.get(PaymentTransactionQueryService);
  });

  it('maps ticket urls from S3', async () => {
    mockPrismaService.transaction.findFirst.mockResolvedValue({
      id: 'tx_1',
      status: TransactionStatus.SUCCEED,
      externalId: 'ext_1',
      bookingId: 'booking_1',
      booking: {
        id: 'booking_1',
        status: BookingStatus.TICKETED,
        pnrLocator: 'PNR123',
        snapshot: {},
        user: { email: 'user@example.com' },
        travelers: [],
        tickets: [
          {
            id: 'ticket_1',
            travelerId: 'trav_1',
            ticketNumber: 'T001',
            status: 'ISSUED',
            pdfKey: 'tickets/T001.pdf',
          },
        ],
        seatAssignments: [],
      },
    });
    mockS3Service.getDownloadUrl
      .mockResolvedValueOnce('https://s3.test/preview.pdf')
      .mockResolvedValueOnce('https://s3.test/download.pdf');

    const result = await service.getTransactionStatus('tx_1', 'user_1');

    expect(result.booking?.tickets[0]).toEqual({
      id: 'ticket_1',
      travelerId: 'trav_1',
      ticketNumber: 'T001',
      status: 'ISSUED',
      previewUrl: 'https://s3.test/preview.pdf',
      downloadUrl: 'https://s3.test/download.pdf',
    });
  });

  it('returns null ticket urls when S3 is unavailable', async () => {
    mockPrismaService.transaction.findFirst.mockResolvedValue({
      id: 'tx_1',
      status: TransactionStatus.SUCCEED,
      externalId: 'ext_1',
      bookingId: 'booking_1',
      booking: {
        id: 'booking_1',
        status: BookingStatus.TICKETED,
        pnrLocator: 'PNR123',
        snapshot: {},
        user: { email: 'user@example.com' },
        travelers: [],
        tickets: [
          {
            id: 'ticket_1',
            travelerId: 'trav_1',
            ticketNumber: 'T001',
            status: 'ISSUED',
            pdfKey: 'tickets/T001.pdf',
          },
        ],
        seatAssignments: [],
      },
    });
    mockS3Service.getDownloadUrl.mockRejectedValue(new Error('S3 unavailable'));

    const result = await service.getTransactionStatus('tx_1', 'user_1');

    expect(result.booking?.tickets[0]).toEqual({
      id: 'ticket_1',
      travelerId: 'trav_1',
      ticketNumber: 'T001',
      status: 'ISSUED',
      previewUrl: null,
      downloadUrl: null,
    });
  });
});

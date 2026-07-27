import { Test, type TestingModule } from '@nestjs/testing';
import { PaymentService } from './services/payment.service';
import { S3Service } from 'src/infra/storage/s3.service';
import { PrismaService } from 'src/infra/db/prisma/prisma.service';
import { PaymentProviderService } from './services/payment-provider.service';
import { MetricsService } from 'src/infra/metrics/metrics.service';
import { BookingStatus, Currency, PaymentProvider, TransactionStatus } from '@prisma/client';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Logger } from 'nestjs-pino';
import { BookingExpirationService } from '../bookings/services/booking-expiration.service';
import { PaymentAbandonmentService } from './services/payment-abandonment.service';

const mockPrismaService = {
  booking: {
    findFirst: jest.fn(),
    update: jest.fn(),
  },
  transaction: {
    findFirst: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    deleteMany: jest.fn(),
  },
  $transaction: jest.fn(),
};

const mockS3Service = {
  getDownloadUrl: jest.fn(),
};

const mockPaymentProviderService = {
  get: jest.fn(),
  cancelPendingPayment: jest.fn(),
  getPendingPaymentRedirectUrl: jest.fn(),
};

const mockPaymentAbandonmentService = {
  cancelPendingPaymentAtProviderBestEffort: jest.fn().mockResolvedValue(undefined),
  abandonPayment: jest.fn().mockResolvedValue(true),
};

const mockMetricsService = {
  paymentDuration: {
    startTimer: jest.fn().mockReturnValue(jest.fn()),
  },
  recordPayment: jest.fn(),
  recordPaymentValue: jest.fn(),
  recordPaymentFailure: jest.fn(),
};

const mockBooking = {
  id: 'booking_1',
  userId: 'user_1',
  totalPrice: 1500,
  currency: Currency.RUB,
  status: BookingStatus.SEATS_SELECTED,
  expiresAt: new Date('2026-12-31T00:00:00Z'),
};

const mockTransaction = {
  id: 'tx_1',
  amount: 1500,
  currency: Currency.RUB,
  status: TransactionStatus.PENDING,
  bookingId: mockBooking.id,
  userId: mockBooking.userId,
  provider: PaymentProvider.STRIPE,
  idempotencyKey: 'idem-1',
};

describe('PaymentService', () => {
  let service: PaymentService;
  let timer: jest.Mock;

  beforeEach(async () => {
    timer = jest.fn();
    mockMetricsService.paymentDuration.startTimer.mockReturnValue(timer);
    jest.clearAllMocks();
    mockPaymentAbandonmentService.cancelPendingPaymentAtProviderBestEffort.mockResolvedValue(
      undefined,
    );
    mockPaymentAbandonmentService.abandonPayment.mockResolvedValue(true);
    mockPaymentProviderService.getPendingPaymentRedirectUrl.mockResolvedValue(null);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaymentService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: PaymentProviderService, useValue: mockPaymentProviderService },
        { provide: MetricsService, useValue: mockMetricsService },
        { provide: S3Service, useValue: mockS3Service },
        { provide: Logger, useValue: { warn: jest.fn(), log: jest.fn() } },
        {
          provide: BookingExpirationService,
          useValue: { ensureActive: jest.fn().mockResolvedValue(undefined) },
        },
        {
          provide: PaymentAbandonmentService,
          useValue: mockPaymentAbandonmentService,
        },
      ],
    }).compile();

    service = module.get<PaymentService>(PaymentService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should throw NotFoundException when booking is missing', async () => {
    mockPrismaService.booking.findFirst.mockResolvedValue(null);

    await expect(
      service.createPayment({
        bookingId: 'missing',
        userId: 'user_1',
        amount: 1000,
        currency: Currency.RUB,
        provider: PaymentProvider.STRIPE,
      }),
    ).rejects.toThrow(NotFoundException);

    expect(mockPrismaService.$transaction).not.toHaveBeenCalled();
  });

  it('should throw NotFoundException when booking belongs to another user', async () => {
    mockPrismaService.booking.findFirst.mockResolvedValue(null);

    await expect(
      service.createPayment({
        bookingId: mockBooking.id,
        userId: 'other_user',
        amount: 1000,
        currency: Currency.RUB,
        provider: PaymentProvider.STRIPE,
      }),
    ).rejects.toThrow(NotFoundException);

    expect(mockPrismaService.$transaction).not.toHaveBeenCalled();
  });

  it('should throw BadRequestException when booking status is invalid', async () => {
    mockPrismaService.booking.findFirst.mockResolvedValue({
      ...mockBooking,
      status: BookingStatus.PAID,
    });

    await expect(
      service.createPayment({
        bookingId: mockBooking.id,
        userId: mockBooking.userId,
        amount: 1000,
        currency: Currency.RUB,
        provider: PaymentProvider.STRIPE,
      }),
    ).rejects.toThrow(BadRequestException);

    expect(mockPrismaService.$transaction).not.toHaveBeenCalled();
  });

  it('should create payment and return redirectUrl', async () => {
    mockPrismaService.booking.findFirst.mockResolvedValue(mockBooking);
    const txCreate = jest.fn().mockResolvedValue(mockTransaction);
    mockPrismaService.$transaction.mockImplementation(async (callback) =>
      callback({
        transaction: {
          findUnique: jest.fn().mockResolvedValue(null),
          create: txCreate,
          delete: jest.fn(),
        },
        booking: {
          findFirst: jest.fn().mockResolvedValue(mockBooking),
          update: jest.fn().mockResolvedValue({
            ...mockBooking,
            status: BookingStatus.PAYMENT_PENDING,
          }),
        },
      }),
    );
    mockPaymentProviderService.get.mockResolvedValue({
      externalId: 'external_1',
      redirectUrl: 'https://pay.example.com/redirect',
      meta: { session: 'data' },
    });
    mockPrismaService.transaction.update.mockResolvedValue({
      ...mockTransaction,
      externalId: 'external_1',
      providerMeta: { session: 'data' },
    });

    const result = await service.createPayment({
      bookingId: mockBooking.id,
      userId: mockBooking.userId,
      amount: 1000,
      currency: Currency.RUB,
      provider: PaymentProvider.STRIPE,
    });

    expect(result).toEqual({ redirectUrl: 'https://pay.example.com/redirect' });
    expect(txCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        bookingId: mockBooking.id,
        status: TransactionStatus.PENDING,
        paymentExpiresAt: expect.any(Date),
      }),
    });
    expect(mockPaymentProviderService.get).toHaveBeenCalledWith({
      transactionId: mockTransaction.id,
      bookingId: mockBooking.id,
      amount: String(mockTransaction.amount),
      currency: mockTransaction.currency,
      idempotencyKey: mockTransaction.idempotencyKey,
      provider: mockTransaction.provider,
    });
    expect(mockPrismaService.transaction.update).toHaveBeenCalledWith({
      where: { id: mockTransaction.id },
      data: {
        externalId: 'external_1',
        providerMeta: { session: 'data' },
      },
    });
    expect(mockMetricsService.recordPayment).toHaveBeenCalledWith(
      PaymentProvider.STRIPE,
      'initiated',
    );
    expect(mockMetricsService.recordPaymentValue).toHaveBeenCalledWith(
      150000,
      PaymentProvider.STRIPE,
      'initiated',
    );
    expect(timer).toHaveBeenCalledWith({ provider: String(PaymentProvider.STRIPE) });
  });

  it('should record failure metrics when provider fails', async () => {
    mockPrismaService.booking.findFirst.mockResolvedValue(mockBooking);
    const txCreate = jest.fn().mockResolvedValue(mockTransaction);
    mockPrismaService.$transaction.mockImplementation(async (callback) =>
      callback({
        transaction: {
          findUnique: jest.fn().mockResolvedValue(null),
          create: txCreate,
          updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        },
        booking: {
          findFirst: jest.fn().mockResolvedValue(mockBooking),
          update: jest.fn().mockResolvedValue({
            ...mockBooking,
            status: BookingStatus.PAYMENT_PENDING,
          }),
          updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        },
      }),
    );
    mockPrismaService.transaction.findUnique.mockResolvedValue(mockTransaction);
    mockPaymentProviderService.get.mockRejectedValue(new Error('provider failure'));

    await expect(
      service.createPayment({
        bookingId: mockBooking.id,
        userId: mockBooking.userId,
        amount: 1000,
        currency: Currency.RUB,
        provider: PaymentProvider.STRIPE,
      }),
    ).rejects.toThrow('provider failure');

    expect(
      mockPaymentAbandonmentService.cancelPendingPaymentAtProviderBestEffort,
    ).not.toHaveBeenCalled();
    expect(mockPrismaService.$transaction).toHaveBeenCalledTimes(2);
    expect(mockMetricsService.recordPaymentFailure).toHaveBeenCalledWith(
      PaymentProvider.STRIPE,
      'provider_error',
    );
    expect(mockMetricsService.recordPayment).toHaveBeenCalledWith(
      PaymentProvider.STRIPE,
      'failure',
    );
    expect(timer).toHaveBeenCalledWith({ provider: String(PaymentProvider.STRIPE) });
  });

  it('cancels provider session when transaction update fails after PSP success', async () => {
    mockPrismaService.booking.findFirst.mockResolvedValue(mockBooking);
    const txCreate = jest.fn().mockResolvedValue(mockTransaction);
    mockPrismaService.$transaction.mockImplementation(async (callback) =>
      callback({
        transaction: {
          findUnique: jest.fn().mockResolvedValue(null),
          create: txCreate,
          updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        },
        booking: {
          findFirst: jest.fn().mockResolvedValue(mockBooking),
          update: jest.fn().mockResolvedValue({
            ...mockBooking,
            status: BookingStatus.PAYMENT_PENDING,
          }),
          updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        },
      }),
    );
    mockPaymentProviderService.get.mockResolvedValue({
      externalId: 'cs_test_1',
      redirectUrl: 'https://pay.example.com/redirect',
      meta: { session: 'data' },
    });
    mockPrismaService.transaction.update.mockRejectedValue(new Error('db update failed'));
    mockPrismaService.transaction.findUnique.mockResolvedValue(mockTransaction);

    await expect(
      service.createPayment({
        bookingId: mockBooking.id,
        userId: mockBooking.userId,
        amount: 1000,
        currency: Currency.RUB,
        provider: PaymentProvider.STRIPE,
      }),
    ).rejects.toThrow('db update failed');

    expect(
      mockPaymentAbandonmentService.cancelPendingPaymentAtProviderBestEffort,
    ).toHaveBeenCalledWith({
      id: mockTransaction.id,
      status: TransactionStatus.PENDING,
      provider: PaymentProvider.STRIPE,
      externalId: 'cs_test_1',
    });
    expect(mockPrismaService.$transaction).toHaveBeenCalledTimes(2);
  });

  it('cancels provider session when rolling back pending payment for booking', async () => {
    mockPrismaService.transaction.findFirst.mockResolvedValue({
      ...mockTransaction,
      externalId: 'cs_test_1',
    });
    mockPrismaService.transaction.findUnique.mockResolvedValue({
      ...mockTransaction,
      externalId: 'cs_test_1',
    });
    mockPrismaService.$transaction.mockImplementation(async (callback) =>
      callback({
        transaction: {
          updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        },
        booking: {
          updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        },
      }),
    );

    await service.rollbackPendingPaymentForBooking(mockBooking.id, mockBooking.userId);

    expect(
      mockPaymentAbandonmentService.cancelPendingPaymentAtProviderBestEffort,
    ).toHaveBeenCalledWith({
      id: mockTransaction.id,
      status: TransactionStatus.PENDING,
      provider: PaymentProvider.STRIPE,
      externalId: 'cs_test_1',
    });
  });

  it('should throw if payment already initiated', async () => {
    mockPrismaService.booking.findFirst.mockResolvedValue(mockBooking);
    mockPrismaService.$transaction.mockImplementation(async (callback) =>
      callback({
        transaction: {
          findUnique: jest.fn().mockResolvedValue({ id: 'existing_tx' }),
          create: jest.fn(),
        },
        booking: {
          findFirst: jest.fn().mockResolvedValue(mockBooking),
          update: jest.fn(),
        },
      }),
    );

    await expect(
      service.createPayment({
        bookingId: mockBooking.id,
        userId: mockBooking.userId,
        amount: 1000,
        currency: Currency.RUB,
        provider: PaymentProvider.STRIPE,
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('cancels pending payment at provider when external id exists', async () => {
    await service.cancelPendingPaymentAtProviderBestEffort({
      id: 'tx_1',
      status: TransactionStatus.PENDING,
      provider: PaymentProvider.STRIPE,
      externalId: 'cs_test_1',
    });

    expect(
      mockPaymentAbandonmentService.cancelPendingPaymentAtProviderBestEffort,
    ).toHaveBeenCalledWith({
      id: 'tx_1',
      status: TransactionStatus.PENDING,
      provider: PaymentProvider.STRIPE,
      externalId: 'cs_test_1',
    });
  });

  it('skips provider cancel when transaction is not pending', async () => {
    await service.cancelPendingPaymentAtProviderBestEffort({
      id: 'tx_1',
      status: TransactionStatus.SUCCEED,
      provider: PaymentProvider.STRIPE,
      externalId: 'cs_test_1',
    });

    expect(
      mockPaymentAbandonmentService.cancelPendingPaymentAtProviderBestEffort,
    ).toHaveBeenCalled();
  });

  it('delegates provider cancel failures to abandonment service', async () => {
    mockPaymentAbandonmentService.cancelPendingPaymentAtProviderBestEffort.mockRejectedValue(
      new Error('provider down'),
    );

    await expect(
      service.cancelPendingPaymentAtProviderBestEffort({
        id: 'tx_1',
        status: TransactionStatus.PENDING,
        provider: PaymentProvider.YOOKASSA,
        externalId: 'pay_1',
      }),
    ).rejects.toThrow('provider down');
  });

  it('returns ticket urls when S3 is available', async () => {
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

  describe('resumePayment', () => {
    const resumeParams = {
      bookingId: mockBooking.id,
      userId: mockBooking.userId,
      amount: 1500,
      currency: Currency.RUB,
      provider: PaymentProvider.STRIPE,
    };

    const pendingTransaction = {
      ...mockTransaction,
      status: TransactionStatus.PENDING,
      externalId: 'ext_open',
      paymentExpiresAt: new Date('2026-12-31T00:00:00Z'),
    };

    it('returns existing provider URL without changing booking status', async () => {
      mockPrismaService.booking.findFirst.mockResolvedValue({
        ...mockBooking,
        status: BookingStatus.PAYMENT_PENDING,
        transaction: pendingTransaction,
      });
      mockPaymentProviderService.getPendingPaymentRedirectUrl.mockResolvedValue(
        'https://pay.example.com/existing',
      );

      const result = await service.resumePayment(resumeParams);

      expect(result).toEqual({
        paymentRedirectUrl: 'https://pay.example.com/existing',
        transactionId: pendingTransaction.id,
        expiresAt: pendingTransaction.paymentExpiresAt,
      });
      expect(mockPaymentProviderService.get).not.toHaveBeenCalled();
      expect(mockPrismaService.transaction.update).not.toHaveBeenCalled();
    });

    it('recreates provider session without extending paymentExpiresAt', async () => {
      mockPrismaService.booking.findFirst.mockResolvedValue({
        ...mockBooking,
        status: BookingStatus.PAYMENT_PENDING,
        transaction: pendingTransaction,
      });
      mockPaymentProviderService.getPendingPaymentRedirectUrl.mockResolvedValue(null);
      mockPrismaService.transaction.update
        .mockResolvedValueOnce({
          ...pendingTransaction,
          idempotencyKey: 'idem-2',
        })
        .mockResolvedValueOnce({
          ...pendingTransaction,
          externalId: 'ext_new',
        });
      mockPaymentProviderService.get.mockResolvedValue({
        externalId: 'ext_new',
        redirectUrl: 'https://pay.example.com/new',
        meta: { session: 'new' },
      });

      const result = await service.resumePayment(resumeParams);

      expect(result.paymentRedirectUrl).toBe('https://pay.example.com/new');
      expect(result.transactionId).toBe(pendingTransaction.id);
      expect(result.expiresAt).toEqual(pendingTransaction.paymentExpiresAt);
      expect(mockPrismaService.transaction.update).toHaveBeenNthCalledWith(1, {
        where: { id: pendingTransaction.id },
        data: {
          status: TransactionStatus.PENDING,
          idempotencyKey: expect.any(String),
        },
      });
      expect(mockPaymentProviderService.get).toHaveBeenCalled();
    });

    it('abandons booking when payment window has elapsed', async () => {
      mockPrismaService.booking.findFirst.mockResolvedValue({
        ...mockBooking,
        status: BookingStatus.PAYMENT_PENDING,
        transaction: {
          ...pendingTransaction,
          paymentExpiresAt: new Date('2020-01-01T00:00:00Z'),
        },
      });

      await expect(service.resumePayment(resumeParams)).rejects.toThrow(BadRequestException);
      expect(mockPaymentAbandonmentService.abandonPayment).toHaveBeenCalledWith(mockBooking.id);
      expect(mockPaymentProviderService.get).not.toHaveBeenCalled();
    });

    it('rejects resume when booking is not awaiting payment', async () => {
      mockPrismaService.booking.findFirst.mockResolvedValue({
        ...mockBooking,
        status: BookingStatus.SEATS_SELECTED,
        transaction: null,
      });

      await expect(service.resumePayment(resumeParams)).rejects.toThrow(
        'Booking is not awaiting payment',
      );
    });
  });
});

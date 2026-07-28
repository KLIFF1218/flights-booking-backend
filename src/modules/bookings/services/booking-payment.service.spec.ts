import { PaymentProvider, BookingStatus, Currency } from '@prisma/client';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { BookingPaymentService } from './booking-payment.service';
import { type PrismaService } from 'src/infra/db/prisma/prisma.service';
import { type PaymentService } from 'src/modules/payment/services/payment.service';
import { type Logger } from 'nestjs-pino';

describe('BookingPaymentService', () => {
  let service: BookingPaymentService;

  const prisma = {
    booking: {
      findFirst: jest.fn(),
    },
    transaction: {
      findUnique: jest.fn(),
    },
  };
  const paymentService = {
    createPayment: jest.fn(),
    resumePayment: jest.fn(),
  };
  const logger = {
    debug: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    service = new BookingPaymentService(
      prisma as unknown as PrismaService,
      paymentService as unknown as PaymentService,
      logger as unknown as Logger,
    );
  });

  it('uses payment provider from booking snapshot', async () => {
    prisma.booking.findFirst.mockResolvedValue({
      id: 'booking-1',
      userId: 'user-1',
      totalPrice: 10000,
      currency: 'RUB',
      snapshot: {
        paymentProvider: PaymentProvider.YOOKASSA,
      },
    });
    paymentService.createPayment.mockResolvedValue({ redirectUrl: 'https://pay.example' });

    await service.createPayment('booking-1', 'user-1');

    expect(paymentService.createPayment).toHaveBeenCalledWith({
      bookingId: 'booking-1',
      userId: 'user-1',
      amount: 10000,
      currency: 'RUB',
      provider: PaymentProvider.YOOKASSA,
    });
  });

  it('defaults to STRIPE when snapshot has no payment provider', async () => {
    prisma.booking.findFirst.mockResolvedValue({
      id: 'booking-1',
      userId: 'user-1',
      totalPrice: 10000,
      currency: Currency.USD,
      snapshot: {},
    });
    paymentService.createPayment.mockResolvedValue({ redirectUrl: 'https://pay.example' });

    await service.createPayment('booking-1', 'user-1');

    expect(paymentService.createPayment).toHaveBeenCalledWith(
      expect.objectContaining({
        provider: PaymentProvider.STRIPE,
      }),
    );
  });

  it('starts payment from SEATS_SELECTED', async () => {
    prisma.booking.findFirst.mockResolvedValue({
      id: 'booking-1',
      userId: 'user-1',
      status: BookingStatus.SEATS_SELECTED,
      totalPrice: 10000,
      currency: 'RUB',
      snapshot: { paymentProvider: PaymentProvider.YOOKASSA },
    });
    paymentService.createPayment.mockResolvedValue({ redirectUrl: 'https://pay.example' });
    prisma.transaction.findUnique.mockResolvedValue({
      id: 'tx-1',
      paymentExpiresAt: new Date('2026-12-31T00:00:00Z'),
    });

    const result = await service.resumePayment('booking-1', 'user-1');

    expect(paymentService.createPayment).toHaveBeenCalled();
    expect(paymentService.resumePayment).not.toHaveBeenCalled();
    expect(result.transactionId).toBe('tx-1');
  });

  it('delegates resume to payment service for PAYMENT_PENDING', async () => {
    prisma.booking.findFirst.mockResolvedValue({
      id: 'booking-1',
      userId: 'user-1',
      status: BookingStatus.PAYMENT_PENDING,
      totalPrice: 10000,
      currency: Currency.USD,
      snapshot: { paymentProvider: PaymentProvider.STRIPE },
    });
    paymentService.resumePayment.mockResolvedValue({
      paymentRedirectUrl: 'https://pay.example/resume',
      transactionId: 'tx-1',
      expiresAt: new Date('2026-12-31T00:00:00Z'),
    });

    const result = await service.resumePayment('booking-1', 'user-1');

    expect(paymentService.resumePayment).toHaveBeenCalledWith({
      bookingId: 'booking-1',
      userId: 'user-1',
      amount: 10000,
      currency: Currency.USD,
      provider: PaymentProvider.STRIPE,
    });
    expect(result.paymentRedirectUrl).toBe('https://pay.example/resume');
  });

  it('rejects resume for paid bookings', async () => {
    prisma.booking.findFirst.mockResolvedValue({
      id: 'booking-1',
      userId: 'user-1',
      status: BookingStatus.PAID,
      snapshot: {},
    });

    await expect(service.resumePayment('booking-1', 'user-1')).rejects.toThrow(BadRequestException);
  });

  it('rejects resume when booking is missing', async () => {
    prisma.booking.findFirst.mockResolvedValue(null);

    await expect(service.resumePayment('missing', 'user-1')).rejects.toThrow(NotFoundException);
  });
});

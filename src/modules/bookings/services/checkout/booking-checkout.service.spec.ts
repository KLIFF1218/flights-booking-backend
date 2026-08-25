import { BadRequestException } from '@nestjs/common';
import { BookingStatus, PaymentProvider } from '@prisma/client';
import { BookingCheckoutService } from '../checkout/booking-checkout.service';
import { type PrismaService } from 'src/infra/db/prisma/prisma.service';
import { type FlightPricingProvider } from 'src/modules/flights/providers/flight-pricing.provider';
import { type BookingSeatService } from '../seats/booking-seat.service';
import { type BookingsCacheService } from '../lifecycle/bookings-cache.service';
import { type FlightsSearchStore } from 'src/modules/flights/services/cache/flights-cache.service';
import { type BookingPaymentService } from '../checkout/booking-payment.service';
import { type SeatReleaseService } from '../seats/seat-release.service';
import { type BookingExpirationService } from '../lifecycle/booking-expiration.service';
import { type SeatMapsService } from 'src/modules/seatmaps/services/seatmap.service';
import { type Logger } from 'nestjs-pino';
import { createBookingMetricsMock } from '../../metrics/booking-metrics.mock';
import { type OutboxService } from 'src/infra/outbox/outbox.service';
import { CHECKOUT_CLEANUP_OUTBOX_TOPIC } from '../../constants/booking-outbox.constants';
import { EnumTransport } from '@prisma/client';

jest.mock('../../utils/checkout/booking-checkout-lock.util', () => ({
  withBookingCheckoutLock: jest.fn(
    async (_prisma: unknown, _bookingId: unknown, fn: () => Promise<unknown>) => fn(),
  ),
}));

describe('BookingCheckoutService', () => {
  let service: BookingCheckoutService;

  const prisma = {
    user: {
      findUnique: jest.fn().mockResolvedValue({
        email: 'user@test.com',
        emailVerifiedAt: new Date('2026-01-01T00:00:00Z'),
      }),
    },
    booking: {
      findFirst: jest.fn(),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    flightInstance: {
      findMany: jest.fn().mockResolvedValue([{ id: 'fi-1', status: 'SCHEDULED' }]),
    },
  };
  const pricingProvider = {
    price: jest.fn(),
  };
  const bookingSeatService = {
    assignSeats: jest.fn(),
  };
  const bookingsCache = {
    invalidateBooking: jest.fn(),
  };
  const searchStore = {
    deleteSeatMap: jest.fn(),
    getSeatMap: jest.fn().mockResolvedValue({ unavailable: false, seatMaps: [] }),
    getLastPricing: jest.fn(),
  };
  const bookingPaymentService = {
    createPayment: jest.fn(),
    cancelPendingPayment: jest.fn(),
  };
  const seatReleaseService = {
    revertCheckoutPreparation: jest.fn(),
  };
  const bookingExpirationService = {
    ensureActive: jest.fn(),
  };
  const seatMapsService = {
    getSeatMapByOffer: jest.fn().mockResolvedValue({ unavailable: false, seatMaps: [] }),
  };
  const logger = {
    warn: jest.fn(),
    error: jest.fn(),
  };
  const outbox = {
    enqueue: jest.fn().mockResolvedValue({ id: 'outbox-1' }),
  };
  const bookingMetrics = createBookingMetricsMock();

  const booking = {
    id: 'booking-1',
    userId: 'user-1',
    status: BookingStatus.PNR_CREATED,
    expiresAt: new Date('2026-12-31T00:00:00Z'),
    travelers: [{ id: 'trav-1', passengerType: 'ADULT' }],
    snapshot: {
      searchId: 'search-1',
      offerId: 'offer-1',
      paymentProvider: PaymentProvider.YOOKASSA,
      offer: {
        id: 'offer-1',
        itineraries: [{ segments: [{ id: 'seg-1', flightInstanceId: 'fi-1' }] }],
      },
      pricing: {
        price: { total: 10000, currency: 'RUB' },
        travelers: [{ travelerId: 'trav-1', travelerType: 'ADULT' }],
      },
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.user.findUnique.mockResolvedValue({
      email: 'user@test.com',
      emailVerifiedAt: new Date('2026-01-01T00:00:00Z'),
    });
    searchStore.getSeatMap.mockResolvedValue({ unavailable: false, seatMaps: [] });
    searchStore.deleteSeatMap.mockResolvedValue(undefined);
    seatMapsService.getSeatMapByOffer.mockResolvedValue({ unavailable: false, seatMaps: [] });
    bookingsCache.invalidateBooking.mockResolvedValue(undefined);
    outbox.enqueue.mockResolvedValue({ id: 'outbox-1' });
    service = new BookingCheckoutService(
      prisma as unknown as PrismaService,
      pricingProvider as unknown as FlightPricingProvider,
      bookingSeatService as unknown as BookingSeatService,
      bookingsCache as unknown as BookingsCacheService,
      searchStore as unknown as FlightsSearchStore,
      bookingPaymentService as unknown as BookingPaymentService,
      seatReleaseService as unknown as SeatReleaseService,
      bookingExpirationService as unknown as BookingExpirationService,
      seatMapsService as unknown as SeatMapsService,
      outbox as unknown as OutboxService,
      logger as unknown as Logger,
      bookingMetrics,
    );
    bookingExpirationService.ensureActive.mockResolvedValue(undefined);
  });

  it('rejects checkout when client offer context does not match booking snapshot', async () => {
    prisma.booking.findFirst.mockResolvedValue(booking);

    await expect(
      service.checkout(
        'booking-1',
        {
          searchId: 'search-2',
          offerId: 'offer-2',
          seats: [],
        },
        'user-1',
      ),
    ).rejects.toThrow(BadRequestException);

    expect(pricingProvider.price).not.toHaveBeenCalled();
  });

  it('rejects checkout when booking status does not allow payment', async () => {
    prisma.booking.findFirst.mockResolvedValue({
      ...booking,
      status: BookingStatus.PAID,
    });

    await expect(
      service.checkout(
        'booking-1',
        {
          searchId: 'search-1',
          offerId: 'offer-1',
          seats: [],
        },
        'user-1',
      ),
    ).rejects.toThrow(BadRequestException);

    expect(pricingProvider.price).not.toHaveBeenCalled();
  });

  it('rejects checkout when seat selection is incomplete', async () => {
    prisma.booking.findFirst.mockResolvedValue(booking);

    await expect(
      service.checkout(
        'booking-1',
        {
          searchId: 'search-1',
          offerId: 'offer-1',
          seats: [],
        },
        'user-1',
      ),
    ).rejects.toThrow(BadRequestException);

    expect(pricingProvider.price).not.toHaveBeenCalled();
    expect(bookingSeatService.assignSeats).not.toHaveBeenCalled();
  });

  it('rejects checkout when travelers are missing and seat map is unavailable', async () => {
    searchStore.getSeatMap.mockResolvedValue({ unavailable: true, seatMaps: [] });
    prisma.booking.findFirst.mockResolvedValue({
      ...booking,
      travelers: [],
    });

    await expect(
      service.checkout(
        'booking-1',
        {
          searchId: 'search-1',
          offerId: 'offer-1',
          seats: [],
        },
        'user-1',
      ),
    ).rejects.toThrow(BadRequestException);

    expect(pricingProvider.price).not.toHaveBeenCalled();
    expect(bookingPaymentService.createPayment).not.toHaveBeenCalled();
  });

  it('allows checkout without seats when seat map is unavailable', async () => {
    const updatedPricing = {
      id: 'pricing-2',
      quoteId: 'quote-1',
      quotedAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
      price: {
        base: 8000,
        taxes: 1500,
        fees: 500,
        seats: 0,
        total: 10000,
        currency: 'RUB',
        taxItems: [],
        feeItems: [],
      },
      travelers: [],
      outbound: { segments: [] },
    };

    searchStore.getSeatMap.mockResolvedValue({ unavailable: true, seatMaps: [] });
    prisma.booking.findFirst.mockResolvedValue(booking);
    pricingProvider.price.mockResolvedValue(updatedPricing);
    prisma.booking.updateMany.mockResolvedValue({ count: 1 });
    bookingPaymentService.createPayment.mockImplementation(
      async (
        _bookingId: string,
        _userId: string,
        options?: { afterPaymentPending?: (tx: unknown) => Promise<void> },
      ) => {
        if (options?.afterPaymentPending) {
          await options.afterPaymentPending(prisma);
        }
        return { redirectUrl: 'https://pay.example/checkout' };
      },
    );
    bookingsCache.invalidateBooking.mockResolvedValue(undefined);

    const result = await service.checkout(
      'booking-1',
      {
        searchId: 'search-1',
        offerId: 'offer-1',
        seats: [],
      },
      'user-1',
    );

    expect(bookingSeatService.assignSeats).not.toHaveBeenCalled();
    expect(pricingProvider.price).toHaveBeenCalledWith('search-1', 'offer-1', {
      seats: [],
      bookingId: 'booking-1',
    });
    expect(prisma.booking.updateMany).toHaveBeenCalledWith({
      where: {
        id: 'booking-1',
        status: { in: [BookingStatus.PNR_CREATED, BookingStatus.SEATS_SELECTED] },
      },
      data: expect.objectContaining({
        status: BookingStatus.SEATS_SELECTED,
        totalPrice: 10000,
      }),
    });
    expect(result).toEqual({ paymentRedirectUrl: 'https://pay.example/checkout' });
  });

  it('prices checkout using offer context from booking snapshot', async () => {
    const updatedPricing = {
      id: 'pricing-2',
      price: {
        base: 8000,
        taxes: 1500,
        fees: 500,
        seats: 1200,
        total: 11200,
        currency: 'RUB',
        taxItems: [],
        feeItems: [],
      },
      travelers: [],
      outbound: { segments: [] },
    };

    prisma.booking.findFirst.mockResolvedValue(booking);
    pricingProvider.price.mockResolvedValue(updatedPricing);
    bookingSeatService.assignSeats.mockResolvedValue(undefined);
    searchStore.deleteSeatMap.mockResolvedValue(undefined);
    prisma.booking.updateMany.mockResolvedValue({ count: 1 });
    bookingPaymentService.createPayment.mockImplementation(
      async (
        _bookingId: string,
        _userId: string,
        options?: { afterPaymentPending?: (tx: unknown) => Promise<void> },
      ) => {
        if (options?.afterPaymentPending) {
          await options.afterPaymentPending(prisma);
        }
        return { redirectUrl: 'https://pay.example/checkout' };
      },
    );
    bookingsCache.invalidateBooking.mockResolvedValue(undefined);

    const result = await service.checkout(
      'booking-1',
      {
        searchId: 'search-1',
        offerId: 'offer-1',
        seats: [{ travelerId: 'trav-1', segmentId: 'seg-1', seatNumber: '12A' }],
      },
      'user-1',
    );

    expect(pricingProvider.price).toHaveBeenCalledWith('search-1', 'offer-1', {
      seats: [{ travelerId: 'trav-1', segmentId: 'seg-1', seatNumber: '12A' }],
      bookingId: 'booking-1',
    });
    expect(prisma.booking.updateMany).toHaveBeenCalledWith({
      where: {
        id: 'booking-1',
        status: { in: [BookingStatus.PNR_CREATED, BookingStatus.SEATS_SELECTED] },
      },
      data: expect.objectContaining({
        totalPrice: 11200,
        snapshot: expect.objectContaining({
          pricing: updatedPricing,
          offer: expect.objectContaining({
            price: expect.objectContaining({
              total: '11200.00',
              grandTotal: '11200.00',
            }),
          }),
        }),
      }),
    });
    expect(outbox.enqueue).toHaveBeenCalledWith(prisma, {
      aggregateId: 'booking-1',
      aggregateType: 'Booking',
      topic: CHECKOUT_CLEANUP_OUTBOX_TOPIC,
      key: 'booking-1:checkout-cleanup',
      payload: {
        bookingId: 'booking-1',
        userId: 'user-1',
        searchId: 'search-1',
        offerId: 'offer-1',
      },
      transport: EnumTransport.INTERNAL,
    });
    expect(searchStore.deleteSeatMap).not.toHaveBeenCalled();
    expect(result).toEqual({ paymentRedirectUrl: 'https://pay.example/checkout' });
  });

  it('reverts seat assignment when payment creation fails', async () => {
    prisma.booking.findFirst.mockResolvedValue({
      ...booking,
      totalPrice: 10000,
    });
    pricingProvider.price.mockResolvedValue({
      price: { total: 10500, seats: 500, currency: 'RUB' },
    });
    bookingSeatService.assignSeats.mockResolvedValue(undefined);
    prisma.booking.updateMany.mockResolvedValue({ count: 1 });
    bookingPaymentService.createPayment.mockRejectedValue(new Error('payment failed'));
    seatReleaseService.revertCheckoutPreparation.mockResolvedValue(undefined);
    bookingsCache.invalidateBooking.mockResolvedValue(undefined);

    await expect(
      service.checkout(
        'booking-1',
        {
          searchId: 'search-1',
          offerId: 'offer-1',
          seats: [{ travelerId: 'trav-1', segmentId: 'seg-1', seatNumber: '12A' }],
        },
        'user-1',
      ),
    ).rejects.toThrow('payment failed');

    expect(seatReleaseService.revertCheckoutPreparation).toHaveBeenCalledWith('booking-1');
    expect(bookingPaymentService.cancelPendingPayment).not.toHaveBeenCalled();
    expect(prisma.booking.updateMany).toHaveBeenLastCalledWith({
      where: {
        id: 'booking-1',
        userId: 'user-1',
        status: { in: [BookingStatus.PNR_CREATED, BookingStatus.SEATS_SELECTED] },
      },
      data: {
        totalPrice: 10000,
        snapshot: booking.snapshot,
      },
    });
    expect(searchStore.deleteSeatMap).not.toHaveBeenCalled();
    expect(bookingsCache.invalidateBooking).toHaveBeenCalledWith('booking-1', 'user-1');
  });

  it('reverts seat assignment when pricing update fails', async () => {
    prisma.booking.findFirst.mockResolvedValue({
      ...booking,
      totalPrice: 10000,
    });
    pricingProvider.price.mockResolvedValue({
      price: { total: 10500, seats: 500, currency: 'RUB' },
    });
    bookingSeatService.assignSeats.mockResolvedValue(undefined);
    prisma.booking.updateMany.mockRejectedValue(new Error('pricing update failed'));
    seatReleaseService.revertCheckoutPreparation.mockResolvedValue(undefined);
    bookingsCache.invalidateBooking.mockResolvedValue(undefined);

    await expect(
      service.checkout(
        'booking-1',
        {
          searchId: 'search-1',
          offerId: 'offer-1',
          seats: [{ travelerId: 'trav-1', segmentId: 'seg-1', seatNumber: '12A' }],
        },
        'user-1',
      ),
    ).rejects.toThrow('pricing update failed');

    expect(seatReleaseService.revertCheckoutPreparation).toHaveBeenCalledWith('booking-1');
    expect(bookingPaymentService.createPayment).not.toHaveBeenCalled();
    expect(bookingsCache.invalidateBooking).toHaveBeenCalledWith('booking-1', 'user-1');
  });

  it('fails checkout when checkout cleanup cannot be enqueued in payment transaction', async () => {
    prisma.booking.findFirst.mockResolvedValue({
      ...booking,
      totalPrice: 10000,
    });
    pricingProvider.price.mockResolvedValue({
      price: { total: 10500, seats: 500, currency: 'RUB' },
    });
    bookingSeatService.assignSeats.mockResolvedValue(undefined);
    prisma.booking.updateMany.mockResolvedValue({ count: 1 });
    bookingPaymentService.createPayment.mockImplementation(
      async (
        _bookingId: string,
        _userId: string,
        options?: { afterPaymentPending?: (tx: unknown) => Promise<void> },
      ) => {
        if (options?.afterPaymentPending) {
          await options.afterPaymentPending(prisma);
        }
        return { redirectUrl: 'https://pay.example/checkout' };
      },
    );
    outbox.enqueue.mockRejectedValue(new Error('outbox enqueue failed'));
    bookingsCache.invalidateBooking.mockResolvedValue(undefined);

    await expect(
      service.checkout(
        'booking-1',
        {
          searchId: 'search-1',
          offerId: 'offer-1',
          seats: [{ travelerId: 'trav-1', segmentId: 'seg-1', seatNumber: '12A' }],
        },
        'user-1',
      ),
    ).rejects.toThrow('outbox enqueue failed');

    expect(bookingPaymentService.cancelPendingPayment).not.toHaveBeenCalled();
    expect(seatReleaseService.revertCheckoutPreparation).toHaveBeenCalledWith('booking-1');
  });

  it('skips pricing rollback when another checkout already reached PAYMENT_PENDING', async () => {
    searchStore.getSeatMap.mockResolvedValue({ unavailable: true, seatMaps: [] });
    prisma.booking.findFirst
      .mockResolvedValueOnce(booking)
      .mockResolvedValueOnce(booking)
      .mockResolvedValueOnce(booking)
      .mockResolvedValueOnce(booking)
      .mockResolvedValueOnce({ status: BookingStatus.PAYMENT_PENDING });
    prisma.booking.updateMany.mockResolvedValue({ count: 1 });
    pricingProvider.price.mockResolvedValue({
      price: {
        total: 10000,
        seats: 0,
        base: 0,
        taxes: 0,
        fees: 0,
        currency: 'RUB',
        taxItems: [],
        feeItems: [],
      },
      travelers: [],
      outbound: { segments: [] },
    });
    bookingPaymentService.createPayment.mockRejectedValue(new Error('payment failed'));
    bookingsCache.invalidateBooking.mockResolvedValue(undefined);

    await expect(
      service.checkout(
        'booking-1',
        {
          searchId: 'search-1',
          offerId: 'offer-1',
          seats: [],
        },
        'user-1',
      ),
    ).rejects.toThrow('payment failed');

    expect(prisma.booking.updateMany).toHaveBeenCalledTimes(1);
    expect(seatReleaseService.revertCheckoutPreparation).not.toHaveBeenCalled();
    expect(bookingPaymentService.cancelPendingPayment).not.toHaveBeenCalled();
    expect(logger.warn).toHaveBeenCalledWith(
      expect.objectContaining({ bookingId: 'booking-1' }),
      'Skipping checkout rollback because booking left checkout states',
    );
  });

  it('allows checkout with empty seats when persisted assignments are complete', async () => {
    searchStore.getSeatMap.mockResolvedValue(null);
    seatMapsService.getSeatMapByOffer.mockResolvedValue({ unavailable: false, seatMaps: [] });
    prisma.booking.findFirst.mockResolvedValue({
      ...booking,
      status: BookingStatus.SEATS_SELECTED,
      seatAssignments: [
        {
          travelerId: 'trav-1',
          segmentId: 'seg-1',
          seat: { seatNumber: '12A' },
        },
      ],
    });
    pricingProvider.price.mockResolvedValue({
      price: {
        total: 10500,
        seats: 500,
        base: 0,
        taxes: 0,
        fees: 0,
        currency: 'RUB',
        taxItems: [],
        feeItems: [],
      },
      travelers: [],
      outbound: { segments: [] },
    });
    prisma.booking.updateMany.mockResolvedValue({ count: 1 });
    bookingPaymentService.createPayment.mockImplementation(
      async (
        _bookingId: string,
        _userId: string,
        options?: { afterPaymentPending?: (tx: unknown) => Promise<void> },
      ) => {
        if (options?.afterPaymentPending) {
          await options.afterPaymentPending(prisma);
        }
        return { redirectUrl: 'https://pay.example/checkout' };
      },
    );
    bookingsCache.invalidateBooking.mockResolvedValue(undefined);

    const result = await service.checkout(
      'booking-1',
      {
        searchId: 'search-1',
        offerId: 'offer-1',
        seats: [],
      },
      'user-1',
    );

    expect(pricingProvider.price).toHaveBeenCalledWith('search-1', 'offer-1', {
      seats: [{ travelerId: 'trav-1', segmentId: 'seg-1', seatNumber: '12A' }],
      bookingId: 'booking-1',
    });
    expect(bookingSeatService.assignSeats).not.toHaveBeenCalled();
    expect(searchStore.getSeatMap).not.toHaveBeenCalled();
    expect(seatMapsService.getSeatMapByOffer).not.toHaveBeenCalled();
    expect(result).toEqual({ paymentRedirectUrl: 'https://pay.example/checkout' });
  });

  it('uses snapshot seatSelectionRequired without loading seat map from redis', async () => {
    searchStore.getSeatMap.mockResolvedValue(null);
    prisma.booking.findFirst.mockResolvedValue({
      ...booking,
      snapshot: {
        ...booking.snapshot,
        seatSelectionRequired: false,
      },
    });
    pricingProvider.price.mockResolvedValue({
      price: {
        total: 10000,
        seats: 0,
        base: 0,
        taxes: 0,
        fees: 0,
        currency: 'RUB',
        taxItems: [],
        feeItems: [],
      },
      travelers: [],
      outbound: { segments: [] },
    });
    prisma.booking.updateMany.mockResolvedValue({ count: 1 });
    bookingPaymentService.createPayment.mockImplementation(
      async (
        _bookingId: string,
        _userId: string,
        options?: { afterPaymentPending?: (tx: unknown) => Promise<void> },
      ) => {
        if (options?.afterPaymentPending) {
          await options.afterPaymentPending(prisma);
        }
        return { redirectUrl: 'https://pay.example/checkout' };
      },
    );
    searchStore.deleteSeatMap.mockResolvedValue(undefined);
    bookingsCache.invalidateBooking.mockResolvedValue(undefined);

    await service.checkout(
      'booking-1',
      {
        searchId: 'search-1',
        offerId: 'offer-1',
        seats: [],
      },
      'user-1',
    );

    expect(searchStore.getSeatMap).not.toHaveBeenCalled();
    expect(seatMapsService.getSeatMapByOffer).not.toHaveBeenCalled();
  });

  it('rejects checkout when payment is already pending', async () => {
    prisma.booking.findFirst.mockResolvedValue({
      ...booking,
      status: BookingStatus.PAYMENT_PENDING,
    });

    await expect(
      service.checkout(
        'booking-1',
        {
          searchId: 'search-1',
          offerId: 'offer-1',
          seats: [],
        },
        'user-1',
      ),
    ).rejects.toThrow('Checkout is already in progress');

    expect(pricingProvider.price).not.toHaveBeenCalled();
    expect(bookingPaymentService.createPayment).not.toHaveBeenCalled();
  });
});

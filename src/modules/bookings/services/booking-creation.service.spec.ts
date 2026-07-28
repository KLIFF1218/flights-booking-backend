import { NotFoundException } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import { BookingStatus, Currency, EnumTransport, FlightStatus } from '@prisma/client';
import { BookingCreationService } from './booking-creation.service';
import { PrismaService } from 'src/infra/db/prisma/prisma.service';
import { Logger } from 'nestjs-pino';
import { FlightsSearchStore } from 'src/modules/flights/services/flights-cache.service';
import { FLIGHT_PRICING_PROVIDER } from 'src/modules/flights/providers/flight-pricing.provider';
import { MetricsService } from 'src/infra/metrics/metrics.service';
import { BookingMetricsService } from '../metrics/booking-metrics.service';
import { SeatMapsService } from 'src/modules/seatmaps/services/seatmap.service';
import { OutboxService } from 'src/infra/outbox/outbox.service';
import { createBookingMetricsMock } from '../metrics/booking-metrics.mock';

describe('BookingCreationService', () => {
  let service: BookingCreationService;
  let module: TestingModule;
  let prisma: any;
  let searchStore: any;
  let pricingProvider: { price: jest.Mock };
  let outbox: { enqueue: jest.Mock };
  let bookingMetrics: ReturnType<typeof createBookingMetricsMock>;

  const flightOffer = {
    id: 'offer-1',
    price: { currency: 'USD', total: '250.00' },
  };

  const originalOffer = {
    id: 'offer-1',
    itineraries: [
      {
        segments: [{ id: 'seg-1', flightInstanceId: 'fi-1', carrierCode: 'DL' }],
      },
    ],
  };

  const flightInstance = {
    id: 'fi-1',
    status: FlightStatus.SCHEDULED,
    fares: [],
    seats: [],
    flight: { airline: { code: 'DL' } },
  };

  beforeEach(async () => {
    prisma = {
      flightInstance: { findMany: jest.fn() },
      $transaction: jest.fn(),
    };
    searchStore = {
      getOffer: jest.fn(),
      getLastPricing: jest.fn().mockResolvedValue(null),
    };
    pricingProvider = {
      price: jest.fn().mockResolvedValue({
        price: { total: '250.00', currency: Currency.USD },
        travelers: [{ travelerType: 'ADULT' }],
      }),
    };
    outbox = { enqueue: jest.fn().mockResolvedValue({ id: 'outbox-1' }) };
    bookingMetrics = createBookingMetricsMock();

    module = await Test.createTestingModule({
      providers: [
        BookingCreationService,
        { provide: PrismaService, useValue: prisma },
        { provide: Logger, useValue: { debug: jest.fn() } },
        { provide: FlightsSearchStore, useValue: searchStore },
        { provide: FLIGHT_PRICING_PROVIDER, useValue: pricingProvider },
        { provide: MetricsService, useValue: { recordBookingValue: jest.fn() } },
        { provide: BookingMetricsService, useValue: bookingMetrics },
        {
          provide: SeatMapsService,
          useValue: { getSeatMapByOffer: jest.fn().mockResolvedValue({ unavailable: true }) },
        },
        { provide: OutboxService, useValue: outbox },
      ],
    }).compile();

    service = module.get(BookingCreationService);
  });

  afterEach(async () => {
    await module?.close();
  });

  it('throws when cached offer is missing', async () => {
    searchStore.getOffer.mockResolvedValue(null);

    await expect(
      service.createBooking('user-1', flightOffer as any, 'search-1', 'offer-1'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('creates booking, reserves inventory, and enqueues booking.created', async () => {
    searchStore.getOffer.mockResolvedValue(originalOffer);
    prisma.flightInstance.findMany.mockResolvedValue([flightInstance]);

    const tx = {
      booking: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({
          id: 'booking-1',
          status: BookingStatus.PNR_CREATED,
        }),
      },
      flightInstance: {
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
    };
    prisma.$transaction.mockImplementation(async (cb: (t: typeof tx) => Promise<unknown>) =>
      cb(tx),
    );

    const result = await service.createBooking('user-1', flightOffer as any, 'search-1', 'offer-1');

    expect(result.id).toBe('booking-1');
    expect(tx.flightInstance.updateMany).toHaveBeenCalled();
    expect(outbox.enqueue).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({
        topic: 'booking.created',
        transport: EnumTransport.KAFKA,
        aggregateId: 'booking-1',
      }),
    );
    expect(bookingMetrics.recordBookingCreated).toHaveBeenCalled();
  });

  it('records inventory failure metric when seats are unavailable', async () => {
    searchStore.getOffer.mockResolvedValue(originalOffer);
    prisma.flightInstance.findMany.mockResolvedValue([flightInstance]);

    const tx = {
      flightInstance: {
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
    };
    prisma.$transaction.mockImplementation(async (cb: (t: typeof tx) => Promise<unknown>) =>
      cb(tx),
    );

    await expect(
      service.createBooking('user-1', flightOffer as any, 'search-1', 'offer-1'),
    ).rejects.toThrow();

    expect(bookingMetrics.recordInventoryReservationFailed).toHaveBeenCalled();
    expect(bookingMetrics.recordOperationFailed).toHaveBeenCalledWith('create', expect.any(String));
  });
});

import { Test, type TestingModule } from '@nestjs/testing';
import { BookingStatus } from '@prisma/client';
import { BookingsCacheService } from '../lifecycle/bookings-cache.service';
import { RedisService } from 'src/infra/redis/redis.service';
import { BookingMetricsService } from '../../metrics/booking-metrics.service';
import { createBookingMetricsMock } from '../../metrics/booking-metrics.mock';

describe('BookingsCacheService', () => {
  let service: BookingsCacheService;
  let module: TestingModule;
  let redis: {
    set: jest.Mock;
    get: jest.Mock;
    delete: jest.Mock;
    delByPrefix: jest.Mock;
  };

  beforeEach(async () => {
    redis = {
      set: jest.fn().mockResolvedValue('OK'),
      get: jest.fn().mockResolvedValue(null),
      delete: jest.fn().mockResolvedValue(1),
      delByPrefix: jest.fn().mockResolvedValue(2),
    };

    module = await Test.createTestingModule({
      providers: [
        BookingsCacheService,
        { provide: RedisService, useValue: redis },
        { provide: BookingMetricsService, useValue: createBookingMetricsMock() },
      ],
    }).compile();

    service = module.get(BookingsCacheService);
  });

  afterEach(async () => {
    await module?.close();
  });

  it('saves and reads user bookings list', async () => {
    const payload = { bookings: [], total: 0, page: 1, limit: 20 };
    await service.saveUserBookingsList('user-1', 1, 20, payload);
    redis.get.mockResolvedValueOnce(payload);

    await expect(service.getUserBookingsList('user-1', 1, 20)).resolves.toEqual(payload);
    expect(redis.set).toHaveBeenCalledWith(
      'bookings:user:user-1:1:20',
      payload,
      expect.any(Number),
    );
  });

  it('invalidates booking detail and user list caches', async () => {
    const metrics = createBookingMetricsMock();
    const invalidateModule = await Test.createTestingModule({
      providers: [
        BookingsCacheService,
        { provide: RedisService, useValue: redis },
        { provide: BookingMetricsService, useValue: metrics },
      ],
    }).compile();
    const svc = invalidateModule.get(BookingsCacheService);

    await svc.invalidateBooking('booking-1', 'user-1');

    expect(redis.delete).toHaveBeenCalledWith('bookings:detail:booking-1');
    expect(redis.delByPrefix).toHaveBeenCalledWith('bookings:user:user-1:');
    expect(metrics.recordCacheInvalidation).toHaveBeenCalledTimes(2);

    await invalidateModule.close();
  });

  it('skips caching non-cacheable booking details', async () => {
    await service.saveBookingDetail('booking-1', { status: BookingStatus.PAYMENT_PENDING });

    expect(redis.set).not.toHaveBeenCalled();
  });

  it('caches canceled booking details with stable ttl', async () => {
    await service.saveBookingDetail('booking-1', { status: BookingStatus.CANCELED });

    expect(redis.set).toHaveBeenCalledWith(
      'bookings:detail:booking-1',
      { status: BookingStatus.CANCELED },
      expect.any(Number),
    );
  });
});

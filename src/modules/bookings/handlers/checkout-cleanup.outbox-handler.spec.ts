import { Test, type TestingModule } from '@nestjs/testing';
import { Logger } from 'nestjs-pino';
import { CheckoutCleanupOutboxHandler } from './checkout-cleanup.outbox-handler';
import { FlightsSearchStore } from 'src/modules/flights/services/cache/flights-cache.service';
import { BookingsCacheService } from '../services/lifecycle/bookings-cache.service';

describe('CheckoutCleanupOutboxHandler', () => {
  let handler: CheckoutCleanupOutboxHandler;
  let module: TestingModule;
  const searchStore = { deleteSeatMap: jest.fn() };
  const bookingsCache = { invalidateBooking: jest.fn() };

  beforeEach(async () => {
    jest.clearAllMocks();

    module = await Test.createTestingModule({
      providers: [
        CheckoutCleanupOutboxHandler,
        { provide: FlightsSearchStore, useValue: searchStore },
        { provide: BookingsCacheService, useValue: bookingsCache },
        { provide: Logger, useValue: { debug: jest.fn() } },
      ],
    }).compile();

    handler = module.get(CheckoutCleanupOutboxHandler);
  });

  afterEach(async () => {
    await module?.close();
  });

  it('deletes seat map cache and invalidates booking caches', async () => {
    await handler.handle({
      bookingId: 'b1',
      userId: 'u1',
      searchId: 'search-1',
      offerId: 'offer-1',
    });

    expect(searchStore.deleteSeatMap).toHaveBeenCalledWith('search-1', 'offer-1');
    expect(bookingsCache.invalidateBooking).toHaveBeenCalledWith('b1', 'u1');
  });
});

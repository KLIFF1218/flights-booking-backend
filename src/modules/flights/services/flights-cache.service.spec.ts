import { Test, type TestingModule } from '@nestjs/testing';
import { FlightsSearchStore } from './flights-cache.service';
import { RedisService } from 'src/infra/redis/redis.service';

describe('FlightsSearchStore', () => {
  let service: FlightsSearchStore;
  let module: TestingModule;
  let redis: {
    get: jest.Mock;
    set: jest.Mock;
    setIfNotExists: jest.Mock;
    delete: jest.Mock;
    getClient: jest.Mock;
  };

  beforeEach(async () => {
    redis = {
      get: jest.fn(),
      set: jest.fn(),
      setIfNotExists: jest.fn(),
      delete: jest.fn(),
      getClient: jest.fn(),
    };

    module = await Test.createTestingModule({
      providers: [FlightsSearchStore, { provide: RedisService, useValue: redis }],
    }).compile();

    service = module.get(FlightsSearchStore);
  });

  afterEach(async () => {
    await module.close();
  });

  it('saves and reads search results', async () => {
    const context = {
      passengers: { adults: 1, children: 0, infants: 0, seatedInfants: 0 },
      travelClass: 'ECONOMY' as const,
    };

    await service.saveSearchResults('search-1', [], 'hash-1', context, 300);

    expect(redis.set).toHaveBeenCalledWith(
      'flights:search:search-1',
      expect.objectContaining({ queryHash: 'hash-1', context }),
      300,
    );
  });

  it('loads search results by search id', async () => {
    const payload = {
      offers: [{ id: 'offer-1' }],
      expiresAt: '2026-01-01T00:00:00.000Z',
      queryHash: 'hash-1',
    };
    redis.get.mockResolvedValue(payload);

    await expect(service.getSearchResults('search-1')).resolves.toEqual(payload);
  });

  it('acquires search lock via setIfNotExists', async () => {
    redis.setIfNotExists.mockResolvedValue(true);

    await expect(service.acquireSearchLock('query-key')).resolves.toBe(true);
    expect(redis.setIfNotExists).toHaveBeenCalledWith('flights:search:lock:query-key', '1', 60);
  });

  it('maps query key to search id', async () => {
    redis.get.mockResolvedValue('search-42');

    await expect(service.getSearchIdByQuery('query-key')).resolves.toBe('search-42');
  });

  it('deletes search results by search id', async () => {
    redis.delete.mockResolvedValue(1);

    await service.deleteSearchResults('search-1');

    expect(redis.delete).toHaveBeenCalledWith('flights:search:search-1');
  });

  it('saves and loads last pricing quote', async () => {
    const quote = { id: 'offer-1', quoteId: 'q-1', price: { total: 100 } };
    redis.get.mockResolvedValueOnce(quote);

    await service.saveLastPricing('search-1', 'offer-1', quote as any, 120);
    await expect(service.getLastPricing('search-1', 'offer-1')).resolves.toEqual(quote);

    expect(redis.set).toHaveBeenCalledWith('flights:pricing:last:search-1:offer-1', quote, 120);
  });

  it('saves and loads seat map cache', async () => {
    const seatMap = { unavailable: false, seatMaps: [] };
    redis.get.mockResolvedValueOnce(seatMap);

    await service.saveSeatMap('search-1', 'offer-1', seatMap, 300);
    await expect(service.getSeatMap('search-1', 'offer-1')).resolves.toEqual(seatMap);

    expect(redis.set).toHaveBeenCalledWith('flights:seatmap:search-1:offer-1', seatMap, 300);
  });

  it('mutates cached offers via redis scan', async () => {
    const client = {
      scan: jest
        .fn()
        .mockResolvedValueOnce(['0', ['flights:search:search-1']])
        .mockResolvedValue(['0', []]),
      ttl: jest.fn().mockResolvedValue(120),
    };
    redis.getClient.mockReturnValue(client);
    redis.get.mockResolvedValue({
      offers: [{ id: 'offer-1' }],
      expiresAt: '2026-12-31T00:00:00.000Z',
      queryHash: 'hash-1',
    });

    await service.mutateCachedOffers(async (_searchId, cached) => ({
      ...cached,
      offers: [],
    }));

    expect(client.scan).toHaveBeenCalled();
    expect(redis.set).toHaveBeenCalledWith(
      'flights:search:search-1',
      expect.objectContaining({ offers: [] }),
      120,
    );
  });
});

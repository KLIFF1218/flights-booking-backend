import { Test, type TestingModule } from '@nestjs/testing';
import { ConflictException, NotFoundException } from '@nestjs/common';
import {
  Currency,
  SeatType,
  TravelClass,
} from '@prisma/client';
import { SeatMapsService } from './seatmap.service';
import { FlightsSearchStore } from '../../flights/services/flights-cache.service';
import { PrismaService } from 'src/infra/db/prisma/prisma.service';
import { MetricsService } from 'src/infra/metrics/metrics.service';
import { SeatFeature } from '../dtos/seatmap.dto';
import {
  convertCurrencyWithRates,
  setCurrencyRates,
} from 'src/modules/flights/utils/currency.util';

const dto = { searchId: 'search-1', offerId: 'offer-1' };

const baseOffer = {
  id: 'offer-1',
  currencyCode: Currency.USD,
  price: { currency: Currency.USD },
  itineraries: [
    {
      segments: [{ id: 'seg-1', flightInstanceId: 'fi-1' }],
    },
  ],
};

function buildFlightInstance(
  overrides: {
    seats?: Array<Record<string, unknown>>;
    layout?: Record<string, unknown> | null;
    fares?: Array<{ currency: Currency }>;
    aircraftCode?: string;
  } = {},
) {
  return {
    id: 'fi-1',
    aircraft: {
      code: overrides.aircraftCode ?? 'A320',
      aircraftLayout: overrides.layout === null
        ? null
        : {
            width: 3,
            length: 2,
            facilities: [{ x: 2, y: 0, type: 'LAVATORY' }],
            ...(overrides.layout ?? {}),
          },
    },
    fares: overrides.fares ?? [{ currency: Currency.USD }],
    seats: overrides.seats ?? [
      {
        id: 'seat-1',
        seatNumber: '1A',
        x: 0,
        y: 0,
        status: 'AVAILABLE',
        seatType: SeatType.WINDOW,
        deck: 1,
        price: 25,
        isExitRow: true,
        isExtraLegroom: true,
        isPremium: true,
        travelClass: TravelClass.ECONOMY,
        seatHolds: [],
        seatAssignments: [],
      },
      {
        id: 'seat-2',
        seatNumber: '1B',
        x: 1,
        y: 0,
        status: 'BOOKED',
        seatType: SeatType.MIDDLE,
        deck: 1,
        price: 20,
        isExitRow: false,
        isExtraLegroom: false,
        isPremium: false,
        travelClass: TravelClass.ECONOMY,
        seatHolds: [],
        seatAssignments: [],
      },
    ],
  };
}

describe('SeatMapsService', () => {
  let service: SeatMapsService;
  let module: TestingModule;

  const searchStore = {
    getOffer: jest.fn(),
    getLastPricing: jest.fn(),
    saveSeatMap: jest.fn(),
  };
  const prisma = {
    flightInstance: {
      findMany: jest.fn(),
    },
  };
  const metrics = {
    updateSeatsAvailable: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    setCurrencyRates({ USD: 1, EUR: 0.92, RUB: 90 });
    searchStore.getOffer.mockResolvedValue(baseOffer);
    searchStore.getLastPricing.mockResolvedValue(null);
    searchStore.saveSeatMap.mockResolvedValue(undefined);
    prisma.flightInstance.findMany.mockResolvedValue([buildFlightInstance()]);

    module = await Test.createTestingModule({
      providers: [
        SeatMapsService,
        { provide: FlightsSearchStore, useValue: searchStore },
        { provide: PrismaService, useValue: prisma },
        { provide: MetricsService, useValue: metrics },
      ],
    }).compile();

    service = module.get(SeatMapsService);
  });

  afterEach(async () => {
    await module?.close();
  });

  it('throws NotFoundException when offer is missing', async () => {
    searchStore.getOffer.mockResolvedValue(null);

    await expect(service.getSeatMap(dto)).rejects.toThrow(NotFoundException);
  });

  it('getSeatMapByOffer validates offer before building seat map', async () => {
    searchStore.getOffer.mockResolvedValueOnce(null);

    await expect(service.getSeatMapByOffer(dto)).rejects.toThrow(NotFoundException);
    expect(searchStore.saveSeatMap).not.toHaveBeenCalled();
  });

  it('returns unavailable when offer has no configured flight instances', async () => {
    searchStore.getOffer.mockResolvedValue({
      ...baseOffer,
      itineraries: [{ segments: [{ id: 'seg-1', flightInstanceId: null }] }],
    });

    await expect(service.getSeatMap(dto)).resolves.toEqual({
      unavailable: true,
      seatMaps: [],
    });
    expect(prisma.flightInstance.findMany).not.toHaveBeenCalled();
  });

  it('throws ConflictException when flight instance is missing in database', async () => {
    prisma.flightInstance.findMany.mockResolvedValue([]);

    await expect(service.getSeatMap(dto)).rejects.toThrow(
      new ConflictException('Flight instance is not configured'),
    );
  });

  it('returns unavailable when flight instance has no seats', async () => {
    prisma.flightInstance.findMany.mockResolvedValue([buildFlightInstance({ seats: [] })]);

    await expect(service.getSeatMap(dto)).resolves.toEqual({
      unavailable: true,
      seatMaps: [],
    });
  });

  it('throws ConflictException when aircraft layout is missing', async () => {
    prisma.flightInstance.findMany.mockResolvedValue([
      buildFlightInstance({ layout: null }),
    ]);

    await expect(service.getSeatMap(dto)).rejects.toThrow(
      new ConflictException('Aircraft layout is not configured'),
    );
  });

  it('throws ConflictException when fare currency is missing', async () => {
    prisma.flightInstance.findMany.mockResolvedValue([buildFlightInstance({ fares: [] })]);

    await expect(service.getSeatMap(dto)).rejects.toThrow(
      new ConflictException('Fare currency is not configured for this flight'),
    );
  });

  it('throws ConflictException when seat is out of layout bounds', async () => {
    prisma.flightInstance.findMany.mockResolvedValue([
      buildFlightInstance({
        seats: [
          {
            id: 'seat-bad',
            seatNumber: '99Z',
            x: 5,
            y: 0,
            status: 'AVAILABLE',
            seatType: SeatType.MIDDLE,
            deck: 1,
            price: 10,
            isExitRow: false,
            isExtraLegroom: false,
            isPremium: false,
            travelClass: TravelClass.ECONOMY,
            seatHolds: [],
            seatAssignments: [],
          },
        ],
      }),
    ]);

    await expect(service.getSeatMap(dto)).rejects.toThrow(/out of bounds/);
  });

  it('throws ConflictException on seat collision', async () => {
    prisma.flightInstance.findMany.mockResolvedValue([
      buildFlightInstance({
        seats: [
          {
            id: 'seat-1',
            seatNumber: '1A',
            x: 0,
            y: 0,
            status: 'AVAILABLE',
            seatType: SeatType.WINDOW,
            deck: 1,
            price: 10,
            isExitRow: false,
            isExtraLegroom: false,
            isPremium: false,
            travelClass: TravelClass.ECONOMY,
            seatHolds: [],
            seatAssignments: [],
          },
          {
            id: 'seat-2',
            seatNumber: '1B',
            x: 0,
            y: 0,
            status: 'AVAILABLE',
            seatType: SeatType.MIDDLE,
            deck: 1,
            price: 10,
            isExitRow: false,
            isExtraLegroom: false,
            isPremium: false,
            travelClass: TravelClass.ECONOMY,
            seatHolds: [],
            seatAssignments: [],
          },
        ],
      }),
    ]);

    await expect(service.getSeatMap(dto)).rejects.toThrow(/Seat collision/);
  });

  it('builds seat map, caches result, and records metrics', async () => {
    const result = await service.getSeatMap(dto);

    expect(result.unavailable).toBe(false);
    expect(result.seatMaps).toHaveLength(1);
    expect(result.seatMaps[0]).toMatchObject({
      segmentId: 'seg-1',
      aircraft: 'A320',
      availableSeatsCount: 1,
    });

    const availableSeat = result.seatMaps[0].grid[0][0];
    expect(availableSeat).toMatchObject({
      type: 'SEAT',
      seatNumber: '1A',
      isAvailable: true,
      features: [SeatFeature.EXIT_ROW, SeatFeature.EXTRA_LEGROOM, SeatFeature.PREMIUM],
    });

    const bookedSeat = result.seatMaps[0].grid[0][1];
    expect(bookedSeat).toMatchObject({
      type: 'SEAT',
      seatNumber: '1B',
      isAvailable: false,
      minPrice: null,
    });

    expect(result.seatMaps[0].grid[0][2]).toEqual({
      type: 'FACILITY',
      code: 'LAVATORY',
    });

    expect(searchStore.saveSeatMap).toHaveBeenCalledWith('search-1', 'offer-1', result);
    expect(metrics.updateSeatsAvailable).toHaveBeenCalledWith(1, 'A320');
  });

  it('marks seats unavailable when held or assigned for the segment', async () => {
    prisma.flightInstance.findMany.mockResolvedValue([
      buildFlightInstance({
        seats: [
          {
            id: 'seat-held',
            seatNumber: '2A',
            x: 0,
            y: 1,
            status: 'AVAILABLE',
            seatType: SeatType.WINDOW,
            deck: 1,
            price: 10,
            isExitRow: false,
            isExtraLegroom: false,
            isPremium: false,
            travelClass: TravelClass.ECONOMY,
            seatHolds: [{ segmentId: 'seg-1', expiresAt: new Date('2099-01-01') }],
            seatAssignments: [],
          },
          {
            id: 'seat-assigned',
            seatNumber: '2B',
            x: 1,
            y: 1,
            status: 'AVAILABLE',
            seatType: SeatType.AISLE,
            deck: 1,
            price: 10,
            isExitRow: false,
            isExtraLegroom: false,
            isPremium: false,
            travelClass: TravelClass.ECONOMY,
            seatHolds: [],
            seatAssignments: [{ segmentId: 'seg-1' }],
          },
        ],
      }),
    ]);

    const result = await service.getSeatMap(dto);

    expect(result.seatMaps[0].availableSeatsCount).toBe(0);
    expect(result.seatMaps[0].grid[1][0]).toMatchObject({
      seatNumber: '2A',
      isAvailable: false,
      minPrice: null,
    });
    expect(result.seatMaps[0].grid[1][1]).toMatchObject({
      seatNumber: '2B',
      isAvailable: false,
      minPrice: null,
    });
  });

  it('uses quote-locked FX rates from last pricing', async () => {
    const lockedRates = { USD: 1, EUR: 0.92, RUB: 90 };
    searchStore.getLastPricing.mockResolvedValue({ fxRates: lockedRates });
    searchStore.getOffer.mockResolvedValue({
      ...baseOffer,
      currencyCode: Currency.RUB,
    });
    prisma.flightInstance.findMany.mockResolvedValue([
      buildFlightInstance({
        seats: [
          {
            id: 'seat-1',
            seatNumber: '1A',
            x: 0,
            y: 0,
            status: 'AVAILABLE',
            seatType: SeatType.MIDDLE,
            deck: 1,
            price: 9999,
            isExitRow: false,
            isExtraLegroom: false,
            isPremium: false,
            travelClass: TravelClass.ECONOMY,
            seatHolds: [],
            seatAssignments: [],
          },
        ],
      }),
    ]);

    const result = await service.getSeatMap(dto);
    const seat = result.seatMaps[0].grid[0][0];

    expect(seat).toMatchObject({
      type: 'SEAT',
      isAvailable: true,
      minPrice: convertCurrencyWithRates(8, 'USD', 'RUB', lockedRates),
    });
  });
});

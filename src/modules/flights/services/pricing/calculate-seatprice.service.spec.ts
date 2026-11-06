import { BadRequestException } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import { Currency, SeatType } from '@prisma/client';
import { CalculateSeatPrice } from './calculate-seatprice.service';
import { PrismaService } from 'src/infra/db/prisma/prisma.service';

describe('CalculateSeatPrice', () => {
  let service: CalculateSeatPrice;
  let module: TestingModule;

  const prisma = {
    flightSeat: { findMany: jest.fn() },
    seatHold: { findMany: jest.fn() },
  };

  const offer = {
    itineraries: [
      {
        segments: [{ id: 'seg-1', flightInstanceId: 'fi-1' }],
      },
    ],
  };

  const seats = [{ segmentId: 'seg-1', seatNumber: '12A' }];

  const baseSeat = {
    id: 'seat-1',
    flightInstanceId: 'fi-1',
    seatNumber: '12A',
    status: 'AVAILABLE',
    price: 25,
    seatType: SeatType.WINDOW,
    isExitRow: false,
    isExtraLegroom: false,
    isPremium: false,
    travelClass: 'ECONOMY',
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    prisma.seatHold.findMany.mockResolvedValue([]);
    module = await Test.createTestingModule({
      providers: [CalculateSeatPrice, { provide: PrismaService, useValue: prisma }],
    }).compile();
    service = module.get(CalculateSeatPrice);
  });

  afterEach(async () => {
    await module.close();
  });

  it('returns 0 when no seats are selected', async () => {
    await expect(
      service.calculateSeatPrice(offer as any, [], Currency.USD, Currency.USD, { USD: 1 }),
    ).resolves.toBe(0);
    expect(prisma.flightSeat.findMany).not.toHaveBeenCalled();
  });

  it('batch-loads seats and prices an available seat', async () => {
    prisma.flightSeat.findMany.mockResolvedValue([baseSeat]);

    await expect(
      service.calculateSeatPrice(offer as any, seats, Currency.USD, Currency.USD, { USD: 1 }),
    ).resolves.toBeGreaterThan(0);

    expect(prisma.flightSeat.findMany).toHaveBeenCalledWith({
      where: {
        flightInstanceId: { in: ['fi-1'] },
        seatNumber: { in: ['12A'] },
      },
    });
    expect(prisma.seatHold.findMany).toHaveBeenCalled();
  });

  it('allows reserved seat when hold belongs to booking', async () => {
    prisma.flightSeat.findMany.mockResolvedValue([
      { ...baseSeat, status: 'RESERVED', price: 30, seatType: SeatType.MIDDLE },
    ]);
    prisma.seatHold.findMany.mockResolvedValue([
      { flightSeatId: 'seat-1', segmentId: 'seg-1', bookingId: 'booking-1' },
    ]);

    await expect(
      service.calculateSeatPrice(
        offer as any,
        seats,
        Currency.USD,
        Currency.USD,
        { USD: 1 },
        'booking-1',
      ),
    ).resolves.toBeGreaterThan(0);
  });

  it('rejects reserved seat without own booking hold', async () => {
    prisma.flightSeat.findMany.mockResolvedValue([
      { ...baseSeat, status: 'RESERVED', price: 30, seatType: SeatType.MIDDLE },
    ]);
    prisma.seatHold.findMany.mockResolvedValue([
      { flightSeatId: 'seat-1', segmentId: 'seg-1', bookingId: 'other-booking' },
    ]);

    await expect(
      service.calculateSeatPrice(offer as any, seats, Currency.USD, Currency.USD, { USD: 1 }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects seat held by another booking', async () => {
    prisma.flightSeat.findMany.mockResolvedValue([baseSeat]);
    prisma.seatHold.findMany.mockResolvedValue([
      { flightSeatId: 'seat-1', segmentId: 'seg-1', bookingId: 'other-booking' },
    ]);

    await expect(
      service.calculateSeatPrice(offer as any, seats, Currency.USD, Currency.USD, { USD: 1 }),
    ).rejects.toThrow('held by another transaction');
  });
});

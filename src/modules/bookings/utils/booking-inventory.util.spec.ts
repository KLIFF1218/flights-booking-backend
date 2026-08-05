import {
  decrementFlightInstanceInventory,
  releaseFlightInstanceInventory,
  reserveFlightInstanceInventory,
  resolveSeatsToReserve,
} from './booking-inventory.util';
import { extractFlightInstanceIds } from 'src/modules/flights/utils/offer/offer-flight-instances.util';
import type { BookingSnapshot } from '../interfaces/booking-snapshot.interface';

describe('booking-inventory.util', () => {
  const tx = {
    traveler: {
      count: jest.fn(),
    },
    flightInstance: {
      findUnique: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
  };

  const rtSnapshot = {
    offer: {
      id: 'out_in',
      itineraries: [
        {
          segments: [{ id: 'seg-1', flightInstanceId: 'instance-out' }],
        },
        {
          segments: [{ id: 'seg-2', flightInstanceId: 'instance-in' }],
        },
      ],
      travelerPricings: [],
    },
    pricing: {
      travelers: [{}, {}],
    },
  } as unknown as BookingSnapshot;

  beforeEach(() => {
    jest.clearAllMocks();
    tx.traveler.count.mockResolvedValue(2);
    tx.flightInstance.findUnique.mockResolvedValue({
      seatsAvailable: 48,
      _count: { seats: 50 },
    });
    tx.flightInstance.update.mockResolvedValue({});
    tx.flightInstance.updateMany.mockResolvedValue({ count: 1 });
  });

  describe('resolveSeatsToReserve', () => {
    it('uses persisted traveler count when available', () => {
      expect(resolveSeatsToReserve(rtSnapshot, 3)).toBe(3);
    });

    it('falls back to pricing travelers when no persisted travelers', () => {
      expect(resolveSeatsToReserve(rtSnapshot, 0)).toBe(2);
    });

    it('excludes lap infants from pricing traveler count', () => {
      const withInfant = {
        ...rtSnapshot,
        pricing: {
          travelers: [{ travelerType: 'ADULT' }, { travelerType: 'HELD_INFANT' }],
        },
      } as unknown as BookingSnapshot;

      expect(resolveSeatsToReserve(withInfant, 0)).toBe(1);
    });
  });

  describe('reserveFlightInstanceInventory', () => {
    it('atomically decrements seatsAvailable on every flight instance', async () => {
      await reserveFlightInstanceInventory(tx as any, ['instance-out', 'instance-in'], 2);

      expect(tx.flightInstance.updateMany).toHaveBeenCalledTimes(2);
      expect(tx.flightInstance.updateMany).toHaveBeenCalledWith({
        where: {
          id: 'instance-out',
          seatsAvailable: { gte: 2 },
        },
        data: {
          seatsAvailable: { decrement: 2 },
        },
      });
    });
  });

  describe('releaseFlightInstanceInventory', () => {
    it('caps seatsAvailable at physical seat map capacity', async () => {
      await releaseFlightInstanceInventory(tx as any, ['instance-out'], 5);

      expect(tx.flightInstance.update).toHaveBeenCalledWith({
        where: { id: 'instance-out' },
        data: { seatsAvailable: 50 },
      });
    });

    it('increments seatsAvailable when below capacity', async () => {
      tx.flightInstance.findUnique.mockResolvedValue({
        seatsAvailable: 40,
        _count: { seats: 50 },
      });

      await releaseFlightInstanceInventory(tx as any, ['instance-out'], 2);

      expect(tx.flightInstance.update).toHaveBeenCalledWith({
        where: { id: 'instance-out' },
        data: { seatsAvailable: 42 },
      });
    });

    it('does not cap when flight has no seat map rows', async () => {
      tx.flightInstance.findUnique.mockResolvedValue({
        seatsAvailable: 10,
        _count: { seats: 0 },
      });

      await releaseFlightInstanceInventory(tx as any, ['instance-out'], 2);

      expect(tx.flightInstance.update).toHaveBeenCalledWith({
        where: { id: 'instance-out' },
        data: { seatsAvailable: 12 },
      });
    });
  });

  describe('decrementFlightInstanceInventory', () => {
    it('reserves inventory using persisted traveler count', async () => {
      await decrementFlightInstanceInventory(tx as any, 'booking-1', rtSnapshot);

      expect(extractFlightInstanceIds(rtSnapshot.offer)).toEqual(['instance-out', 'instance-in']);
      expect(tx.traveler.count).toHaveBeenCalledWith({
        where: { bookingId: 'booking-1', passengerType: { not: 'HELD_INFANT' } },
      });
      expect(tx.flightInstance.updateMany).toHaveBeenCalledTimes(2);
    });
  });
});

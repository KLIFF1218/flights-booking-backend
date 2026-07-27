import { BadRequestException, NotFoundException } from '@nestjs/common';
import { BookingStatus, EnumTransport } from '@prisma/client';
import { FlightsService } from './admin-flights.service';
import { FlightStatusUpdate } from './dtos/update-flight-status.dto';

describe('Admin FlightsService', () => {
  const prisma = {
    flightInstance: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
    flight: { findMany: jest.fn() },
    booking: { updateMany: jest.fn() },
    $transaction: jest.fn(),
  };
  const logger = { log: jest.fn() };
  const outbox = { enqueue: jest.fn() };
  const scheduleSync = { onFlightInstanceUpdated: jest.fn() };

  const service = new FlightsService(
    prisma as never,
    logger as never,
    outbox as never,
    scheduleSync as never,
  );

  const scheduledFlight = {
    id: 'fi-1',
    status: 'SCHEDULED',
    departureDate: new Date('2026-12-01T10:00:00Z'),
    originalDepartureDate: null,
    delayMinutes: 0,
    bookings: [
      { id: 'b1', userId: 'u1', status: BookingStatus.PAID },
      { id: 'b2', userId: 'u2', status: BookingStatus.CANCELED },
    ],
  };

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.flightInstance.findMany.mockResolvedValue([]);
    prisma.$transaction.mockImplementation(async (cb: (tx: unknown) => unknown) => cb(prisma));
    scheduleSync.onFlightInstanceUpdated.mockResolvedValue(undefined);
  });

  it('returns empty flight templates when search is too short', async () => {
    await expect(service.getFlightTemplates('a')).resolves.toEqual([]);
    expect(prisma.flight.findMany).not.toHaveBeenCalled();
  });

  it('throws NotFoundException when updating missing flight instance', async () => {
    prisma.flightInstance.findUnique.mockResolvedValue(null);

    await expect(
      service.updateStatus('missing', { status: FlightStatusUpdate.COMPLETED }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('requires positive delayMinutes for delayed status', async () => {
    prisma.flightInstance.findUnique.mockResolvedValue(scheduledFlight);

    await expect(
      service.updateStatus('fi-1', { status: FlightStatusUpdate.DELAYED }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('delays flight and publishes flight.delayed events for notifiable bookings', async () => {
    prisma.flightInstance.findUnique.mockResolvedValue(scheduledFlight);
    const updatedFlight = {
      ...scheduledFlight,
      status: 'DELAYED',
      delayMinutes: 30,
      flight: { durationMinutes: 120, airline: {}, departureAirport: {}, arrivalAirport: {} },
      aircraft: null,
      fares: [],
      _count: { bookings: 1 },
    };
    prisma.flightInstance.update.mockResolvedValue(updatedFlight);

    await service.updateStatus('fi-1', {
      status: FlightStatusUpdate.DELAYED,
      delayMinutes: 30,
    });

    expect(outbox.enqueue).toHaveBeenCalledTimes(1);
    expect(outbox.enqueue).toHaveBeenCalledWith(
      prisma,
      expect.objectContaining({
        topic: 'flight.delayed',
        transport: EnumTransport.KAFKA,
        aggregateId: 'b1',
        payload: expect.objectContaining({
          bookingId: 'b1',
          userId: 'u1',
          delayMinutes: 30,
        }),
      }),
    );
    expect(scheduleSync.onFlightInstanceUpdated).toHaveBeenCalledWith('fi-1');
  });

  it('cancels flight, marks bookings failed and publishes flight.cancelled events', async () => {
    prisma.flightInstance.findUnique.mockResolvedValue(scheduledFlight);
    const updatedFlight = {
      ...scheduledFlight,
      status: 'CANCELLED',
      flight: { durationMinutes: 120, airline: {}, departureAirport: {}, arrivalAirport: {} },
      aircraft: null,
      fares: [],
      _count: { bookings: 1 },
    };
    prisma.flightInstance.update.mockResolvedValue(updatedFlight);
    prisma.booking.updateMany.mockResolvedValue({ count: 2 });

    await service.updateStatus('fi-1', { status: FlightStatusUpdate.CANCELLED });

    expect(prisma.booking.updateMany).toHaveBeenCalledWith({
      where: { flightInstanceId: 'fi-1' },
      data: { status: 'FAILED' },
    });
    expect(outbox.enqueue).toHaveBeenCalledWith(
      prisma,
      expect.objectContaining({
        topic: 'flight.cancelled',
        transport: EnumTransport.KAFKA,
        aggregateId: 'b1',
      }),
    );
    expect(scheduleSync.onFlightInstanceUpdated).toHaveBeenCalledWith('fi-1');
  });
});

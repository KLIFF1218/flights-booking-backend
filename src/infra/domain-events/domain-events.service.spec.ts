import { Test } from '@nestjs/testing';
import { Prisma } from '@prisma/client';
import { DomainEventsService } from './domain-events.service';
import { PrismaService } from 'src/infra/db/prisma/prisma.service';
import { Logger } from 'nestjs-pino';

describe('DomainEventsService', () => {
  const prisma = {
    domainEvent: {
      create: jest.fn(),
      findMany: jest.fn(),
    },
  };

  const logger = {
    debug: jest.fn(),
  };

  let service: DomainEventsService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const moduleRef = await Test.createTestingModule({
      providers: [
        DomainEventsService,
        { provide: PrismaService, useValue: prisma },
        { provide: Logger, useValue: logger },
      ],
    }).compile();

    service = moduleRef.get(DomainEventsService);
  });

  it('persists a domain event from Kafka', async () => {
    prisma.domainEvent.create.mockResolvedValue({ id: 'evt-1' });

    const result = await service.persistFromKafka({
      envelope: {
        eventId: 'outbox-1',
        eventType: 'booking.created',
        aggregateType: 'Booking',
        aggregateId: 'booking-1',
        occurredAt: '2026-07-26T10:00:00.000Z',
        schemaVersion: 1,
        payload: { bookingId: 'booking-1', userId: 'user-1' },
      },
      kafkaTopic: 'booking.created',
      kafkaPartition: 0,
      kafkaOffset: '42',
    });

    expect(result).toBe('created');
    expect(prisma.domainEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          bookingId: 'booking-1',
          idempotencyKey: 'booking.created:0:42',
        }),
      }),
    );
  });

  it('treats duplicate Kafka offsets as idempotent', async () => {
    const error = new Prisma.PrismaClientKnownRequestError('duplicate', {
      code: 'P2002',
      clientVersion: 'test',
    });
    prisma.domainEvent.create.mockRejectedValue(error);

    const result = await service.persistFromKafka({
      envelope: {
        eventId: 'outbox-1',
        eventType: 'booking.paid',
        aggregateType: 'Booking',
        aggregateId: 'booking-1',
        occurredAt: '2026-07-26T10:00:00.000Z',
        schemaVersion: 1,
        payload: { bookingId: 'booking-1' },
      },
      kafkaTopic: 'booking.paid',
      kafkaPartition: 0,
      kafkaOffset: '42',
    });

    expect(result).toBe('duplicate');
  });

  it('findByBookingId returns events ordered by occurredAt', async () => {
    prisma.domainEvent.findMany.mockResolvedValue([
      { id: 'evt-1', eventType: 'booking.created' },
      { id: 'evt-2', eventType: 'booking.paid' },
    ]);

    const result = await service.findByBookingId('booking-1');

    expect(prisma.domainEvent.findMany).toHaveBeenCalledWith({
      where: { bookingId: 'booking-1' },
      orderBy: { occurredAt: 'asc' },
    });
    expect(result).toHaveLength(2);
  });
});

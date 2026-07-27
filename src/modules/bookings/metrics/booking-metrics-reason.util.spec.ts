import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  normalizeBookingOutboxTopic,
  resolveBookingMetricReason,
} from './booking-metrics-reason.util';
import { isBookingOutboxTopic } from './booking-metrics.util';

describe('booking metrics reason utils', () => {
  it('maps common HTTP exceptions to bounded reasons', () => {
    expect(resolveBookingMetricReason(new NotFoundException('Booking not found'))).toBe(
      'not_found',
    );
    expect(resolveBookingMetricReason(new BadRequestException('Booking has expired'))).toBe(
      'expired',
    );
    expect(resolveBookingMetricReason(new BadRequestException('Seat already reserved'))).toBe(
      'seat_unavailable',
    );
    expect(resolveBookingMetricReason(new BadRequestException('Not enough seats'))).toBe(
      'inventory_unavailable',
    );
    expect(resolveBookingMetricReason(new ConflictException('Status conflict'))).toBe(
      'status_conflict',
    );
  });

  it('maps prisma conflicts to db_conflict', () => {
    const error = new Prisma.PrismaClientKnownRequestError('duplicate', {
      code: 'P2002',
      clientVersion: '5.0.0',
    });

    expect(resolveBookingMetricReason(error)).toBe('db_conflict');
  });

  it('normalizes booking outbox topics', () => {
    expect(normalizeBookingOutboxTopic('payment.pending.cancel')).toBe('payment.pending.cancel');
    expect(normalizeBookingOutboxTopic('booking.paid')).toBe('booking.paid');
    expect(normalizeBookingOutboxTopic('some.other.topic')).toBe('other');
    expect(isBookingOutboxTopic('payment.pending.cancel')).toBe(true);
    expect(isBookingOutboxTopic('some.other.topic')).toBe(false);
  });
});

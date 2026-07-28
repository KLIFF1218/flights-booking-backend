import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from 'src/infra/db/prisma/prisma.service';
import { Logger } from 'nestjs-pino';
import type { DomainEventEnvelope } from 'src/infra/kafka/domain-event-envelope.util';
import { resolveBookingIdFromEnvelope } from 'src/infra/kafka/domain-event-envelope.util';
import {
  formatAnalyticsDateLabel,
  incrementsForEventType,
  isAnalyticsEventType,
  toUtcDateOnly,
} from './booking-analytics.util';

export type EventAnalyticsDailyRow = {
  date: string;
  bookingsCreated: number;
  paymentsSucceeded: number;
  paymentsFailed: number;
  bookingsCanceled: number;
  bookingsExpired: number;
  ticketsIssued: number;
  ticketingFailed: number;
  flightsDelayed: number;
  flightsCancelled: number;
  paymentVolume: number;
};

export type EventAnalyticsSummary = {
  periodDays: number;
  health: {
    lastEventAt: string | null;
    processedEventCount: number;
  };
  counts: {
    bookingsCreated: number;
    paymentsSucceeded: number;
    paymentsFailed: number;
    bookingsCanceled: number;
    bookingsExpired: number;
    ticketsIssued: number;
    ticketingFailed: number;
    flightsDelayed: number;
    flightsCancelled: number;
  };
  conversionRate: number;
  ticketRate: number;
  paymentVolume: number;
  dailyActivity: EventAnalyticsDailyRow[];
};

@Injectable()
export class DomainAnalyticsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly logger: Logger,
  ) {}

  async applyDomainEvent(
    envelope: DomainEventEnvelope,
  ): Promise<'applied' | 'duplicate' | 'skipped'> {
    if (!isAnalyticsEventType(envelope.eventType)) {
      return 'skipped';
    }

    const occurredAt = new Date(envelope.occurredAt);
    const paymentVolume = await this.resolvePaymentVolume(envelope);
    const increments = incrementsForEventType(envelope.eventType, paymentVolume);
    const date = toUtcDateOnly(occurredAt);

    try {
      await this.prisma.$transaction(async (tx) => {
        await tx.processedAnalyticsEvent.create({
          data: {
            eventId: envelope.eventId,
            eventType: envelope.eventType,
            occurredAt,
          },
        });

        await tx.bookingAnalyticsDaily.upsert({
          where: { date },
          create: {
            date,
            ...increments,
          },
          update: {
            bookingsCreated: { increment: increments.bookingsCreated },
            paymentsSucceeded: { increment: increments.paymentsSucceeded },
            paymentsFailed: { increment: increments.paymentsFailed },
            bookingsCanceled: { increment: increments.bookingsCanceled },
            bookingsExpired: { increment: increments.bookingsExpired },
            ticketsIssued: { increment: increments.ticketsIssued },
            ticketingFailed: { increment: increments.ticketingFailed },
            flightsDelayed: { increment: increments.flightsDelayed },
            flightsCancelled: { increment: increments.flightsCancelled },
            paymentVolume: { increment: increments.paymentVolume },
          },
        });
      });

      return 'applied';
    } catch (error) {
      if (this.isEventIdConflict(error)) {
        return 'duplicate';
      }

      throw error;
    }
  }

  async getEventAnalytics(periodDays = 30): Promise<EventAnalyticsSummary> {
    const since = toUtcDateOnly(new Date(Date.now() - periodDays * 24 * 60 * 60 * 1000));

    const [rows, totals, health] = await Promise.all([
      this.prisma.bookingAnalyticsDaily.findMany({
        where: { date: { gte: since } },
        orderBy: { date: 'asc' },
      }),
      this.prisma.bookingAnalyticsDaily.aggregate({
        where: { date: { gte: since } },
        _sum: {
          bookingsCreated: true,
          paymentsSucceeded: true,
          paymentsFailed: true,
          bookingsCanceled: true,
          bookingsExpired: true,
          ticketsIssued: true,
          ticketingFailed: true,
          flightsDelayed: true,
          flightsCancelled: true,
          paymentVolume: true,
        },
      }),
      this.getAnalyticsHealth(),
    ]);

    const bookingsCreated = totals._sum.bookingsCreated ?? 0;
    const paymentsSucceeded = totals._sum.paymentsSucceeded ?? 0;
    const ticketsIssued = totals._sum.ticketsIssued ?? 0;

    return {
      periodDays,
      health,
      counts: {
        bookingsCreated,
        paymentsSucceeded,
        paymentsFailed: totals._sum.paymentsFailed ?? 0,
        bookingsCanceled: totals._sum.bookingsCanceled ?? 0,
        bookingsExpired: totals._sum.bookingsExpired ?? 0,
        ticketsIssued,
        ticketingFailed: totals._sum.ticketingFailed ?? 0,
        flightsDelayed: totals._sum.flightsDelayed ?? 0,
        flightsCancelled: totals._sum.flightsCancelled ?? 0,
      },
      conversionRate: this.calcRate(paymentsSucceeded, bookingsCreated),
      ticketRate: this.calcRate(ticketsIssued, paymentsSucceeded),
      paymentVolume: Number(totals._sum.paymentVolume ?? 0),
      dailyActivity: rows.map((row) => this.mapDailyRow(row)),
    };
  }

  async rebuildFromDomainEvents(): Promise<{ processed: number; applied: number }> {
    await this.prisma.$transaction([
      this.prisma.processedAnalyticsEvent.deleteMany(),
      this.prisma.bookingAnalyticsDaily.deleteMany(),
    ]);

    const events = await this.prisma.domainEvent.findMany({
      orderBy: { occurredAt: 'asc' },
    });

    let applied = 0;

    for (const event of events) {
      const result = await this.applyDomainEvent({
        eventId: event.eventId,
        eventType: event.eventType,
        aggregateType: event.aggregateType,
        aggregateId: event.aggregateId,
        occurredAt: event.occurredAt.toISOString(),
        schemaVersion: 1,
        payload: event.payload as Record<string, unknown>,
      });

      if (result === 'applied') {
        applied += 1;
      }
    }

    this.logger.log({ processed: events.length, applied }, 'Analytics projection rebuilt');

    return { processed: events.length, applied };
  }

  private async getAnalyticsHealth(): Promise<{
    lastEventAt: string | null;
    processedEventCount: number;
  }> {
    const [last, processedEventCount] = await Promise.all([
      this.prisma.processedAnalyticsEvent.findFirst({
        orderBy: { processedAt: 'desc' },
        select: { processedAt: true },
      }),
      this.prisma.processedAnalyticsEvent.count(),
    ]);

    return {
      lastEventAt: last?.processedAt.toISOString() ?? null,
      processedEventCount,
    };
  }

  private mapDailyRow(row: {
    date: Date;
    bookingsCreated: number;
    paymentsSucceeded: number;
    paymentsFailed: number;
    bookingsCanceled: number;
    bookingsExpired: number;
    ticketsIssued: number;
    ticketingFailed: number;
    flightsDelayed: number;
    flightsCancelled: number;
    paymentVolume: Prisma.Decimal;
  }): EventAnalyticsDailyRow {
    return {
      date: formatAnalyticsDateLabel(row.date),
      bookingsCreated: row.bookingsCreated,
      paymentsSucceeded: row.paymentsSucceeded,
      paymentsFailed: row.paymentsFailed,
      bookingsCanceled: row.bookingsCanceled,
      bookingsExpired: row.bookingsExpired,
      ticketsIssued: row.ticketsIssued,
      ticketingFailed: row.ticketingFailed,
      flightsDelayed: row.flightsDelayed,
      flightsCancelled: row.flightsCancelled,
      paymentVolume: Number(row.paymentVolume),
    };
  }

  private async resolvePaymentVolume(envelope: DomainEventEnvelope): Promise<number> {
    if (envelope.eventType !== 'booking.paid') {
      return 0;
    }

    const bookingId = resolveBookingIdFromEnvelope(envelope);
    if (bookingId) {
      const booking = await this.prisma.booking.findUnique({
        where: { id: bookingId },
        select: { totalPrice: true },
      });

      if (booking) {
        return Number(booking.totalPrice);
      }
    }

    for (const key of ['totalPrice', 'amount'] as const) {
      const value = envelope.payload[key];
      if (typeof value === 'number' && Number.isFinite(value)) {
        return value;
      }

      if (typeof value === 'string') {
        const parsed = Number(value);
        if (Number.isFinite(parsed)) {
          return parsed;
        }
      }
    }

    return 0;
  }

  private calcRate(numerator: number, denominator: number): number {
    if (denominator === 0) {
      return 0;
    }

    return Number(((numerator / denominator) * 100).toFixed(1));
  }

  private isEventIdConflict(error: unknown): boolean {
    return (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002' &&
      Array.isArray(error.meta?.target) &&
      error.meta.target.includes('eventId')
    );
  }
}

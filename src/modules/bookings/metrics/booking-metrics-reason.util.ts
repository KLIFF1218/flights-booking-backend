import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { BookingMetricReason } from './booking-metrics.constants';

export function resolveBookingMetricReason(error: unknown): BookingMetricReason {
  if (error instanceof NotFoundException) {
    return 'not_found';
  }

  if (error instanceof BadRequestException) {
    const message = error.message.toLowerCase();

    if (message.includes('expired')) {
      return 'expired';
    }

    if (message.includes('traveler') && message.includes('expected')) {
      return 'traveler_mismatch';
    }

    if (message.includes('duplicate traveler')) {
      return 'duplicate_traveler';
    }

    if (message.includes('seat already reserved') || message.includes('seat selection')) {
      return 'seat_unavailable';
    }

    if (message.includes('not enough seats')) {
      return 'inventory_unavailable';
    }

    if (
      message.includes('not allowed') ||
      message.includes('not payable') ||
      message.includes('payment already initiated')
    ) {
      return 'status_conflict';
    }

    return 'validation';
  }

  if (error instanceof ConflictException) {
    return 'status_conflict';
  }

  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === 'P2002') {
      return 'db_conflict';
    }
  }

  if (error instanceof Error) {
    const message = error.message.toLowerCase();

    if (message.includes('timeout') || message.includes('timed out')) {
      return 'provider_timeout';
    }

    if (
      message.includes('provider') ||
      message.includes('stripe') ||
      message.includes('yookassa')
    ) {
      return 'provider_error';
    }
  }

  return 'unknown';
}

export function normalizeBookingOutboxTopic(topic: string): string {
  if (!topic) {
    return 'other';
  }

  if (topic.includes('booking.paid')) {
    return 'booking.paid';
  }

  if (topic.includes('booking.created')) {
    return 'booking.created';
  }

  if (topic.includes('booking.expired')) {
    return 'booking.expired';
  }

  if (topic.includes('booking.canceled')) {
    return 'booking.canceled';
  }

  if (topic === 'payment.failed' || topic.includes('payment.failed')) {
    return 'payment.failed';
  }

  if (topic === 'payment.pending.cancel') {
    return 'payment.pending.cancel';
  }

  if (topic === 'checkout.cleanup') {
    return 'checkout.cleanup';
  }

  if (topic === 'booking.ticketing.failed') {
    return 'booking.ticketing.failed';
  }

  if (topic === 'booking.create.compensation') {
    return 'booking.create.compensation';
  }

  return 'other';
}

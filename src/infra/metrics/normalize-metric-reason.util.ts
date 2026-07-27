import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';

const KNOWN_PAYMENT_REASONS = new Set([
  'not_found',
  'bad_request',
  'not_payable',
  'already_initiated',
  'forbidden',
  'provider_error',
  'unknown',
]);

export function normalizePaymentFailureReason(error: unknown): string {
  if (error instanceof NotFoundException) {
    return 'not_found';
  }

  if (error instanceof BadRequestException) {
    const message = error.message.toLowerCase();
    if (message.includes('not payable')) {
      return 'not_payable';
    }
    if (message.includes('already initiated')) {
      return 'already_initiated';
    }
    return 'bad_request';
  }

  if (error instanceof ForbiddenException) {
    return 'forbidden';
  }

  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    if (message.includes('not found')) {
      return 'not_found';
    }
    if (message.includes('not payable')) {
      return 'not_payable';
    }
    if (message.includes('already initiated')) {
      return 'already_initiated';
    }
    return 'provider_error';
  }

  return 'unknown';
}

export function isKnownPaymentFailureReason(reason: string): boolean {
  return KNOWN_PAYMENT_REASONS.has(reason);
}

export function normalizeMailType(jobName: string): string {
  switch (jobName) {
    case 'send-booking-success':
      return 'booking_success';
    case 'send-booking-failed':
      return 'booking_failed';
    default:
      return 'unknown';
  }
}

export function normalizeMailFailureReason(error: unknown): string {
  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    if (message.includes('timeout')) {
      return 'timeout';
    }
    if (message.includes('rate')) {
      return 'rate_limited';
    }
    return 'send_error';
  }

  return 'unknown';
}

export function normalizeTicketingFailureReason(error: unknown): string {
  if (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    typeof (error as { code?: unknown }).code === 'string'
  ) {
    return (error as { code: string }).code;
  }

  if (error instanceof Error) {
    return 'processing_error';
  }

  return 'unknown';
}

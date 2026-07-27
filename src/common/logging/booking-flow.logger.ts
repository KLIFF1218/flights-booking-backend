export const BookingFlowStage = {
  PAYMENT_SUCCEEDED: 'payment.succeeded',
  OUTBOX_SENT: 'outbox.sent',
  RABBITMQ_RECEIVED: 'rabbitmq.received',
  BULLMQ_ENQUEUED: 'bullmq.enqueued',
  TICKET_ISSUED: 'ticket.issued',
} as const;

export type BookingFlowStageName = (typeof BookingFlowStage)[keyof typeof BookingFlowStage];

type FlowLogger = {
  log: (context: Record<string, unknown>, message?: string) => void;
};

export function logBookingFlowStage(
  logger: FlowLogger,
  stage: BookingFlowStageName,
  context: Record<string, unknown>,
): void {
  logger.log({ ...context, stage, flow: 'booking-ticketing' }, stage);
}

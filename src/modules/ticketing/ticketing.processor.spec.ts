import { TicketingProcessor } from './ticketing.processor';
import { type ProcessBookingTicketingUseCase } from './use-cases/process-booking-ticketing.use-case';
import { type TicketingFailureHandler } from './services/ticketing-failure.handler';
import { TicketingUnrecoverableError, TicketingErrorCode } from './errors/ticketing.errors';
import { TICKETING_QUEUE_MAX_ATTEMPTS } from './constants/ticketing-queue.constants';

describe('TicketingProcessor', () => {
  const processBookingTicketing = {
    execute: jest.fn(),
  };
  const ticketingFailureHandler = {
    handleJobFailure: jest.fn(),
    handleExhaustedRetries: jest.fn(),
  };
  const metrics = {
    recordTicketingCompleted: jest.fn(),
    recordTicketingFailed: jest.fn(),
    recordTicketingDuration: jest.fn(),
  };

  let processor: TicketingProcessor;

  beforeEach(() => {
    jest.clearAllMocks();
    processor = new TicketingProcessor(
      processBookingTicketing as unknown as ProcessBookingTicketingUseCase,
      ticketingFailureHandler as unknown as TicketingFailureHandler,
      metrics as never,
    );
  });

  it('delegates successful jobs to the use case', async () => {
    await processor.process({ data: { bookingId: 'booking-1' } } as any);

    expect(processBookingTicketing.execute).toHaveBeenCalledWith('booking-1');
    expect(metrics.recordTicketingCompleted).toHaveBeenCalled();
  });

  it('delegates failures to TicketingFailureHandler', async () => {
    const error = new TicketingUnrecoverableError(
      'No travelers',
      TicketingErrorCode.NO_TRAVELERS,
      'booking-1',
    );
    processBookingTicketing.execute.mockRejectedValue(error);

    await expect(processor.process({ data: { bookingId: 'booking-1' } } as any)).rejects.toThrow(
      TicketingUnrecoverableError,
    );

    expect(ticketingFailureHandler.handleJobFailure).toHaveBeenCalledWith(error, 'booking-1');
    expect(metrics.recordTicketingFailed).toHaveBeenCalled();
  });

  it('escalates exhausted retries via TicketingFailureHandler', async () => {
    const job = {
      data: { bookingId: 'booking-1' },
      opts: { attempts: TICKETING_QUEUE_MAX_ATTEMPTS },
      attemptsMade: TICKETING_QUEUE_MAX_ATTEMPTS,
    };
    const error = new Error('pdf generation failed');

    await processor.onFailed(job as any, error);

    expect(ticketingFailureHandler.handleExhaustedRetries).toHaveBeenCalledWith('booking-1', error);
  });
});

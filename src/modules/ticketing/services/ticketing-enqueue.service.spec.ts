import { Test, type TestingModule } from '@nestjs/testing';
import { getQueueToken } from '@nestjs/bullmq';
import { Logger } from 'nestjs-pino';
import { TicketingEnqueueService } from './ticketing-enqueue.service';
import { TICKETING_QUEUE_NAME } from '../ticketing-queue.config';
import { MetricsService } from 'src/infra/metrics/metrics.service';

describe('TicketingEnqueueService', () => {
  let service: TicketingEnqueueService;
  let module: TestingModule;

  const queue = {
    add: jest.fn(),
  };
  const metrics = {
    recordTicketingEnqueued: jest.fn(),
  };
  const logger = {
    log: jest.fn(),
    child: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    queue.add.mockResolvedValue({ id: 'job-1' });

    module = await Test.createTestingModule({
      providers: [
        TicketingEnqueueService,
        { provide: getQueueToken(TICKETING_QUEUE_NAME), useValue: queue },
        { provide: Logger, useValue: logger },
        { provide: MetricsService, useValue: metrics },
      ],
    }).compile();

    service = module.get(TicketingEnqueueService);
  });

  afterEach(async () => {
    await module?.close();
  });

  it('enqueues issue-ticket job with deterministic job id', async () => {
    await service.enqueueIssueTicket('booking-1');

    expect(queue.add).toHaveBeenCalledWith(
      'issue-ticket',
      { bookingId: 'booking-1' },
      { jobId: 'ticket-booking-1' },
    );
  });

  it('records ticketing enqueue metric', async () => {
    await service.enqueueIssueTicket('booking-1');

    expect(metrics.recordTicketingEnqueued).toHaveBeenCalled();
  });
});

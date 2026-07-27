import { Test, type TestingModule } from '@nestjs/testing';
import { TicketingService } from './ticketing.service';
import { TicketingEnqueueService } from './ticketing-enqueue.service';

describe('TicketingService', () => {
  let service: TicketingService;
  const ticketingEnqueue = {
    enqueueIssueTicket: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TicketingService,
        { provide: TicketingEnqueueService, useValue: ticketingEnqueue },
      ],
    }).compile();

    service = module.get(TicketingService);
  });

  it('delegates ticket issuance to enqueue service', async () => {
    await service.issueTicket('booking-1');

    expect(ticketingEnqueue.enqueueIssueTicket).toHaveBeenCalledWith('booking-1');
  });
});

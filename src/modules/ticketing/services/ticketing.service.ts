import { Injectable } from '@nestjs/common';

import { TicketingEnqueueService } from './ticketing-enqueue.service';

@Injectable()
export class TicketingService {
  constructor(private readonly ticketingEnqueue: TicketingEnqueueService) {}

  async issueTicket(bookingId: string): Promise<void> {
    await this.ticketingEnqueue.enqueueIssueTicket(bookingId);
  }
}

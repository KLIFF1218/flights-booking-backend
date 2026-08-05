import { Injectable } from '@nestjs/common';
import { EnumTransport } from '@prisma/client';
import { PrismaService } from 'src/infra/db/prisma/prisma.service';
import { OutboxService } from 'src/infra/outbox/outbox.service';

@Injectable()
export class TicketPersistenceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly outbox: OutboxService,
  ) {}

  async findTicketsByBookingId(bookingId: string) {
    return this.prisma.ticket.findMany({
      where: { bookingId },
      select: {
        travelerId: true,
        ticketNumber: true,
        pdfKey: true,
      },
    });
  }

  async recordIssuedTicket(params: {
    bookingId: string;
    travelerId: string;
    ticketNumber: string;
    pdfKey: string;
    issuedAt: Date;
  }) {
    return this.prisma.$transaction(async (tx) => {
      const created = await tx.ticket.create({
        data: {
          bookingId: params.bookingId,
          travelerId: params.travelerId,
          ticketNumber: params.ticketNumber,
          pdfKey: params.pdfKey,
        },
      });

      await this.outbox.enqueue(tx, {
        aggregateId: created.id,
        aggregateType: 'Ticket',
        topic: 'ticket.issued',
        payload: {
          ticketId: created.id,
          bookingId: params.bookingId,
          travelerId: params.travelerId,
          ticketNumber: created.ticketNumber,
          issuedAt: params.issuedAt.toISOString(),
        },
        transport: EnumTransport.KAFKA,
      });

      return created;
    });
  }
}

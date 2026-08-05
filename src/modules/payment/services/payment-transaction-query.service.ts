import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/infra/db/prisma/prisma.service';
import { S3Service } from 'src/infra/storage/s3.service';
import { Logger } from 'nestjs-pino';
import { PaymentMapper } from '../mappers/payment.mapper';
import type { TransactionStatusResponseDto } from '../dtos/transaction-status-response.dto';

@Injectable()
export class PaymentTransactionQueryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly s3Service: S3Service,
    private readonly logger: Logger,
  ) {}

  async getTransactionStatus(id: string, userId: string): Promise<TransactionStatusResponseDto> {
    const tx = await this.prisma.transaction.findFirst({
      where: { id, userId },
      include: {
        booking: {
          include: {
            user: true,
            travelers: true,
            tickets: true,
            seatAssignments: {
              include: {
                seat: true,
              },
            },
          },
        },
      },
    });

    if (!tx) {
      throw new NotFoundException('Transaction not found');
    }

    const booking = tx.booking;

    const tickets = booking?.tickets?.length
      ? await Promise.all(booking.tickets.map((ticket) => this.mapTicketWithUrls(ticket)))
      : [];

    const seatAssignmentsByTraveler = new Map(
      booking?.seatAssignments?.map((assignment) => [
        assignment.travelerId,
        assignment.seat?.seatNumber ?? null,
      ]) ?? [],
    );

    return PaymentMapper.toTransactionStatusResponse(tx, tickets, seatAssignmentsByTraveler);
  }

  private async mapTicketWithUrls(ticket: {
    id: string;
    travelerId: string;
    ticketNumber: string;
    status: string;
    pdfKey: string;
  }) {
    try {
      const [previewUrl, downloadUrl] = await Promise.all([
        this.s3Service.getDownloadUrl(ticket.pdfKey, {
          disposition: 'inline',
          fileName: `${ticket.ticketNumber}.pdf`,
        }),
        this.s3Service.getDownloadUrl(ticket.pdfKey, {
          disposition: 'attachment',
          fileName: `${ticket.ticketNumber}.pdf`,
        }),
      ]);

      return {
        id: ticket.id,
        travelerId: ticket.travelerId,
        ticketNumber: ticket.ticketNumber,
        status: ticket.status,
        previewUrl,
        downloadUrl,
      };
    } catch (error: unknown) {
      this.logger.warn(
        {
          err: error instanceof Error ? error : String(error),
          ticketId: ticket.id,
          ticketNumber: ticket.ticketNumber,
        },
        'Failed to generate ticket download URLs',
      );

      return {
        id: ticket.id,
        travelerId: ticket.travelerId,
        ticketNumber: ticket.ticketNumber,
        status: ticket.status,
        previewUrl: null,
        downloadUrl: null,
      };
    }
  }
}

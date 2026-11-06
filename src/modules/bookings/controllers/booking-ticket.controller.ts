import { Controller, Get, Param, Query } from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiOkResponse,
} from '@nestjs/swagger';
import { Authorized, Protected, Roles } from 'src/common/decorators';
import { Role } from '@prisma/client';
import { BookingTicketService } from '../services/tickets/booking-ticket.service';
import { BookingTicketItemDto } from '../dtos/ticket/booking-ticket-response.dto';
import { ApiNotFoundError, ApiUserAuthErrors } from 'src/common/swagger/api-responses.decorator';

@ApiTags('Booking Tickets')
@ApiBearerAuth('bearerAuth')
@Protected()
@Roles(Role.USER, Role.ADMIN)
@Controller({ path: 'booking', version: '1' })
export class BookingTicketController {
  constructor(private readonly bookingTicketService: BookingTicketService) {}

  @Get(':id/tickets')
  @ApiOperation({ summary: 'Get tickets for a booking' })
  @ApiParam({ name: 'id', description: 'Booking ID' })
  @ApiQuery({
    name: 'mode',
    description: 'Mode: view or download ticket',
    required: false,
    enum: ['view', 'download'],
  })
  @ApiOkResponse({ type: [BookingTicketItemDto], description: 'List of tickets with links' })
  @ApiNotFoundError('Booking or tickets not found')
  @ApiUserAuthErrors()
  async getTickets(
    @Param('id') bookingId: string,
    @Authorized('id') userId: string,
    @Query('mode') mode: 'view' | 'download' = 'view',
  ) {
    return this.bookingTicketService.getTickets(bookingId, userId, mode);
  }
}

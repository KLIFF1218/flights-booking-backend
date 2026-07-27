import { Body, Controller, Get, Param, Patch, Query } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiOkResponse,
  ApiBearerAuth,
  ApiParam,
  ApiBody,
} from '@nestjs/swagger';
import { AdminBookingsService } from './admin-bookings.service';
import { AdminBookingsQueryDto } from './dtos/admin-bookings-query.dto';
import { Role } from '@prisma/client';
import { Protected, Roles } from 'src/common/decorators';
import {
  ApiAdminAuthErrors,
  ApiBadRequestError,
  ApiNotFoundError,
} from 'src/common/swagger/api-responses.decorator';
import {
  BookingsListResponseDto,
  UpdateBookingStatusDto,
  BookingAdminDto,
} from './dtos/booking-response.dto';
import { BookingDomainEventsResponseDto } from './dtos/booking-events-response.dto';

@ApiTags('Admin / Bookings')
@ApiBearerAuth('bearerAuth')
@Protected()
@Roles(Role.ADMIN)
@Controller({ path: 'admin/bookings', version: '1' })
export class AdminBookingsController {
  constructor(private readonly adminBookingsService: AdminBookingsService) {}

  @Get()
  @ApiOperation({
    summary: 'Get bookings list (admin)',
    description: 'Returns a list of bookings with filtering and pagination.',
  })
  @ApiOkResponse({ description: 'Bookings list', type: BookingsListResponseDto })
  @ApiAdminAuthErrors()
  @ApiBadRequestError()
  async findAll(@Query() query: AdminBookingsQueryDto) {
    return this.adminBookingsService.findAll(query);
  }

  @Get(':id/events')
  @ApiOperation({
    summary: 'Get booking domain event timeline (admin)',
    description: 'Returns persisted Kafka domain events for a booking.',
  })
  @ApiParam({ name: 'id', description: 'Booking ID' })
  @ApiOkResponse({ description: 'Booking events', type: BookingDomainEventsResponseDto })
  @ApiAdminAuthErrors()
  @ApiNotFoundError('Booking not found')
  async findEvents(@Param('id') id: string) {
    return this.adminBookingsService.findEvents(id);
  }

  @Patch(':id/status')
  @ApiOperation({ summary: 'Update booking status' })
  @ApiParam({ name: 'id', description: 'Booking ID' })
  @ApiBody({ type: UpdateBookingStatusDto })
  @ApiOkResponse({ description: 'Booking updated', type: BookingAdminDto })
  @ApiAdminAuthErrors()
  @ApiBadRequestError()
  @ApiNotFoundError('Booking not found')
  async updateStatus(@Param('id') id: string, @Body() body: UpdateBookingStatusDto) {
    const updated = await this.adminBookingsService.updateStatus(id, body.status);
    return updated;
  }
}

import { Body, Controller, Get, Param, Patch, Query } from '@nestjs/common';
import { AdminBookingsService } from './admin-bookings.service';
import { AdminBookingsQueryDto } from './dto/admin-bookings-query.dto';
import { BookingStatus, Role } from '@prisma/client';
import { Protected, Roles } from 'src/common/decorators';
import {
  ApiTags,
  ApiOperation,
  ApiOkResponse,
  ApiBearerAuth,
  ApiUnauthorizedResponse,
  ApiForbiddenResponse,
  ApiParam,
  ApiBody,
} from '@nestjs/swagger';
import {
  BookingsListResponseDto,
  UpdateBookingStatusDto,
  BookingAdminDto,
} from './dto/booking-response.dto';

@ApiTags('Admin / Bookings')
@ApiBearerAuth()
@Protected()
@Roles(Role.ADMIN)
@Controller({ path: 'admin/bookings', version: '1' })
export class AdminBookingsController {
  constructor(private readonly adminBookingsService: AdminBookingsService) {}

  @Get()
  @ApiOperation({
    summary: 'Получить список бронирований (админ)',
    description: 'Возвращает список бронирований с фильтрацией и пагинацией.',
  })
  @ApiOkResponse({ description: 'Список бронирований', type: BookingsListResponseDto })
  @ApiUnauthorizedResponse({ description: 'Требуется аутентификация' })
  @ApiForbiddenResponse({ description: 'Требуется роль ADMIN' })
  async findAll(@Query() query: AdminBookingsQueryDto) {
    return this.adminBookingsService.findAll(query);
  }

  @Patch(':id/status')
  @ApiOperation({ summary: 'Обновить статус бронирования' })
  @ApiParam({ name: 'id', description: 'ID бронирования' })
  @ApiBody({ type: UpdateBookingStatusDto })
  @ApiOkResponse({ description: 'Бронирование обновлено', type: BookingAdminDto })
  @ApiUnauthorizedResponse({ description: 'Требуется аутентификация' })
  @ApiForbiddenResponse({ description: 'Требуется роль ADMIN' })
  async updateStatus(@Param('id') id: string, @Body() body: UpdateBookingStatusDto) {
    const updated = await this.adminBookingsService.updateStatus(id, body.status);
    return updated;
  }
}

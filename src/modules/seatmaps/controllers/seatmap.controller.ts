import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiParam, ApiBody, ApiResponse } from '@nestjs/swagger';
import { SeatMapsService } from '../services/seatmap.service';
import { SeatMapDto } from '../dtos/seatmap.dto';
import { Protected } from 'src/common/decorators';
import { Roles } from 'src/common/decorators';
import { Role } from '@prisma/client';

@ApiTags('Seat Maps')
@Protected()
@Roles(Role.USER, Role.ADMIN)
@Controller({ path: 'seatmaps', version: '1' })
export class SeatmapsController {
  constructor(private readonly seatmapService: SeatMapsService) {}

  @Get('by-order/:flightOrderId')
  @ApiOperation({
    summary: 'Получить карту мест по flight order',
    description:
      'Используется после оформления бронирования. Возвращает карту мест по ID flight order.',
  })
  @ApiParam({
    name: 'flightOrderId',
    description: 'Идентификатор flight order',
    example: 'eJzTd9cPCnX2M1...',
  })
  @ApiResponse({
    status: 200,
    description: 'Seat map успешно получен',
  })
  @ApiResponse({
    status: 404,
    description: 'Flight order не найден',
  })
  async getSeatMapByOrder(@Param('flightOrderId') flightOrderId: string) {
    return true;
  }

  @Post('by-offer')
  @Post('byoffer')
  @ApiOperation({
    summary: 'Получить карту мест по flight offer',
    description: 'Используется до бронирования. Позволяет показать клиенту доступные места и цены.',
  })
  async getSeatMapByOffer(@Body() dto: SeatMapDto) {
    return await this.seatmapService.getSeatMapByOffer(dto);
  }
}

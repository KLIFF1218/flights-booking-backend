import { Controller, Get, Patch, Param, Body, Query, Post } from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiOkResponse,
  ApiParam,
  ApiQuery,
  ApiBody,
  ApiUnauthorizedResponse,
  ApiForbiddenResponse,
} from '@nestjs/swagger';
import { FlightsService } from './admin-flights.service';
import { UpdateFlightStatusDto } from './dto/update-flight-status.dto';
import { CreateFlightInstanceDto } from './dto/create-flight-instance.dto';
import { Protected, Roles } from 'src/common/decorators';
import { Role } from '@prisma/client';

@ApiTags('Admin / Flights')
@ApiBearerAuth()
@Protected()
@Roles(Role.ADMIN)
@Controller({ path: 'admin-flights', version: '1' })
export class FlightsController {
  constructor(private readonly flightsService: FlightsService) {}

  @Get()
  @ApiOperation({ summary: 'Получить список рейсов' })
  @ApiQuery({ name: 'search', required: false, description: 'Фильтр по рейсу или маршруту' })
  @ApiOkResponse({ description: 'Список рейсов успешно получен' })
  @ApiUnauthorizedResponse({ description: 'Требуется аутентификация' })
  @ApiForbiddenResponse({ description: 'Требуется роль ADMIN' })
  getFlights(@Query() query: any) {
    return this.flightsService.getFlights(query);
  }

  @Patch(':id/status')
  @ApiOperation({ summary: 'Обновить статус рейса' })
  @ApiParam({ name: 'id', description: 'ID рейса' })
  @ApiBody({ type: UpdateFlightStatusDto })
  @ApiOkResponse({ description: 'Статус рейса обновлён' })
  updateStatus(@Param('id') id: string, @Body() dto: UpdateFlightStatusDto) {
    return this.flightsService.updateStatus(id, dto);
  }

  @Get('flight-templates')
  @ApiOperation({ summary: 'Получить шаблоны рейсов' })
  @ApiQuery({ name: 'search', required: false, description: 'Поиск по названию шаблона рейса' })
  @ApiOkResponse({ description: 'Список шаблонов рейсов' })
  getFlightTemplates(@Query('search') search?: string) {
    return this.flightsService.getFlightTemplates(search);
  }

  @Post()
  @ApiOperation({ summary: 'Создать новый экземпляр рейса' })
  @ApiBody({ type: CreateFlightInstanceDto })
  @ApiOkResponse({ description: 'Рейс успешно создан' })
  create(@Body() dto: CreateFlightInstanceDto) {
    return this.flightsService.create(dto);
  }
}

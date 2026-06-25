import { Controller, Get } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiOkResponse,
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { AdminAirportsService } from './admin-airports.service';
import { Protected, Roles } from 'src/common/decorators';
import { Role } from '@prisma/client';
import { AirportsListResponseDto } from './dto/airport-response.dto';

@ApiTags('Admin / Airports')
@ApiBearerAuth()
@Protected()
@Roles(Role.ADMIN)
@Controller({ path: 'admin-airports', version: '1' })
export class AdminAirportsController {
  constructor(private readonly adminAirportsService: AdminAirportsService) {}

  @Get()
  @ApiOperation({
    summary: 'Получить список всех аэропортов',
    description:
      'Возвращает полный список всех зарегистрированных аэропортов в системе. ' +
      'Доступно только для администраторов.',
  })
  @ApiOkResponse({
    description: 'Список аэропортов успешно получен',
    type: AirportsListResponseDto,
  })
  @ApiUnauthorizedResponse({
    description: 'Ошибка аутентификации - требуется валидный JWT токен',
  })
  @ApiForbiddenResponse({
    description: 'Ошибка авторизации - требуется роль ADMIN',
  })
  async findAll() {
    const airports = await this.adminAirportsService.findAll();
    return { data: airports };
  }
}

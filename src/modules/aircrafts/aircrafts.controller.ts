import { Controller, Get } from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiOkResponse,
  ApiUnauthorizedResponse,
  ApiForbiddenResponse,
} from '@nestjs/swagger';
import { AircraftsService } from './aircrafts.service';
import { Protected, Roles } from 'src/common/decorators';
import { Role } from '@prisma/client';

@ApiTags('Aircrafts')
@ApiBearerAuth()
@Protected()
@Roles(Role.ADMIN)
@Controller({ path: 'aircrafts', version: '1' })
export class AircraftsController {
  constructor(private readonly aircraftsService: AircraftsService) {}

  @Get()
  @ApiOperation({ summary: 'Получить список самолётов' })
  @ApiOkResponse({ description: 'Список самолётов успешно получен' })
  @ApiUnauthorizedResponse({ description: 'Требуется аутентификация' })
  @ApiForbiddenResponse({ description: 'Требуется роль ADMIN' })
  findAll() {
    return this.aircraftsService.findAll();
  }
}

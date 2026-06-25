import { Controller, Get } from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiOkResponse,
  ApiUnauthorizedResponse,
  ApiForbiddenResponse,
} from '@nestjs/swagger';
import { AirlinesService } from './airlines.service';
import { Protected, Roles } from 'src/common/decorators';
import { Role } from '@prisma/client';

@ApiTags('Airlines')
@ApiBearerAuth()
@Protected()
@Roles(Role.ADMIN)
@Controller('airlines')
export class AirlinesController {
  constructor(private readonly airlinesService: AirlinesService) {}

  @Get()
  @ApiOperation({ summary: 'Получить список авиакомпаний' })
  @ApiOkResponse({ description: 'Список авиакомпаний успешно получен' })
  @ApiUnauthorizedResponse({ description: 'Требуется аутентификация' })
  @ApiForbiddenResponse({ description: 'Требуется роль ADMIN' })
  getAirlines() {
    return this.airlinesService.getAirlines();
  }
}

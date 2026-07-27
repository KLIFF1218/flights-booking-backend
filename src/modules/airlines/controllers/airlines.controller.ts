import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiOkResponse } from '@nestjs/swagger';
import { AirlinesService } from '../airlines.service';
import { Protected, Roles } from 'src/common/decorators';
import { Role } from '@prisma/client';
import { AirlineResponseDto } from '../dtos/airline-response.dto';
import { ApiUserAuthErrors } from 'src/common/swagger/api-responses.decorator';

@ApiTags('Airlines')
@ApiBearerAuth('bearerAuth')
@Protected()
@Roles(Role.USER, Role.ADMIN)
@Controller({ path: 'airlines', version: '1' })
export class AirlinesController {
  constructor(private readonly airlinesService: AirlinesService) {}

  @Get()
  @ApiOperation({ summary: 'Get airlines list' })
  @ApiOkResponse({ type: [AirlineResponseDto], description: 'Airlines list' })
  @ApiUserAuthErrors()
  getAirlines() {
    return this.airlinesService.getAirlines();
  }
}

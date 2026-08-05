import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiOkResponse, ApiQuery } from '@nestjs/swagger';
import { AircraftsService } from '../services/aircrafts.service';
import { Protected, Roles } from 'src/common/decorators';
import { Role } from '@prisma/client';
import { AircraftResponseDto } from '../dtos/aircraft-response.dto';
import { ApiUserAuthErrors } from 'src/common/swagger/api-responses.decorator';

@ApiTags('Aircrafts')
@ApiBearerAuth('bearerAuth')
@Protected()
@Roles(Role.USER, Role.ADMIN)
@Controller({ path: 'aircrafts', version: '1' })
export class AircraftsController {
  constructor(private readonly aircraftsService: AircraftsService) {}

  @Get()
  @ApiOperation({ summary: 'Get aircraft list' })
  @ApiQuery({
    name: 'airlineId',
    required: false,
    description: 'Filter aircraft by airline ID',
  })
  @ApiOkResponse({ type: [AircraftResponseDto], description: 'Aircraft list' })
  @ApiUserAuthErrors()
  findAll(@Query('airlineId') airlineId?: string) {
    return this.aircraftsService.findAll(airlineId);
  }
}

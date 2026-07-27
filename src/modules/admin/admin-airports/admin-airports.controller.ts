import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiOkResponse } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { AdminAirportsService } from './admin-airports.service';
import { AirportsListResponseDto } from './dtos/airport-response.dto';
import { AirportsQuery } from './dtos/airport-query';
import { Protected, Roles } from 'src/common/decorators';
import { ApiAdminAuthErrors, ApiBadRequestError } from 'src/common/swagger/api-responses.decorator';

@ApiTags('Admin / Airports')
@ApiBearerAuth('bearerAuth')
@Protected()
@Roles(Role.ADMIN)
@Controller({ path: 'admin/airports', version: '1' })
export class AdminAirportsController {
  constructor(private readonly adminAirportsService: AdminAirportsService) {}

  @Get()
  @ApiOperation({
    summary: 'Get list of all airports',
    description:
      'Returns the full list of all registered airports in the system. ' +
      'Available to administrators only.',
  })
  @ApiOkResponse({
    description: 'Airports list retrieved successfully',
    type: AirportsListResponseDto,
  })
  @ApiAdminAuthErrors()
  @ApiBadRequestError()
  async findAll(@Query() dto: AirportsQuery) {
    return await this.adminAirportsService.findAll(dto);
  }
}

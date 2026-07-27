import { Controller, Get, Patch, Param, Body, Query, Post } from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiOkResponse,
  ApiParam,
  ApiBody,
  ApiQuery,
} from '@nestjs/swagger';
import { FlightsService } from './admin-flights.service';
import { UpdateFlightStatusDto } from './dtos/update-flight-status.dto';
import { CreateFlightInstanceDto } from './dtos/create-flight-instance.dto';
import { GetFlightsQueryDto } from './dtos/get-flights.dto';
import { AdminFlightInstanceDto, AdminFlightTemplateDto } from './dtos/admin-flight-response.dto';
import { AdminFlightsListResponseDto } from './dtos/admin-flights-list.dto';
import { Protected, Roles } from 'src/common/decorators';
import { Role } from '@prisma/client';
import {
  ApiAdminAuthErrors,
  ApiBadRequestError,
  ApiNotFoundError,
} from 'src/common/swagger/api-responses.decorator';

@ApiTags('Admin / Flights')
@ApiBearerAuth('bearerAuth')
@Protected()
@Roles(Role.ADMIN)
@Controller({ path: 'admin/flights', version: '1' })
export class AdminFlightsController {
  constructor(private readonly flightsService: FlightsService) {}

  @Get()
  @ApiOperation({ summary: 'Get flights list' })
  @ApiOkResponse({
    type: AdminFlightsListResponseDto,
    description: 'Flights list retrieved successfully',
  })
  @ApiAdminAuthErrors()
  getFlights(@Query() query: GetFlightsQueryDto) {
    return this.flightsService.getFlights(query);
  }

  @Patch(':id/status')
  @ApiOperation({ summary: 'Update flight status' })
  @ApiParam({ name: 'id', description: 'Flight ID' })
  @ApiBody({ type: UpdateFlightStatusDto })
  @ApiOkResponse({ type: AdminFlightInstanceDto, description: 'Flight status updated' })
  @ApiAdminAuthErrors()
  @ApiBadRequestError()
  @ApiNotFoundError('Flight not found')
  updateStatus(@Param('id') id: string, @Body() dto: UpdateFlightStatusDto) {
    return this.flightsService.updateStatus(id, dto);
  }

  @Get('flight-templates')
  @ApiOperation({ summary: 'Get flight templates' })
  @ApiQuery({
    name: 'search',
    required: false,
    description: 'Search by flight number or route (min. 2 characters)',
  })
  @ApiOkResponse({ type: [AdminFlightTemplateDto], description: 'Flight templates list' })
  @ApiAdminAuthErrors()
  getFlightTemplates(@Query('search') search?: string) {
    return this.flightsService.getFlightTemplates(search);
  }

  @Post()
  @ApiOperation({ summary: 'Create a new flight instance' })
  @ApiBody({ type: CreateFlightInstanceDto })
  @ApiOkResponse({ type: AdminFlightInstanceDto, description: 'Flight created successfully' })
  @ApiAdminAuthErrors()
  @ApiBadRequestError()
  create(@Body() dto: CreateFlightInstanceDto) {
    return this.flightsService.create(dto);
  }
}

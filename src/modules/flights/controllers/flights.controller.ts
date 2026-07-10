import { Controller, Post, Body, Query, Get, Param } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBody, ApiOkResponse } from '@nestjs/swagger';
import { FlightsService } from '../services/flights.service';
import { SearchFlightsDto } from '../dtos/index';
import { SearchFlightsResponse } from '../dtos/search-flight.response.dto';
import { FlightsQueryDto } from '../dtos/flights-query.dto';

@ApiTags('Flights')
@Controller({ path: 'flights', version: '1' })
export class FlightsController {
  constructor(private readonly flightsService: FlightsService) {}

  @Post('search')
  @ApiOperation({ summary: 'Search for flights' })
  @ApiBody({ type: SearchFlightsDto })
  @ApiOkResponse({
    description: 'Successfully found flights',
    type: SearchFlightsResponse,
  })
  async createSearch(@Body() dto: SearchFlightsDto, @Query() query: FlightsQueryDto) {
    return this.flightsService.createSearch(dto, query.sort);
  }

  @Get('search/:searchId')
  async getPage(@Param('searchId') searchId: string, @Query() query: FlightsQueryDto) {
    return this.flightsService.getSearchPage(searchId, query.cursor, query.limit, query.sort);
  }
}

import { Controller, Get, Post, Body, Query, Param } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBody, ApiOkResponse, ApiParam } from '@nestjs/swagger';
import { RateLimit, RATE_LIMIT_PRESETS } from 'src/common/decorators';
import { FlightsService } from '../services/flights.service';
import { SearchFlightsDto } from '../dtos/index';
import { SearchFlightsResponse } from '../dtos/search-flight.response.dto';
import { FlightsQueryDto } from '../dtos/flights-query.dto';
import { ApiBadRequestError } from 'src/common/swagger/api-responses.decorator';

@ApiTags('Flights')
@Controller({ path: 'flights', version: '1' })
export class FlightsController {
  constructor(private readonly flightsService: FlightsService) {}

  @Post('search')
  @RateLimit(RATE_LIMIT_PRESETS.flightSearch)
  @ApiOperation({
    summary: 'Search for flights',
    description:
      'Searches the local PostgreSQL inventory (source=INTERNAL_DB). Prices are indicative simulator fares (demo LIGHT/FLEX brands, configurable child/infant multipliers and tax % of base) — not ATPCO/GDS ticket stock.',
  })
  @ApiBody({ type: SearchFlightsDto })
  @ApiOkResponse({
    description: 'Successfully found flights from internal inventory',
    type: SearchFlightsResponse,
  })
  @ApiBadRequestError()
  async createSearch(@Body() dto: SearchFlightsDto, @Query() query: FlightsQueryDto) {
    return this.flightsService.createSearch(dto, query);
  }

  @Get('search/:searchId')
  @RateLimit(RATE_LIMIT_PRESETS.flightSearchPage)
  @ApiOperation({
    summary: 'Get paginated flight search results',
    description:
      'Returns a page from a cached internal-inventory search. Offer prices remain indicative simulator quotes.',
  })
  @ApiParam({ name: 'searchId', description: 'Search session identifier' })
  @ApiOkResponse({
    description: 'Paginated search results',
    type: SearchFlightsResponse,
  })
  @ApiBadRequestError()
  async getPage(@Param('searchId') searchId: string, @Query() query: FlightsQueryDto) {
    return this.flightsService.getSearchPage(searchId, query);
  }
}

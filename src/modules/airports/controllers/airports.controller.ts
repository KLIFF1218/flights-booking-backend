import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiOkResponse } from '@nestjs/swagger';
import { RateLimit, RATE_LIMIT_PRESETS } from 'src/common/decorators';
import { AirportsService } from '../services/airports.service';
import { SearchLocationsDto } from '../dtos/airports-search.dto';
import { AirportsResponseDto } from '../dtos/airport.response.dto';
import { ApiBadRequestError } from 'src/common/swagger/api-responses.decorator';

@ApiTags('Airports')
@Controller({ path: 'airports', version: '1' })
export class AirportsController {
  constructor(private readonly airportsService: AirportsService) {}

  @Get('search')
  @RateLimit(RATE_LIMIT_PRESETS.airportsSearch)
  @ApiOperation({ summary: 'Search airports' })
  @ApiOkResponse({ description: 'Airport search results', type: AirportsResponseDto })
  @ApiBadRequestError()
  async searchAirports(@Query() dto: SearchLocationsDto): Promise<AirportsResponseDto> {
    return this.airportsService.searchAirports(dto);
  }
}

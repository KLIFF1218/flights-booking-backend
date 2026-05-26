import { Controller, Get, Query } from '@nestjs/common';
import { AirportsService } from '../services/airports.service';
import { SearchLocationsDto } from '../dtos/airports-search.dto';
import { AirportsResponseDto } from '../dtos/aiport.response.dto';

@Controller({ path: 'airports', version: '1' })
export class AirportsController {
  constructor(private readonly airportsService: AirportsService) {}

  @Get('search')
  async searchAirports(@Query() dto: SearchLocationsDto): Promise<AirportsResponseDto> {
    return this.airportsService.searchAirports(dto.q);
  }
}

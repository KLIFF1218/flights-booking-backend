import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiOkResponse, ApiQuery } from '@nestjs/swagger';
import { AirportsService } from '../services/airports.service';
import { SearchLocationsDto } from '../dtos/airports-search.dto';
import { AirportsResponseDto } from '../dtos/aiport.response.dto';

@ApiTags('Airports')
@Controller({ path: 'airports', version: '1' })
export class AirportsController {
  constructor(private readonly airportsService: AirportsService) {}

  @Get('search')
  @ApiOperation({ summary: 'Поиск аэропортов' })
  @ApiQuery({ name: 'q', description: 'Текст поиска аэропортов', required: true })
  @ApiQuery({ name: 'countryCode', description: 'Фильтр по коду страны', required: false })
  @ApiQuery({
    name: 'pageLimit',
    description: 'Количество результатов на странице',
    required: false,
    type: Number,
  })
  @ApiQuery({
    name: 'pageOffset',
    description: 'Смещение для пагинации',
    required: false,
    type: Number,
  })
  @ApiQuery({ name: 'sort', description: 'Сортировка результатов', required: false })
  @ApiQuery({ name: 'view', description: 'Уровень детализации результатов', required: false })
  @ApiOkResponse({ description: 'Результат поиска аэропортов', type: AirportsResponseDto })
  async searchAirports(@Query() dto: SearchLocationsDto): Promise<AirportsResponseDto> {
    return this.airportsService.searchAirports(dto.q);
  }
}

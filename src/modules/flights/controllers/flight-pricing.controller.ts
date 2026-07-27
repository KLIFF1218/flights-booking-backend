import { Body, Controller, Post } from '@nestjs/common';
import { ApiTags, ApiBody, ApiOperation, ApiOkResponse } from '@nestjs/swagger';
import { RateLimit, RATE_LIMIT_PRESETS } from 'src/common/decorators';
import { FlightsPricingService } from '../services/flight-pricing.service';
import { FlightPricingRequestDto } from '../dtos/flight-pricing.request.dto';
import {
  FlightPricingResponseDto,
  type FlightPricingResponse,
} from '../dtos/flight-pricing.response.dto';
import { ApiBadRequestError, ApiNotFoundError } from 'src/common/swagger/api-responses.decorator';

@ApiTags('Flight Pricing')
@Controller({ path: 'flight/pricing', version: '1' })
export class FlightPricingController {
  constructor(private readonly pricingService: FlightsPricingService) {}

  @Post()
  @RateLimit(RATE_LIMIT_PRESETS.flightPricing)
  @ApiOperation({
    summary: 'Calculate ticket price',
    description:
      'Builds an indicative quote from internal inventory (pricingMode=indicative, source=INTERNAL_DB). Child/infant multipliers and YQ/YR-style tax lines are configurable demo rules — not ATPCO. Seat FX uses the quote-locked rate table.',
  })
  @ApiBody({ type: FlightPricingRequestDto })
  @ApiOkResponse({
    type: FlightPricingResponseDto,
    description: 'Indicative flight pricing quote from internal inventory',
  })
  @ApiBadRequestError()
  @ApiNotFoundError('Offer not found')
  async price(@Body() dto: FlightPricingRequestDto): Promise<FlightPricingResponse> {
    return await this.pricingService.price(dto.searchId, dto.offerId, dto.options);
  }
}

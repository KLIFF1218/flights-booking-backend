import { Body, Controller, Post } from '@nestjs/common';
import { FlightsPricingService } from '../services/flight-pricing.service';
import { FlightPricingRequestDto } from '../dtos/flight-pricing.request.dto';
import { FlightPricingResponse } from '../dtos/flight-pricing.response.dto';
import { Protected, Roles } from 'src/common/decorators';
import { Role } from '@prisma/client';

@Protected()
@Roles(Role.USER, Role.ADMIN)
@Controller({ path: 'flight/pricing', version: '1' })
export class FlightPricingController {
  constructor(private readonly pricingService: FlightsPricingService) {}
  @Post()
  async price(@Body() dto: FlightPricingRequestDto): Promise<FlightPricingResponse> {
    return await this.pricingService.price(dto.searchId, dto.offerId, dto.options);
  }
}

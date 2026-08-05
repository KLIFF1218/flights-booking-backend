import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { configureFareCharges } from '../utils/pricing/fare-charges.util';
import { configureTurnaround } from '../utils/search/turnaround.util';

@Injectable()
export class FlightsConfigBootstrap implements OnModuleInit {
  constructor(private readonly config: ConfigService) {}

  onModuleInit(): void {
    configureFareCharges({
      taxYqRate: Number(this.config.get('FARE_TAX_YQ_RATE') ?? 0.08),
      taxYrRate: Number(this.config.get('FARE_TAX_YR_RATE') ?? 0.05),
      bookingServiceFee: Number(this.config.get('BOOKING_SERVICE_FEE') ?? 5),
    });

    configureTurnaround({
      domesticMinutes: Number(this.config.get('MIN_DOMESTIC_TURNAROUND_MINUTES') ?? 120),
      internationalMinutes: Number(this.config.get('MIN_INTERNATIONAL_TURNAROUND_MINUTES') ?? 180),
    });
  }
}

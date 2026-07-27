import { Module } from '@nestjs/common';
import { FlightsService } from './services/flights.service';
import { FlightsController } from './controllers/flights.controller';
import { RedisModule } from 'src/infra/redis/redis.module';
import { FlightsPricingService } from './services/flight-pricing.service';
import { FlightPricingController } from './controllers/flight-pricing.controller';
import { FlightsSearchStore } from './services/flights-cache.service';
import { FLIGHT_SEARCH_PROVIDER } from './providers/flight-search.provider';
import { FLIGHT_PRICING_PROVIDER } from './providers/flight-pricing.provider';
import { DbFlightsSearchProvider } from './services/db-flight-search.service';
import { DbPricingProvider } from './services/db-pricing-provider.service';
import { FlightOfferMapper } from './services/flight-offer.mapper';
import { CalculateSeatPrice } from './services/calculate-seatprice.service';
import { CurrencyRatesService } from './services/currency-rates.service';
import { FlightScheduleSyncService } from './services/flight-schedule-sync.service';
import { FlightsConfigBootstrap } from './services/flights-config.bootstrap';

@Module({
  imports: [RedisModule],
  controllers: [FlightsController, FlightPricingController],
  providers: [
    FlightOfferMapper,
    CalculateSeatPrice,
    CurrencyRatesService,
    FlightsService,
    DbFlightsSearchProvider,
    FlightsPricingService,
    FlightsSearchStore,
    DbPricingProvider,
    FlightScheduleSyncService,
    FlightsConfigBootstrap,
    {
      provide: FLIGHT_SEARCH_PROVIDER,
      useClass: DbFlightsSearchProvider,
    },
    {
      provide: FLIGHT_PRICING_PROVIDER,
      useClass: DbPricingProvider,
    },
  ],
  exports: [
    FlightsSearchStore,
    FLIGHT_SEARCH_PROVIDER,
    FLIGHT_PRICING_PROVIDER,
    DbPricingProvider,
    CurrencyRatesService,
    FlightScheduleSyncService,
  ],
})
export class FlightsModule {}

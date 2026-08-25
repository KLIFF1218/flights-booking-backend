import { Module } from '@nestjs/common';
import { FlightsService } from './services/flights.service';
import { FlightsController } from './controllers/flights.controller';
import { RedisModule } from 'src/infra/redis/redis.module';
import { FlightsPricingService } from './services/pricing/flight-pricing.service';
import { FlightPricingController } from './controllers/flight-pricing.controller';
import { FlightsSearchStore } from './services/cache/flights-cache.service';
import { FLIGHT_SEARCH_PROVIDER } from './providers/flight-search.provider';
import { FLIGHT_PRICING_PROVIDER } from './providers/flight-pricing.provider';
import { DbFlightsSearchProvider } from './services/search/db-flight-search.service';
import { DbPricingProvider } from './services/pricing/db-pricing-provider.service';
import { FlightOfferMapper } from './services/mappers/flight-offer.mapper';
import { CalculateSeatPrice } from './services/pricing/calculate-seatprice.service';
import { CurrencyRatesService } from './services/pricing/currency-rates.service';
import { FlightScheduleSyncService } from './services/schedule/flight-schedule-sync.service';
import { FlightsConfigBootstrap } from './services/schedule/flights-config.bootstrap';
import { BookingSnapshotOfferService } from './services/cache/booking-snapshot-offer.service';

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
    BookingSnapshotOfferService,
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
    BookingSnapshotOfferService,
    CurrencyRatesService,
    FlightScheduleSyncService,
  ],
})
export class FlightsModule {}

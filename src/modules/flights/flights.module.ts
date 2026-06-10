import { Module } from '@nestjs/common';
import { FlightsService } from './services/flights.service';
import { FlightsController } from './controllers/flights.controller';
import { PrismaService } from 'src/infra/db/prisma/prisma.service';
import { RedisModule } from 'src/redis/redis.module';
import { FlightsPricingService } from './services/flight-pricing.service';
import { FlightPricingController } from './controllers/flight-pricing.controller';
import { FlightsSearchStore } from './services/flights-cache.service';
import { MetricsService } from '../../infra/metrics/metrics.service';
import { FLIGHT_SEARCH_PROVIDER } from './providers/flight-search.provider';
import { DbFlightsSearchProvider } from './services/db-flight-search.service';
import { DbPricingProvider } from './services/DbPricingProvider.service';

@Module({
  imports: [RedisModule],
  controllers: [FlightsController, FlightPricingController],
  providers: [
    FlightsService,
    PrismaService,
    DbFlightsSearchProvider,
    FlightsPricingService,
    FlightsSearchStore,
    MetricsService,
    DbPricingProvider,
    {
      provide: FLIGHT_SEARCH_PROVIDER,
      useClass: DbFlightsSearchProvider,
    },
  ],
  exports: [FlightsSearchStore, FLIGHT_SEARCH_PROVIDER, DbPricingProvider],
})
export class FlightsModule {}

import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { LoggerModule } from 'nestjs-pino';
import currencyConfig from 'src/config/currency.config';
import { PrismaModule } from 'src/infra/db/prisma/prisma.module';
import { MetricsModule } from 'src/infra/metrics/metrics.module';
import { RedisModule } from 'src/infra/redis/redis.module';
import { AuthModule } from 'src/modules/auth/auth.module';
import { FlightsModule } from 'src/modules/flights/flights.module';
import { SeatMapModule } from 'src/modules/seatmaps/seatmap.module';
import { BookingMetricsModule } from 'src/modules/bookings/metrics/booking-metrics.module';
import { BookingsCacheModule } from 'src/modules/bookings/bookings-cache.module';
import { SeatReleaseModule } from 'src/modules/bookings/seat-release.module';
import { FlightBookingController } from 'src/modules/bookings/controllers/flight-booking.controller';
import { BookingTicketController } from 'src/modules/bookings/controllers/booking-ticket.controller';
import { BookingsService } from 'src/modules/bookings/services/bookings.service';
import { BookingWorkflowService } from 'src/modules/bookings/services/booking-workflow.service';
import { BookingCreationService } from 'src/modules/bookings/services/booking-creation.service';
import { BookingCheckoutService } from 'src/modules/bookings/services/booking-checkout.service';
import { BookingPaymentService } from 'src/modules/bookings/services/booking-payment.service';
import { BookingSeatService } from 'src/modules/bookings/services/booking-seat.service';
import { BookingTravelerService } from 'src/modules/bookings/services/booking-traveler.service';
import { BookingTicketService } from 'src/modules/bookings/services/booking-ticket.service';
import { BookingIdempotencyService } from 'src/modules/bookings/services/booking-idempotency.service';
import { S3Service } from 'src/infra/storage/s3.service';
import { OutboxE2eModule } from './outbox-e2e.module';
import { BookingExpirationE2eModule } from './booking-expiration-e2e.module';
import { PaymentsE2eModule } from './payments-e2e.module';
import { s3E2eStub } from './e2e-payment.stubs';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [currencyConfig],
    }),
    LoggerModule.forRoot({
      pinoHttp: {
        level: 'silent',
        autoLogging: false,
      },
    }),
    PrismaModule,
    MetricsModule,
    RedisModule,
    AuthModule,
    FlightsModule,
    BookingMetricsModule,
    BookingsCacheModule,
    SeatReleaseModule,
    SeatMapModule,
    OutboxE2eModule,
    BookingExpirationE2eModule,
    PaymentsE2eModule,
  ],
  controllers: [FlightBookingController, BookingTicketController],
  providers: [
    BookingsService,
    BookingWorkflowService,
    BookingCreationService,
    BookingCheckoutService,
    BookingPaymentService,
    BookingSeatService,
    BookingTravelerService,
    BookingTicketService,
    BookingIdempotencyService,
    { provide: S3Service, useValue: s3E2eStub },
  ],
})
export class BookingsE2eModule {}

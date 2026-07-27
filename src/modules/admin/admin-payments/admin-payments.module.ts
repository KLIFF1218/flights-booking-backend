import { Module } from '@nestjs/common';
import { AdminPaymentsService } from './admin-payments.service';
import { AdminPaymentsController } from './admin-payments.controller';
import { YoomoneyModule } from 'src/modules/payment/providers/yoomoney/yoomoney.module';
import { BookingsCacheModule } from 'src/modules/bookings/bookings-cache.module';
import { SeatReleaseModule } from 'src/modules/bookings/seat-release.module';
import { OutboxModule } from 'src/infra/outbox/outbox.module';

@Module({
  imports: [YoomoneyModule, BookingsCacheModule, SeatReleaseModule, OutboxModule],
  controllers: [AdminPaymentsController],
  providers: [AdminPaymentsService],
})
export class AdminPaymentsModule {}

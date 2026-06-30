import { Module } from '@nestjs/common';
import { AdminPaymentsService } from './admin-payments.service';
import { AdminPaymentsController } from './admin-payments.controller';
import { YoomoneyModule } from 'src/modules/payment/providers/yoomoney/yoomoney.module';

@Module({
  imports: [YoomoneyModule],
  controllers: [AdminPaymentsController],
  providers: [AdminPaymentsService],
})
export class AdminPaymentsModule {}

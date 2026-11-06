import { Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Logger } from 'nestjs-pino';
import { CurrencyRatesService } from '../../flights/services/pricing/currency-rates.service';

@Injectable()
export class FxRatesSchedulerService {
  constructor(
    private readonly currencyRatesService: CurrencyRatesService,
    private readonly logger: Logger,
  ) {}

  @Cron(CronExpression.EVERY_HOUR)
  async refreshFxRates() {
    try {
      await this.currencyRatesService.refreshRates();
      this.logger.log('FX rates refreshed');
    } catch (error) {
      this.logger.error(error, 'FX rates refresh failed');
    }
  }
}

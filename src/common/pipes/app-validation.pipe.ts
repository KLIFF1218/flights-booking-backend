import {
  Injectable,
  ValidationPipe,
  type ArgumentMetadata,
  type ValidationPipeOptions,
} from '@nestjs/common';
import { YooKassaWebhookDto } from 'src/modules/payment/webhook/dto/yookassa-webhook.dto';

const DEFAULT_VALIDATION_OPTIONS: ValidationPipeOptions = {
  transform: true,
  whitelist: true,
  forbidNonWhitelisted: true,
  transformOptions: {
    enableImplicitConversion: true,
  },
};

const YOOKASSA_WEBHOOK_VALIDATION_OPTIONS: ValidationPipeOptions = {
  ...DEFAULT_VALIDATION_OPTIONS,
  forbidNonWhitelisted: false,
};

/**
 * Singleton-scoped global validation.
 * YooKassa webhooks allow extra PSP fields, bypassed dynamically via metatype.
 */
@Injectable()
export class AppValidationPipe extends ValidationPipe {
  constructor() {
    super(DEFAULT_VALIDATION_OPTIONS);
  }

  override async transform(value: unknown, metadata: ArgumentMetadata) {
    if (metadata.metatype === YooKassaWebhookDto) {
      const pipe = new ValidationPipe(YOOKASSA_WEBHOOK_VALIDATION_OPTIONS);
      return pipe.transform(value, metadata) as Promise<unknown>;
    }
    return super.transform(value, metadata) as Promise<unknown>;
  }
}

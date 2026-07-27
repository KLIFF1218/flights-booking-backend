import type { ConfigService } from '@nestjs/config';

export interface ResendConfig {
  apiKey: string;
  from: string;
}

export const getResendConfig = (configService: ConfigService): ResendConfig => {
  const fromEmail = configService.getOrThrow<string>('MAIL_FROM');

  return {
    apiKey: configService.getOrThrow<string>('RESEND_API_KEY'),
    from: `"MaxAirline" <${fromEmail}>`,
  };
};

import type { MailerOptions } from '@nestjs-modules/mailer';
import type { ConfigService } from '@nestjs/config';

export const getMailerConfig = (configService: ConfigService): MailerOptions => {
  const host = configService.getOrThrow<string>('MAILEXAM_HOST');
  const port = Number(configService.getOrThrow<string | number>('MAILEXAM_PORT')); // <-- важно: Number()
  const user = configService.getOrThrow<string>('MAILEXAM_LOGIN');
  const pass = configService.getOrThrow<string>('MAILEXAM_PASSWORD');
  const from = configService.getOrThrow<string>('MAIL_FROM');

  return {
    transport: {
      host,
      port,
      secure: port === 465,
      auth: {
        user,
        pass,
      },
      tls: {
        rejectUnauthorized: false,
      },
    },
    defaults: {
      from: `"MaxAirline" <${from}>`,
    },
  };
};

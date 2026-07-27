import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Logger } from 'nestjs-pino';
import { Resend } from 'resend';
import { MetricsService } from 'src/infra/metrics/metrics.service';
import { runSafely } from 'src/common/utils/safe-metrics.util';
import { renderEmailVerificationEmail } from 'src/infra/mail/templates/email-verification.template';
import { renderPasswordResetEmail } from 'src/infra/mail/templates/password-reset.template';

/**
 * Sends auth-related emails via Resend directly (no Bull dependency),
 * so slim e2e apps can override this provider without Redis/Bull/S3.
 */
@Injectable()
export class AuthEmailService {
  private readonly resend: Resend | null;
  private readonly from: string;
  private readonly appUrl: string;

  constructor(
    private readonly config: ConfigService,
    private readonly logger: Logger,
    private readonly metrics: MetricsService,
  ) {
    const apiKey = config.get<string>('RESEND_API_KEY');
    this.from = config.get<string>('MAIL_FROM') ?? 'onboarding@resend.dev';
    this.appUrl = (config.get<string>('APP_URL') ?? 'http://localhost').replace(/\/$/, '');
    this.resend = apiKey ? new Resend(apiKey) : null;
  }

  buildVerifyUrl(token: string): string {
    return `${this.appUrl}/auth/verify?token=${encodeURIComponent(token)}`;
  }

  buildResetUrl(token: string): string {
    return `${this.appUrl}/auth/reset-password?token=${encodeURIComponent(token)}`;
  }

  async sendVerification(email: string, token: string): Promise<void> {
    await this.send(
      email,
      'Verify your email',
      renderEmailVerificationEmail(this.buildVerifyUrl(token)),
      'email_verification',
    );
  }

  async sendPasswordReset(email: string, token: string): Promise<void> {
    await this.send(
      email,
      'Reset your password',
      renderPasswordResetEmail(this.buildResetUrl(token)),
      'password_reset',
    );
  }

  private async send(
    email: string,
    subject: string,
    html: string,
    mailType: string,
  ): Promise<void> {
    if (!this.resend) {
      this.logger.warn({ mailType, email }, 'RESEND_API_KEY missing; auth email not sent');
      throw new Error('Email delivery is not configured (RESEND_API_KEY missing)');
    }

    try {
      const { error } = await this.resend.emails.send({
        from: this.from,
        to: [email],
        subject,
        html,
      });

      if (error) {
        throw new Error(error.message);
      }

      runSafely(() => this.metrics.recordEmailSent(mailType, 'sent'));
    } catch (error: unknown) {
      runSafely(() => this.metrics.recordEmailFailed(mailType, 'send_error'));
      this.logger.error(
        { err: error instanceof Error ? error : String(error), mailType, email },
        'Auth email send failed',
      );
      throw error;
    }
  }
}

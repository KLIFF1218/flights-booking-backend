import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request } from 'express';

@Injectable()
export class MetricsAuthGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const token = this.config.get<string>('METRICS_AUTH_TOKEN')?.trim();

    if (!token) {
      if (this.config.get<string>('NODE_ENV') === 'production') {
        throw new UnauthorizedException('Metrics endpoint is not configured');
      }

      return true;
    }

    if (this.config.get<string>('NODE_ENV') !== 'production') {
      return true;
    }

    const request = context.switchToHttp().getRequest<Request>();
    const authorization = request.headers.authorization;
    const headerToken = request.headers['x-metrics-token'];

    if (authorization === `Bearer ${token}`) {
      return true;
    }

    if (typeof headerToken === 'string' && headerToken === token) {
      return true;
    }

    throw new UnauthorizedException('Invalid metrics credentials');
  }
}

import { Injectable, BeforeApplicationShutdown } from '@nestjs/common';
import { Logger } from 'nestjs-pino';

@Injectable()
export class ApplicationShutdownService implements BeforeApplicationShutdown {
  constructor(private readonly logger: Logger) {}

  beforeApplicationShutdown(signal?: string): void {
    this.logger.log({ signal: signal ?? 'unknown' }, 'Application shutdown initiated');
  }
}

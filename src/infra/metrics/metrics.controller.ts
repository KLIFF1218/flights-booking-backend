import { Controller, Get, Res, UseGuards, VERSION_NEUTRAL } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import type { Response } from 'express';
import { register } from 'prom-client';
import { SkipRateLimit } from 'src/common/decorators';
import { MetricsAuthGuard } from 'src/common/guards/metrics-auth.guard';

@ApiExcludeController()
@SkipRateLimit()
@UseGuards(MetricsAuthGuard)
@Controller({
  path: 'metrics',
  version: VERSION_NEUTRAL,
})
export class MetricsController {
  @Get()
  async metrics(@Res() res: Response) {
    res.setHeader('Content-Type', register.contentType);
    res.end(await register.metrics());
  }
}

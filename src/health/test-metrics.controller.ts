import { Controller, Get, Res } from '@nestjs/common';
import type { Response } from 'express';
import { register } from 'prom-client';

@Controller('test-metrics')
export class TestMetricsController {
  @Get()
  async metrics(@Res() res: Response) {
    console.log(await register.getMetricsAsJSON());

    res.setHeader('Content-Type', register.contentType);
    res.end(await register.metrics());
  }
}

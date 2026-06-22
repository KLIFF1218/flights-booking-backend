import { Controller, Get, Res } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiOkResponse } from '@nestjs/swagger';
import type { Response } from 'express';
import { register } from 'prom-client';

@ApiTags('Metrics')
@Controller('test-metrics')
export class TestMetricsController {
  @Get()
  async metrics(@Res() res: Response) {
    console.log(await register.getMetricsAsJSON());

    res.setHeader('Content-Type', register.contentType);
    res.end(await register.metrics());
  }
}

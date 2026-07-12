import { Module } from '@nestjs/common';
import { AirlinesController } from './airlines.controller';
import { AirlinesService } from './airlines.service';

@Module({
  controllers: [AirlinesController],
  providers: [AirlinesService],
})
export class AirlinesModule {}

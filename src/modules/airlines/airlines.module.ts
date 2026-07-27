import { Module } from '@nestjs/common';
import { AirlinesController } from './controllers/airlines.controller';
import { AirlinesService } from './airlines.service';

@Module({
  controllers: [AirlinesController],
  providers: [AirlinesService],
})
export class AirlinesModule {}

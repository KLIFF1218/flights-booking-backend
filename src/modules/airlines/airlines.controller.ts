import { Controller, Get } from '@nestjs/common';
import { AirlinesService } from './airlines.service';
import { Protected, Roles } from 'src/common/decorators';
import { Role } from '@prisma/client';

@Protected()
@Roles(Role.ADMIN)
@Controller('airlines')
export class AirlinesController {
  constructor(private readonly airlinesService: AirlinesService) {}

  @Get()
  getAirlines() {
    return this.airlinesService.getAirlines();
  }
}
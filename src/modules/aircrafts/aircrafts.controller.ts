import { Controller, Get } from '@nestjs/common';
import { AircraftsService } from './aircrafts.service';
import { Protected, Roles } from 'src/common/decorators';
import { Role } from '@prisma/client';

@Protected()
@Roles(Role.ADMIN)
@Controller({ path: 'aircrafts', version: '1' })
export class AircraftsController {
  constructor(private readonly aircraftsService: AircraftsService) {}

  @Get()
  findAll() {
    return this.aircraftsService.findAll();
  }
}

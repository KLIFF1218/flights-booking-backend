import { Controller, Get } from '@nestjs/common';
import { AdminAirportsService } from './admin-airports.service';

@Controller({ path: 'admin-airports', version: '1' })
export class AdminAirportsController {
  constructor(private readonly adminAirportsService: AdminAirportsService) {}

  @Get()
  findAll() {
    return this.adminAirportsService.findAll();
  }
}

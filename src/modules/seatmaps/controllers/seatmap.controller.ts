import { Body, Controller, Post } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiBody, ApiOkResponse } from '@nestjs/swagger';
import { SeatMapsService } from '../services/seatmap.service';
import { SeatMapDto, SeatMapResponseDto } from '../dtos/seatmap.dto';
import { Protected, Roles } from 'src/common/decorators';
import { Role } from '@prisma/client';
import {
  ApiBadRequestError,
  ApiNotFoundError,
  ApiUserAuthErrors,
} from 'src/common/swagger/api-responses.decorator';

@ApiTags('Seat Maps')
@ApiBearerAuth('bearerAuth')
@Protected()
@Roles(Role.USER, Role.ADMIN)
@Controller({ path: 'seatmaps', version: '1' })
export class SeatmapsController {
  constructor(private readonly seatmapService: SeatMapsService) {}

  @Post('by-offer')
  @ApiOperation({
    summary: 'Get seat map by flight offer',
    description: 'Used before booking. Allows showing the client available seats and prices.',
  })
  @ApiBody({ type: SeatMapDto })
  @ApiOkResponse({ type: SeatMapResponseDto, description: 'Seat map by segments' })
  @ApiUserAuthErrors()
  @ApiBadRequestError()
  @ApiNotFoundError('Offer not found')
  async getSeatMapByOffer(@Body() dto: SeatMapDto) {
    return await this.seatmapService.getSeatMapByOffer(dto);
  }
}

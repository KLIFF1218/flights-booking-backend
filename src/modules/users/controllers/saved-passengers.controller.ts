import { Body, Controller, Delete, Get, Param, Post } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { Authorized, Protected, Roles } from 'src/common/decorators';
import { Role } from '@prisma/client';
import { CreateSavedPassengerDto } from '../dtos/create-saved-passenger.dto';
import { SyncSavedPassengersDto } from '../dtos/sync-saved-passengers.dto';
import { SavedPassengerResponseDto } from '../dtos/saved-passenger-response.dto';
import { SavedPassengersService } from '../services/saved-passengers.service';
import {
  ApiBadRequestError,
  ApiConflictError,
  ApiNotFoundError,
  ApiUserAuthErrors,
  SuccessResponseDto,
} from 'src/common/swagger/api-responses.decorator';

@ApiTags('Users')
@ApiBearerAuth('bearerAuth')
@Protected()
@Roles(Role.USER, Role.ADMIN)
@Controller({ path: 'users/me/passengers', version: '1' })
export class SavedPassengersController {
  constructor(private readonly savedPassengersService: SavedPassengersService) {}

  @Get()
  @ApiOperation({ summary: 'List saved passengers for the current user' })
  @ApiOkResponse({ type: [SavedPassengerResponseDto] })
  @ApiUserAuthErrors()
  list(@Authorized('id') userId: string) {
    return this.savedPassengersService.listForUser(userId);
  }

  @Post()
  @ApiOperation({ summary: 'Save a passenger to the profile' })
  @ApiBody({ type: CreateSavedPassengerDto })
  @ApiOkResponse({ type: SavedPassengerResponseDto })
  @ApiUserAuthErrors()
  @ApiBadRequestError()
  @ApiConflictError('Passenger with this passport already saved')
  create(@Authorized('id') userId: string, @Body() dto: CreateSavedPassengerDto) {
    return this.savedPassengersService.createForUser(userId, dto);
  }

  @Post('sync')
  @ApiOperation({ summary: 'Sync passengers from a booking (upsert by passport)' })
  @ApiBody({ type: SyncSavedPassengersDto })
  @ApiOkResponse({ type: [SavedPassengerResponseDto] })
  @ApiUserAuthErrors()
  @ApiBadRequestError()
  sync(@Authorized('id') userId: string, @Body() dto: SyncSavedPassengersDto) {
    return this.savedPassengersService.upsertFromBookingTravelers(userId, dto.travelers);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a saved passenger' })
  @ApiParam({ name: 'id', description: 'Saved passenger ID' })
  @ApiOkResponse({ type: SuccessResponseDto, description: 'Passenger deleted' })
  @ApiUserAuthErrors()
  @ApiNotFoundError('Passenger not found')
  async remove(@Authorized('id') userId: string, @Param('id') profileId: string) {
    await this.savedPassengersService.deleteForUser(userId, profileId);
    return { success: true };
  }
}

import { Body, Controller, Get, Patch } from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiBody,
  ApiOkResponse,
} from '@nestjs/swagger';
import { UsersService } from '../users.service';
import { UserResponseDto } from '../dtos/user-response.dto';
import { Protected, Authorized } from 'src/common/decorators';
import { UpdateSettingsDto } from '../dtos/update-settings.dto';
import { UpdateProfileDto } from '../dtos/update-profile.dto';
import { Roles } from 'src/common/decorators';
import { Role } from '@prisma/client';
import { UserSettingsResponseDto } from '../dtos/user-settings-response.dto';
import {
  ApiBadRequestError,
  ApiConflictError,
  ApiNotFoundError,
  ApiUserAuthErrors,
} from 'src/common/swagger/api-responses.decorator';

@ApiTags('Users')
@ApiBearerAuth('bearerAuth')
@Protected()
@Roles(Role.USER, Role.ADMIN)
@Controller({ path: 'users', version: '1' })
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('me')
  @ApiOperation({ summary: 'Get current user data' })
  @ApiResponse({ status: 200, type: UserResponseDto })
  @ApiUserAuthErrors()
  async getMe(@Authorized('id') userId: string) {
    return this.usersService.getPublicProfile(userId);
  }

  @Patch('profile')
  @ApiOperation({ summary: 'Update user profile' })
  @ApiBody({ type: UpdateProfileDto })
  @ApiOkResponse({ type: UserResponseDto, description: 'Profile updated' })
  @ApiUserAuthErrors()
  @ApiBadRequestError()
  @ApiConflictError('Email already in use')
  @ApiNotFoundError('User not found')
  updateProfile(@Authorized('id') userId: string, @Body() dto: UpdateProfileDto) {
    return this.usersService.updateProfile(userId, dto);
  }

  @Get('settings')
  @ApiOperation({ summary: 'Get user settings' })
  @ApiOkResponse({ type: UserSettingsResponseDto, description: 'User settings retrieved' })
  @ApiUserAuthErrors()
  getSettings(@Authorized('id') userId: string) {
    return this.usersService.getSettings(userId);
  }

  @Patch('settings')
  @ApiOperation({ summary: 'Update user settings' })
  @ApiBody({ type: UpdateSettingsDto })
  @ApiOkResponse({ type: UserSettingsResponseDto, description: 'Settings updated' })
  @ApiUserAuthErrors()
  @ApiBadRequestError()
  @ApiNotFoundError('User not found')
  updateSettings(@Authorized('id') userId: string, @Body() dto: UpdateSettingsDto) {
    return this.usersService.updateSettings(userId, dto);
  }
}

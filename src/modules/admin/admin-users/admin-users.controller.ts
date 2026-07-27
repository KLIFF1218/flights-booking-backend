import { Controller, Get, Param, Patch, Query } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiOkResponse, ApiParam } from '@nestjs/swagger';

import { Roles } from 'src/common/decorators';
import { Role } from '@prisma/client';

import { AdminUsersService } from './admin-users.service';
import { AdminUsersQueryDto } from './dtos/admin-users-query.dto';
import { Protected } from 'src/common/decorators';
import {
  AdminUserSummaryDto,
  AdminUsersListResponseDto,
  AdminUserStatusResponseDto,
} from './dtos/admin-user-response.dto';
import {
  ApiAdminAuthErrors,
  ApiBadRequestError,
  ApiNotFoundError,
} from 'src/common/swagger/api-responses.decorator';

@ApiTags('Admin / Users')
@ApiBearerAuth('bearerAuth')
@Controller({ path: 'admin/users', version: '1' })
@Protected()
@Roles(Role.ADMIN)
export class AdminUsersController {
  constructor(private readonly adminUsersService: AdminUsersService) {}

  @Get()
  @ApiOperation({ summary: 'Get users list' })
  @ApiOkResponse({
    type: AdminUsersListResponseDto,
    description: 'Users list retrieved successfully',
  })
  @ApiAdminAuthErrors()
  @ApiBadRequestError()
  async findAll(@Query() query: AdminUsersQueryDto) {
    return this.adminUsersService.findAll(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get user by ID' })
  @ApiParam({ name: 'id', description: 'User ID' })
  @ApiOkResponse({ type: AdminUserSummaryDto, description: 'User found' })
  @ApiAdminAuthErrors()
  @ApiNotFoundError('User not found')
  async findOne(@Param('id') id: string) {
    return this.adminUsersService.findOne(id);
  }

  @Patch(':id/block')
  @ApiOperation({ summary: 'Block user' })
  @ApiParam({ name: 'id', description: 'User ID' })
  @ApiOkResponse({ type: AdminUserStatusResponseDto, description: 'User blocked' })
  @ApiAdminAuthErrors()
  @ApiNotFoundError('User not found')
  async block(@Param('id') id: string) {
    return this.adminUsersService.blockUser(id);
  }

  @Patch(':id/unblock')
  @ApiOperation({ summary: 'Unblock user' })
  @ApiParam({ name: 'id', description: 'User ID' })
  @ApiOkResponse({ type: AdminUserStatusResponseDto, description: 'User unblocked' })
  @ApiAdminAuthErrors()
  @ApiNotFoundError('User not found')
  async unblock(@Param('id') id: string) {
    return this.adminUsersService.unblockUser(id);
  }
}

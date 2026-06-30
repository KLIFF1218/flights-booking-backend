import { Controller, Get, Param, Patch, Query } from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiOkResponse,
  ApiUnauthorizedResponse,
  ApiForbiddenResponse,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';

import { Roles } from 'src/common/decorators';
import { Role } from '@prisma/client';

import { AdminUsersService } from './admin-users.service';
import { AdminUsersQueryDto } from './dto/admin-users-query.dto';
import { Protected } from 'src/common/decorators';

@ApiTags('Admin / Users')
@ApiBearerAuth()
@Controller({ path: 'admin/users', version: '1' })
@Protected()
@Roles(Role.ADMIN)
export class AdminUsersController {
  constructor(private readonly adminUsersService: AdminUsersService) {}

  @Get()
  @ApiOperation({ summary: 'Получить список пользователей' })
  @ApiQuery({ name: 'search', required: false, description: 'Фильтрация по имени или email' })
  @ApiQuery({ name: 'page', required: false, description: 'Номер страницы', type: Number })
  @ApiQuery({ name: 'limit', required: false, description: 'Размер страницы', type: Number })
  @ApiOkResponse({ description: 'Список пользователей успешно получен' })
  @ApiUnauthorizedResponse({ description: 'Требуется аутентификация' })
  @ApiForbiddenResponse({ description: 'Требуется роль ADMIN' })
  async findAll(@Query() query: AdminUsersQueryDto) {
    return this.adminUsersService.findAll(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Получить пользователя по ID' })
  @ApiParam({ name: 'id', description: 'ID пользователя' })
  @ApiOkResponse({ description: 'Пользователь найден' })
  @ApiUnauthorizedResponse({ description: 'Требуется аутентификация' })
  @ApiForbiddenResponse({ description: 'Требуется роль ADMIN' })
  async findOne(@Param('id') id: string) {
    return this.adminUsersService.findOne(id);
  }

  @Patch(':id/block')
  @ApiOperation({ summary: 'Заблокировать пользователя' })
  @ApiParam({ name: 'id', description: 'ID пользователя' })
  @ApiOkResponse({ description: 'Пользователь заблокирован' })
  @ApiUnauthorizedResponse({ description: 'Требуется аутентификация' })
  @ApiForbiddenResponse({ description: 'Требуется роль ADMIN' })
  async block(@Param('id') id: string) {
    return this.adminUsersService.blockUser(id);
  }

  @Patch(':id/unblock')
  @ApiOperation({ summary: 'Разблокировать пользователя' })
  @ApiParam({ name: 'id', description: 'ID пользователя' })
  @ApiOkResponse({ description: 'Пользователь разблокирован' })
  @ApiUnauthorizedResponse({ description: 'Требуется аутентификация' })
  @ApiForbiddenResponse({ description: 'Требуется роль ADMIN' })
  async unblock(@Param('id') id: string) {
    return this.adminUsersService.unblockUser(id);
  }
}

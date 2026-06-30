import { Controller, Param, Post } from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiOkResponse,
  ApiParam,
  ApiUnauthorizedResponse,
  ApiForbiddenResponse,
} from '@nestjs/swagger';
import { AdminPaymentsService } from './admin-payments.service';
import { Protected, Roles } from 'src/common/decorators';
import { Role } from '@prisma/client';

@ApiTags('Admin / Payments')
@ApiBearerAuth()
@Protected()
@Roles(Role.ADMIN)
@Controller({ path: 'admin/payments', version: '1' })
export class AdminPaymentsController {
  constructor(private readonly adminPaymentsService: AdminPaymentsService) {}

  @Post(':transactionId/confirm')
  @ApiOperation({ summary: 'Подтвердить платёж' })
  @ApiParam({ name: 'transactionId', description: 'ID транзакции' })
  @ApiOkResponse({ description: 'Транзакция подтверждена' })
  @ApiUnauthorizedResponse({ description: 'Требуется аутентификация' })
  @ApiForbiddenResponse({ description: 'Требуется роль ADMIN' })
  confirm(@Param('transactionId') transactionId: string) {
    return this.adminPaymentsService.confirm(transactionId);
  }

  @Post(':transactionId/cancel')
  @ApiOperation({ summary: 'Отменить платёж' })
  @ApiParam({ name: 'transactionId', description: 'ID транзакции' })
  @ApiOkResponse({ description: 'Транзакция отменена' })
  @ApiUnauthorizedResponse({ description: 'Требуется аутентификация' })
  @ApiForbiddenResponse({ description: 'Требуется роль ADMIN' })
  cancel(@Param('transactionId') transactionId: string) {
    return this.adminPaymentsService.cancel(transactionId);
  }
}

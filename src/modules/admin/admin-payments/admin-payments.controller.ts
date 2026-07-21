import { Controller, Param, Post } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiOkResponse, ApiParam } from '@nestjs/swagger';
import { AdminPaymentsService } from './admin-payments.service';
import { Protected, Roles } from 'src/common/decorators';
import { Role } from '@prisma/client';
import {
  ApiAdminAuthErrors,
  ApiBadRequestError,
  ApiNotFoundError,
  SuccessResponseDto,
} from 'src/common/swagger/api-responses.decorator';

@ApiTags('Admin / Payments')
@ApiBearerAuth('bearerAuth')
@Protected()
@Roles(Role.ADMIN)
@Controller({ path: 'admin/payments', version: '1' })
export class AdminPaymentsController {
  constructor(private readonly adminPaymentsService: AdminPaymentsService) {}

  @Post(':transactionId/confirm')
  @ApiOperation({ summary: 'Confirm payment' })
  @ApiParam({ name: 'transactionId', description: 'Transaction ID' })
  @ApiOkResponse({ type: SuccessResponseDto, description: 'Transaction confirmed' })
  @ApiAdminAuthErrors()
  @ApiNotFoundError('Transaction not found')
  @ApiBadRequestError()
  confirm(@Param('transactionId') transactionId: string) {
    return this.adminPaymentsService.confirm(transactionId);
  }

  @Post(':transactionId/cancel')
  @ApiOperation({ summary: 'Cancel payment' })
  @ApiParam({ name: 'transactionId', description: 'Transaction ID' })
  @ApiOkResponse({ type: SuccessResponseDto, description: 'Transaction cancelled' })
  @ApiAdminAuthErrors()
  @ApiNotFoundError('Transaction not found')
  @ApiBadRequestError()
  cancel(@Param('transactionId') transactionId: string) {
    return this.adminPaymentsService.cancel(transactionId);
  }
}

import { Controller, Get, Param } from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiOkResponse,
  ApiNotFoundResponse,
  ApiUnauthorizedResponse,
  ApiForbiddenResponse,
} from '@nestjs/swagger';
import { Authorized, Protected, Roles } from 'src/common/decorators';
import { Role } from '@prisma/client';
import { PaymentTransactionQueryService } from '../services/payment-transaction-query.service';
import { TransactionStatusResponseDto } from '../dtos/transaction-status-response.dto';

@ApiTags('Payments')
@ApiBearerAuth('bearerAuth')
@Protected()
@Roles(Role.USER, Role.ADMIN)
@Controller({ path: 'payment', version: '1' })
export class PaymentController {
  constructor(private readonly paymentTransactionQuery: PaymentTransactionQueryService) {}

  @Get('transaction/:id')
  @ApiOperation({ summary: 'Get transaction status' })
  @ApiParam({ name: 'id', description: 'Transaction ID' })
  @ApiOkResponse({
    type: TransactionStatusResponseDto,
  })
  @ApiNotFoundResponse({ description: 'Transaction not found' })
  @ApiUnauthorizedResponse({ description: 'Authentication required' })
  @ApiForbiddenResponse({ description: 'USER or ADMIN role required' })
  async getTransactionStatus(
    @Param('id') id: string,
    @Authorized('id') userId: string,
  ): Promise<TransactionStatusResponseDto> {
    return this.paymentTransactionQuery.getTransactionStatus(id, userId);
  }
}

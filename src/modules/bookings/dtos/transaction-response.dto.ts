import { ApiProperty } from '@nestjs/swagger';
import { Currency, PaymentProvider, TransactionStatus } from '@prisma/client';

export class TransactionResponseDto {
  @ApiProperty({
    example: 'clu3ya4x0003lz0q2az7x9n20',
    description: 'ID транзакции',
  })
  id: string;

  @ApiProperty({ example: 450.0, description: 'Сумма транзакции' })
  amount: number;

  @ApiProperty({ enum: Currency, example: Currency.USD })
  currency: Currency;

  @ApiProperty({ enum: PaymentProvider, example: PaymentProvider.STRIPE })
  provider: PaymentProvider;

  @ApiProperty({ enum: TransactionStatus, example: TransactionStatus.SUCCEED })
  status: TransactionStatus;

  @ApiProperty({ example: '2025-11-13T09:15:00.000Z' })
  createdAt: Date;

  @ApiProperty({ example: '2025-11-13T09:15:00.000Z' })
  updatedAt: Date;
}

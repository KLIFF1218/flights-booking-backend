import { ApiProperty } from '@nestjs/swagger';

export class PaymentProviderCreateDto {
  @ApiProperty({ example: 'tr_abc123' })
  transactionId!: string;

  @ApiProperty({ example: '1000' })
  amount!: string;

  @ApiProperty({ example: 'RUB' })
  currency!: string;

  @ApiProperty({ example: 'idem-123' })
  idempotencyKey!: string;

  @ApiProperty({ example: 'YOOKASSA' })
  provider!: string;
}

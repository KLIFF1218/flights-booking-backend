import { ApiProperty } from '@nestjs/swagger';

export class BookingPaymentResumeResponseDto {
  @ApiProperty({
    example: 'https://pay.example/checkout',
    description: 'URL to redirect the user to the payment provider',
  })
  paymentRedirectUrl!: string;

  @ApiProperty({
    example: 'clu3y9ab0002qz0q2yex8w9s0',
    description: 'Payment transaction ID',
  })
  transactionId!: string;

  @ApiProperty({
    example: '2025-03-15T14:45:00.000Z',
    description: 'When the payment session expires',
  })
  expiresAt!: Date;
}

import { ApiProperty } from '@nestjs/swagger';

export class BookingCheckoutResponseDto {
  @ApiProperty({
    example: 'https://pay.example/checkout',
    description: 'URL to redirect the user to the payment page',
  })
  paymentRedirectUrl!: string;
}

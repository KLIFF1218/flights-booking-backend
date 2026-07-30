import { IsArray, IsString, IsNotEmpty, ValidateNested, IsOptional, IsEnum } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PaymentProvider } from '@prisma/client';
import { OPENAPI_PAYMENT_PROVIDERS } from 'src/common/swagger/openapi-enums';

export class AssignSeatDto {
  @IsString()
  @IsNotEmpty()
  @ApiProperty({ example: 'trav_1' })
  travelerId!: string;

  @IsString()
  @IsNotEmpty()
  @ApiProperty({ example: 'seg_1' })
  segmentId!: string;

  @IsString()
  @IsNotEmpty()
  @ApiProperty({ example: '12A' })
  seatNumber!: string;
}

export class AddSeatsDto {
  @IsString()
  @ApiProperty({ example: 'search_123' })
  searchId!: string;

  @IsString()
  @ApiProperty({ example: 'offer_1' })
  offerId!: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AssignSeatDto)
  @ApiProperty({ type: [AssignSeatDto] })
  seats!: AssignSeatDto[];

  @IsOptional()
  @IsString()
  @ApiProperty({
    example: 'quote_abc123',
    required: false,
    description: 'ID of the latest pricing quote from the frontend',
  })
  pricingQuoteId?: string;

  @IsOptional()
  @IsEnum(PaymentProvider)
  @ApiPropertyOptional({
    example: PaymentProvider.YOOKASSA,
    enum: OPENAPI_PAYMENT_PROVIDERS,
    enumName: 'PaymentProvider',
    description: 'Payment provider override for checkout (must match booking currency)',
  })
  paymentProvider?: PaymentProvider;
}

export class AssignSeatsBodyDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AssignSeatDto)
  @ApiProperty({ type: [AssignSeatDto] })
  seats!: AssignSeatDto[];
}

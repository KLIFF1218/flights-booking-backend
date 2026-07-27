import {
  IsString,
  IsIn,
  IsNumberString,
  IsOptional,
  IsBoolean,
  IsISO8601,
  ValidateNested,
  IsObject,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

class AmountDto {
  @IsNumberString()
  @ApiProperty({ example: '1000' })
  value!: string;

  @IsString()
  @ApiProperty({ example: 'RUB' })
  currency!: string;
}

class PaymentMethodCardDto {
  @IsOptional()
  @IsString()
  @ApiPropertyOptional({ example: '411111' })
  first6?: string;

  @IsOptional()
  @IsString()
  @ApiPropertyOptional({ example: '1111' })
  last4?: string;
}

class PaymentMethodDto {
  @IsString()
  @ApiProperty({ example: 'card' })
  type!: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => PaymentMethodCardDto)
  @ApiPropertyOptional({ type: PaymentMethodCardDto })
  card?: PaymentMethodCardDto;
}

class ObjectDto {
  @IsString()
  @ApiProperty({ example: 'obj_1' })
  id!: string;

  @IsIn(['pending', 'waiting_for_capture', 'succeeded', 'canceled'])
  @ApiProperty({ example: 'succeeded' })
  status!: string;

  @ValidateNested()
  @Type(() => AmountDto)
  @ApiProperty({ type: AmountDto })
  amount!: AmountDto;

  @IsObject()
  @ApiProperty({ example: { transactionId: 'tr_1', bookingId: 'bk_1' } })
  metadata!: { transactionId: string; bookingId: string };

  @IsISO8601()
  @ApiProperty({ example: '2026-06-17T10:00:00Z' })
  created_at!: string;

  @IsOptional()
  @IsBoolean()
  @ApiPropertyOptional({ example: false })
  test?: boolean;

  @IsOptional()
  @ValidateNested()
  @Type(() => PaymentMethodDto)
  @ApiPropertyOptional({ type: PaymentMethodDto })
  payment_method?: PaymentMethodDto;
}

export class YooKassaWebhookDto {
  @IsIn(['notification'])
  @ApiProperty({ example: 'notification' })
  type!: string;

  @IsIn([
    'payment.waiting_for_capture',
    'payment.succeeded',
    'payment.canceled',
    'refund.succeeded',
  ])
  @ApiProperty({ example: 'payment.succeeded' })
  event!: string;

  @ValidateNested()
  @Type(() => ObjectDto)
  @ApiProperty({ type: ObjectDto })
  object!: ObjectDto;
}

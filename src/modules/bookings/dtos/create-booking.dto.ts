import {
  IsEnum,
  IsNotEmpty,
  IsObject,
  IsString,
  ValidateNested,
  IsArray,
  IsOptional,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PaymentProvider } from '@prisma/client';
import { OPENAPI_PAYMENT_PROVIDERS } from 'src/common/swagger/openapi-enums';
import type { FlightOrderData } from './flight-order-booking-response.type';
import { TravelerInputDto } from './traveler.input.dto';

export class CreateBookingDto {
  @IsString()
  @IsNotEmpty()
  @ApiProperty({ example: 'usr_1' })
  userId!: string;

  @IsObject()
  @IsNotEmpty()
  @ValidateNested()
  @Type(() => Object)
  @ApiProperty({ description: 'Order data received from the provider', example: {} })
  flightOrder!: FlightOrderData;

  @IsEnum(PaymentProvider)
  @ApiProperty({
    example: 'YOOKASSA',
    enum: OPENAPI_PAYMENT_PROVIDERS,
    enumName: 'PaymentProvider',
  })
  paymentProvider!: PaymentProvider;

  @IsArray()
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => TravelerInputDto)
  @ApiPropertyOptional({ type: [TravelerInputDto] })
  travelers?: TravelerInputDto[];
}

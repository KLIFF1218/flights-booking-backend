import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PassengerType } from '@prisma/client';
import { Transform } from 'class-transformer';
import { IsBoolean, IsDateString, IsEnum, IsOptional, IsString } from 'class-validator';

function emptyStringToUndefined({ value }: { value: unknown }) {
  if (typeof value === 'string' && value.trim() === '') {
    return undefined;
  }

  return value;
}

export class CreateSavedPassengerDto {
  @IsOptional()
  @Transform(emptyStringToUndefined)
  @IsString()
  @ApiPropertyOptional({ example: 'Me' })
  label?: string;

  @IsOptional()
  @IsBoolean()
  @ApiPropertyOptional({ example: true })
  isPrimary?: boolean;

  @IsEnum(PassengerType)
  @ApiProperty({ enum: PassengerType, example: PassengerType.ADULT })
  passengerType!: PassengerType;

  @IsString()
  @ApiProperty({ example: 'IVAN' })
  firstName!: string;

  @IsString()
  @ApiProperty({ example: 'IVANOV' })
  lastName!: string;

  @IsString()
  @ApiProperty({ example: 'MALE' })
  gender!: string;

  @IsDateString()
  @ApiProperty({ example: '1990-01-01' })
  dateOfBirth!: string;

  @IsOptional()
  @Transform(emptyStringToUndefined)
  @IsString()
  @ApiPropertyOptional({ example: 'RU' })
  nationality?: string;

  @IsOptional()
  @Transform(emptyStringToUndefined)
  @IsString()
  @ApiPropertyOptional({ example: 'MOSCOW' })
  birthPlace?: string;

  @IsOptional()
  @Transform(emptyStringToUndefined)
  @IsString()
  @ApiPropertyOptional({ example: '1234567890' })
  passportNumber?: string;

  @IsOptional()
  @Transform(emptyStringToUndefined)
  @IsDateString()
  @ApiPropertyOptional({ example: '2015-01-01' })
  passportIssuanceDate?: string;

  @IsOptional()
  @Transform(emptyStringToUndefined)
  @IsDateString()
  @ApiPropertyOptional({ example: '2030-01-01' })
  passportExpiry?: string;

  @IsOptional()
  @Transform(emptyStringToUndefined)
  @IsString()
  @ApiPropertyOptional({ example: 'ivan@example.com' })
  email?: string;

  @IsOptional()
  @Transform(emptyStringToUndefined)
  @IsString()
  @ApiPropertyOptional({ example: '7' })
  phoneCountryCode?: string;

  @IsOptional()
  @Transform(emptyStringToUndefined)
  @IsString()
  @ApiPropertyOptional({ example: '9991234567' })
  phoneNumber?: string;
}

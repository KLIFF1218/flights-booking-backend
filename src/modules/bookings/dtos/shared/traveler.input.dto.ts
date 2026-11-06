import { Transform } from 'class-transformer';
import { IsDateString, IsEnum, IsOptional, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum Gender {
  MALE = 'MALE',
  FEMALE = 'FEMALE',
}

function emptyStringToUndefined({ value }: { value: unknown }) {
  if (typeof value === 'string' && value.trim() === '') {
    return undefined;
  }

  return value;
}

export class TravelerInputDto {
  @IsOptional()
  @IsString()
  @ApiPropertyOptional({
    description: 'Client-generated traveler id; preserved when saving to booking',
    example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  })
  id?: string;

  @IsString()
  @ApiProperty({ example: 'Ivan' })
  firstName!: string;

  @IsString()
  @ApiProperty({ example: 'Ivanov' })
  lastName!: string;

  @IsEnum(Gender)
  @ApiProperty({ example: Gender.MALE, enum: Gender })
  gender!: Gender;

  @IsDateString()
  @ApiProperty({ example: '1990-01-01' })
  dateOfBirth!: string;

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
  @ApiPropertyOptional({ example: '9261234567' })
  phoneNumber?: string;

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
  @ApiPropertyOptional({ example: '2025-01-01' })
  passportExpiry?: string;

  @IsOptional()
  @Transform(emptyStringToUndefined)
  @IsString()
  @ApiPropertyOptional({ example: 'Moscow' })
  birthPlace?: string;

  @IsOptional()
  @Transform(emptyStringToUndefined)
  @IsString()
  @ApiPropertyOptional({ example: 'RU' })
  nationality?: string;

  @IsOptional()
  @Transform(emptyStringToUndefined)
  @IsString()
  @ApiPropertyOptional({
    description: 'Client id of the accompanying adult traveler (required for infants)',
    example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  })
  accompanyingTravelerId?: string;
}

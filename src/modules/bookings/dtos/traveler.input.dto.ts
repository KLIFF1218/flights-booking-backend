import { IsDateString, IsEnum, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export enum Gender {
  MALE = 'MALE',
  FEMALE = 'FEMALE',
}

export class TravelerInputDto {
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

  @IsString()
  @ApiProperty({ example: 'ivan@example.com' })
  email!: string;

  @IsString()
  @ApiProperty({ example: '+7' })
  phoneCountryCode!: string;

  @IsString()
  @ApiProperty({ example: '9261234567' })
  phoneNumber!: string;

  @IsString()
  @ApiProperty({ example: '1234567890' })
  passportNumber!: string;

  @IsDateString()
  @ApiProperty({ example: '2015-01-01' })
  passportIssuanceDate!: string;

  @IsDateString()
  @ApiProperty({ example: '2025-01-01' })
  passportExpiry!: string;

  @IsString()
  @ApiProperty({ example: 'Moscow' })
  birthPlace!: string;

  @IsString()
  @ApiProperty({ example: 'RU' })
  nationality!: string;
}

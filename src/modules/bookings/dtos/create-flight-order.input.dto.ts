import {
  ArrayNotEmpty,
  IsArray,
  IsDateString,
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  Length,
  Matches,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PaymentProvider } from '@prisma/client';

export enum DocumentType {
  PASSPORT = 'PASSPORT',
}

export class NameInputDto {
  @IsString()
  @ApiProperty({ example: 'Ivan' })
  firstName: string;

  @IsString()
  @ApiProperty({ example: 'Ivanov' })
  lastName: string;
}

export class PhoneInputDto {
  @IsEnum(['MOBILE', 'LANDLINE'])
  @ApiProperty({ example: 'MOBILE' })
  deviceType: 'MOBILE' | 'LANDLINE';

  @IsString()
  @ApiProperty({ example: '+7' })
  countryCallingCode: string;

  @IsString()
  @ApiProperty({ example: '9261234567' })
  number: string;
}

export class TravelerContactInputDto {
  @IsOptional()
  @IsEmail()
  @ApiPropertyOptional({ example: 'ivan@example.com' })
  emailAddress?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PhoneInputDto)
  // @ApiPropertyOptional({ type: [PhoneInputDto] })
  phones?: PhoneInputDto[];
}

export class TravelerDocumentInputDto {
  @IsEnum(DocumentType)
  // @ApiProperty({ example: DocumentType.PASSPORT })
  documentType: DocumentType;

  @IsString()
  @Length(3, 20)
  @ApiProperty({ example: '1234567890' })
  number: string;

  @IsDateString()
  @ApiProperty({ example: '2025-01-01' })
  expiryDate: string;

  @IsDateString()
  @ApiProperty({ example: '2015-01-01' })
  issuanceDate: string;

  @IsString()
  @Length(2, 2)
  @ApiProperty({ example: 'RU' })
  issuanceCountry: string;

  @IsString()
  @ApiProperty({ example: 'Moscow' })
  birthPlace: string;

  @IsString()
  @Length(2, 2)
  @ApiProperty({ example: 'RU' })
  nationality: string;
}

export class TravelerInputDto {
  @IsString()
  @ApiProperty({ example: 'trav_1' })
  id: string;

  @IsDateString()
  @ApiProperty({ example: '1990-01-01' })
  dateOfBirth: string;

  @IsEnum(['MALE', 'FEMALE'])
  @ApiProperty({ example: 'MALE' })
  gender: 'MALE' | 'FEMALE';

  @ValidateNested()
  @Type(() => NameInputDto)
  // @ApiProperty({ type: NameInputDto })
  name: NameInputDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => TravelerContactInputDto)
  // @ApiPropertyOptional({ type: TravelerContactInputDto })
  contact?: TravelerContactInputDto;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TravelerDocumentInputDto)
  // @ApiPropertyOptional({ type: [TravelerDocumentInputDto] })
  documents?: TravelerDocumentInputDto[];
}

export class SeatAssignmentInputDto {
  @IsString()
  @Length(1, 20)
  @ApiProperty({ example: 'trav_1' })
  travelerId: string;

  @IsString()
  @Length(1, 20)
  @ApiProperty({ example: 'seg_1' })
  segmentId: string;

  @IsString()
  @Length(1, 5)
  @Matches(/^[0-9]{1,3}[A-Z]$/, {
    message: 'seatNumber must be like 12A, 3C, 20D',
  })
  @ApiProperty({ example: '12A' })
  seatNumber: string;
}

export class CreateFlightOrderInputDto {
  @IsString()
  @ApiProperty({ example: 'search_abc123' })
  searchId: string;

  @IsString()
  @ApiProperty({ example: 'offer_1' })
  offerId: string;

  @IsOptional()
  @IsEnum(PaymentProvider)
  @ApiPropertyOptional({ example: 'YOOKASSA' })
  paymentProvider?: PaymentProvider;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TravelerInputDto)
  // @ApiPropertyOptional({ type: [TravelerInputDto] })
  travelers?: TravelerInputDto[];

  @IsOptional()
  @IsArray()
  @ArrayNotEmpty()
  @ValidateNested({ each: true })
  @Type(() => SeatAssignmentInputDto)
  // @ApiPropertyOptional({ type: [SeatAssignmentInputDto] })
  seats?: SeatAssignmentInputDto[];
}

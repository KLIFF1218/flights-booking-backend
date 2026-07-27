import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PassengerType } from '@prisma/client';

export class SavedPassengerResponseDto {
  @ApiProperty()
  id!: string;

  @ApiPropertyOptional()
  label?: string | null;

  @ApiProperty()
  isPrimary!: boolean;

  @ApiProperty({ enum: PassengerType })
  passengerType!: PassengerType;

  @ApiProperty()
  firstName!: string;

  @ApiProperty()
  lastName!: string;

  @ApiProperty()
  gender!: string;

  @ApiProperty()
  dateOfBirth!: string;

  @ApiProperty()
  nationality!: string;

  @ApiPropertyOptional()
  birthPlace?: string | null;

  @ApiProperty()
  passportNumber!: string;

  @ApiProperty()
  passportIssuanceDate!: string;

  @ApiProperty()
  passportExpiry!: string;

  @ApiPropertyOptional()
  email?: string | null;

  @ApiPropertyOptional()
  phoneCountryCode?: string | null;

  @ApiPropertyOptional()
  phoneNumber?: string | null;
}

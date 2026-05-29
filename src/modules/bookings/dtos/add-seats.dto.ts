import { IsArray, IsString, IsNotEmpty, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class AssignSeatDto {
  @IsString()
  @IsNotEmpty()
  travelerId: string;

  @IsString()
  @IsNotEmpty()
  segmentId: string;

  @IsString()
  @IsNotEmpty()
  seatNumber: string;
}

export class AddSeatsDto {
  @IsString()
  searchId: string;

  @IsString()
  offerId: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AssignSeatDto)
  seats: AssignSeatDto[];
}
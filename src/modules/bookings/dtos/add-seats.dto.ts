import { IsArray, IsString, IsNotEmpty, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

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
}

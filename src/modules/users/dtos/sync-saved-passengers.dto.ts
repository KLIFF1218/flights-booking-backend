import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, ValidateNested } from 'class-validator';
import { MAX_PASSENGERS_PER_BOOKING } from 'src/modules/flights/utils/passenger-counts.util';
import { CreateSavedPassengerDto } from './create-saved-passenger.dto';

export class SyncSavedPassengersDto {
  @IsArray()
  @ArrayMaxSize(MAX_PASSENGERS_PER_BOOKING)
  @ValidateNested({ each: true })
  @Type(() => CreateSavedPassengerDto)
  @ApiProperty({ type: [CreateSavedPassengerDto] })
  travelers!: CreateSavedPassengerDto[];
}

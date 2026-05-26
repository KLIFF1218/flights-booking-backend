import { Type } from 'class-transformer';
import { ValidateNested, ArrayMinSize } from 'class-validator';
import { TravelerInputDto } from './traveler.input.dto';

export class AddTravelersDto {
  @ValidateNested({ each: true })
  @Type(() => TravelerInputDto)
  @ArrayMinSize(1)
  travelers: TravelerInputDto[];
}

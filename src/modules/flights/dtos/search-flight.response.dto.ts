import { ApiProperty } from '@nestjs/swagger';
import { FlightCardResponse } from '../interfaces/flight-response.dto';

export class SearchFlightsResponse {
  @ApiProperty({
    example: 'a611b114-d1ae-4975-beaa-65991690d8cd',
    description: 'Unique identifier of the flight search session',
  })
  searchId!: string;

  @ApiProperty({
    type: [FlightCardResponse],
    description: 'List of flight offers',
  })
  flights!: FlightCardResponse[];
}

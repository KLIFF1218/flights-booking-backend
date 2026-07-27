import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class AircraftResponseDto {
  @ApiProperty({ example: 'clu3y9ab0002qz0q2yex8w9s0' })
  id!: string;

  @ApiProperty({ example: 'A320' })
  code!: string;

  @ApiProperty({ example: 'Airbus A320' })
  name!: string;

  @ApiProperty({ example: 'clu3y9ab0002qz0q2yex8w9s1' })
  airlineId!: string;

  @ApiPropertyOptional({ example: 180, description: 'Seat count from aircraft layout' })
  seatsCount?: number;
}

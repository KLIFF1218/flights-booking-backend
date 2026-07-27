import { ApiProperty } from '@nestjs/swagger';

export class AirlineResponseDto {
  @ApiProperty({ example: 'clu3y9ab0002qz0q2yex8w9s0' })
  id!: string;

  @ApiProperty({ example: 'Aeroflot' })
  name!: string;

  @ApiProperty({ example: 'SU' })
  code!: string;
}

import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class SeatMapDto {
  @ApiProperty({
    description: 'Идентификатор поиска (search session id)',
    example: '19dcf9c7-c816-47f8-aaa5-b0f7b97fefc4',
  })
  @IsString()
  @IsNotEmpty()
  searchId: string;

  @ApiProperty({
    description: 'Идентификатор предложения (offer id)',
    example: '1',
  })
  @IsString()
  @IsNotEmpty()
  offerId: string;
}

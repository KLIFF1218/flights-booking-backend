import { ApiProperty } from '@nestjs/swagger';

export class AirportResponseDto {
  @ApiProperty({
    description: 'Уникальный идентификатор аэропорта',
    example: 'clh4j3k4l9m5n6o7p8q9r0s1',
  })
  id!: string;

  @ApiProperty({
    description: 'Название аэропорта',
    example: 'Шереметьево',
  })
  name!: string;

  @ApiProperty({
    description: 'Город, где расположен аэропорт',
    example: 'Москва',
  })
  city!: string;

  @ApiProperty({
    description: 'IATA код аэропорта (3 буквы)',
    example: 'SVO',
  })
  iataCode!: string;
}

export class AirportsListResponseDto {
  @ApiProperty({
    type: [AirportResponseDto],
    description: 'Список всех аэропортов',
  })
  data!: AirportResponseDto[];
}

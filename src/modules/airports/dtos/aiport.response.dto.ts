export class AirportLocationDto {
  id: string;
  name: string;
  city: string | null;
  country: string;
  iataCode: string | null;
}

export class AirportsMetaDto {
  count: number;
}

export class AirportsResponseDto {
  data: AirportLocationDto[];
  meta: AirportsMetaDto;
}

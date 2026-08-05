import { createHash } from 'node:crypto';
import type { SearchFlightsDto } from '../../dtos';

export function buildSearchQueryKey(data: SearchFlightsDto): string {
  const normalized = {
    directions: data.directions.map((direction) => ({
      origin: direction.origin,
      destination: direction.destination,
      dateFrom: direction.dateFrom,
    })),
    passengers: {
      adults: data.passengers.adults,
      children: data.passengers.children ?? 0,
      infants: data.passengers.infants ?? 0,
      seatedInfants: data.passengers.seatedInfants ?? 0,
    },
    travelClass: data.travelClass,
    currencyCode: data.currencyCode ?? null,
  };

  return createHash('sha256').update(JSON.stringify(normalized)).digest('hex');
}

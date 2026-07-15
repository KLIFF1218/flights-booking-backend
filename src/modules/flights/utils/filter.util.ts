import type { PreprocessedFlightOffer } from '../types/flights.types';

export function buildFilters(offers: PreprocessedFlightOffer[]) {
  const airlinesMap = new Map<string, number>();
  const stopsMap = new Map<number, number>();
  let maxPrice = 0;

  for (const offer of offers) {
    const offerAirlines = new Set<string>();

    for (const itinerary of offer.itineraries) {
      for (const segment of itinerary.segments) {
        const airline = segment.airline || segment.carrierCode;
        if (airline) {
          offerAirlines.add(airline);
        }
      }
    }

    for (const airline of offerAirlines) {
      airlinesMap.set(airline, (airlinesMap.get(airline) ?? 0) + 1);
    }

    const stops = offer.preprocessed.totalStops;
    stopsMap.set(stops, (stopsMap.get(stops) ?? 0) + 1);

    const price = Number(offer.price.total);
    if (!Number.isNaN(price)) {
      maxPrice = Math.max(maxPrice, price);
    }
  }

  return {
    airlines: Array.from(airlinesMap.entries()).map(([name, count]) => ({ name, count })),
    stops: Array.from(stopsMap.entries()).map(([stops, count]) => ({ stops, count })),
    maxPrice,
  };
}

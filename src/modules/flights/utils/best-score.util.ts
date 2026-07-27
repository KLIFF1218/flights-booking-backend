import type { PreprocessedFlightOffer } from '../types/flights.types';

export function computeBestScores(offers: PreprocessedFlightOffer[]): void {
  if (offers.length === 0) return;

  let minPrice = Infinity;
  let maxPrice = -Infinity;
  let minDuration = Infinity;
  let maxDuration = -Infinity;
  let minStops = Infinity;
  let maxStops = -Infinity;

  for (const o of offers) {
    const price = Number(o.price.total);
    if (price < minPrice) minPrice = price;
    if (price > maxPrice) maxPrice = price;

    const duration = o.preprocessed.totalDurationMinutes;
    if (duration < minDuration) minDuration = duration;
    if (duration > maxDuration) maxDuration = duration;

    const stops = o.preprocessed.totalStops;
    if (stops < minStops) minStops = stops;
    if (stops > maxStops) maxStops = stops;
  }

  const priceRange = maxPrice - minPrice || 1;
  const durationRange = maxDuration - minDuration || 1;
  const stopsRange = maxStops - minStops || 1;

  const priceWeight = 0.45;
  const durationWeight = 0.35;
  const stopsWeight = 0.2;

  for (const o of offers) {
    const price = Number(o.price.total);
    const duration = o.preprocessed.totalDurationMinutes;
    const stops = o.preprocessed.totalStops;

    const normPrice = (price - minPrice) / priceRange;
    const normDuration = (duration - minDuration) / durationRange;
    const normStops = (stops - minStops) / stopsRange;

    o.preprocessed.bestScore =
      priceWeight * normPrice + durationWeight * normDuration + stopsWeight * normStops;
  }
}

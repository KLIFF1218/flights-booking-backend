import type { SeatMapResponseDtoInterface } from 'src/modules/seatmaps/dtos/seatmap.dto';

export function isSeatMapUnavailable(seatMap: unknown): boolean {
  if (!seatMap || typeof seatMap !== 'object') {
    return false;
  }

  return (seatMap as SeatMapResponseDtoInterface).unavailable === true;
}

export function isSeatSelectionRequired(seatMap: unknown): boolean {
  return !isSeatMapUnavailable(seatMap);
}

export function resolveSeatSelectionRequired(seatMap: unknown, persisted?: boolean): boolean {
  if (persisted !== undefined) {
    return persisted;
  }

  if (!seatMap || typeof seatMap !== 'object') {
    throw new Error('Seat map payload is missing');
  }

  return isSeatSelectionRequired(seatMap);
}

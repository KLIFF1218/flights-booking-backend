import {
  isSeatMapUnavailable,
  isSeatSelectionRequired,
  resolveSeatSelectionRequired,
} from './seatmap-availability.util';

describe('seatmap-availability.util', () => {
  it('detects unavailable seat maps', () => {
    expect(isSeatMapUnavailable({ unavailable: true, seatMaps: [] })).toBe(true);
  });

  it('treats missing seat map as not unavailable', () => {
    expect(isSeatMapUnavailable(null)).toBe(false);
    expect(isSeatMapUnavailable(undefined)).toBe(false);
  });

  it('requires seat selection when seat map is available', () => {
    expect(isSeatSelectionRequired({ unavailable: false, seatMaps: [] })).toBe(true);
  });

  it('does not require seat selection when seat map is unavailable', () => {
    expect(isSeatSelectionRequired({ unavailable: true, seatMaps: [] })).toBe(false);
  });

  it('prefers persisted seat selection flag from snapshot', () => {
    expect(resolveSeatSelectionRequired({ unavailable: false, seatMaps: [] }, false)).toBe(false);
  });
});

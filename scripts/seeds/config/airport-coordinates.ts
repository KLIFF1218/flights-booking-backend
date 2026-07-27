export type AirportCoord = {
  latitude: number;
  longitude: number;
};

/** IATA coordinates aligned with airports.seed.ts */
export const AIRPORT_COORDINATES: Record<string, AirportCoord> = {
  SVO: { latitude: 55.972599, longitude: 37.4146 },
  LED: { latitude: 59.8003, longitude: 30.2625 },
  IST: { latitude: 41.275278, longitude: 28.751944 },
  FRA: { latitude: 50.037933, longitude: 8.562152 },
  CDG: { latitude: 49.009701, longitude: 2.5479 },
  LHR: { latitude: 51.4706, longitude: -0.461941 },
  AMS: { latitude: 52.308601, longitude: 4.763889 },
  DXB: { latitude: 25.252799, longitude: 55.364399 },
  JFK: { latitude: 40.641311, longitude: -73.778139 },
  SFO: { latitude: 37.621313, longitude: -122.378955 },
};

const AIRPORT_TIMEZONES: Record<string, string> = {
  SVO: 'Europe/Moscow',
  LED: 'Europe/Moscow',
  HEL: 'Europe/Helsinki',
  IST: 'Europe/Istanbul',
  AYT: 'Europe/Istanbul',
  FRA: 'Europe/Berlin',
  MUC: 'Europe/Berlin',
  CDG: 'Europe/Paris',
  ORY: 'Europe/Paris',
  LHR: 'Europe/London',
  LGW: 'Europe/London',
  AMS: 'Europe/Amsterdam',
  MAD: 'Europe/Madrid',
  BCN: 'Europe/Madrid',
  FCO: 'Europe/Rome',
  ATH: 'Europe/Athens',
  DXB: 'Asia/Dubai',
  DOH: 'Asia/Qatar',
  JFK: 'America/New_York',
  SFO: 'America/Los_Angeles',
  LAX: 'America/Los_Angeles',
  ORD: 'America/Chicago',
  SEA: 'America/Los_Angeles',
  YYZ: 'America/Toronto',
};

export function resolveAirportTimezone(iataCode: string, fallback = 'UTC'): string {
  return AIRPORT_TIMEZONES[iataCode.trim().toUpperCase()] ?? fallback;
}

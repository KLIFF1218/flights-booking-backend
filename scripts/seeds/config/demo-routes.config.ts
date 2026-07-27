import type { RouteSeedConfig } from './routes.config';

/** Demo horizon: instances for the next N days (inclusive from today). */
export const DEMO_DAYS = 14;

/** Minimal dataset for portfolio / local demo: JFK → SFO, Delta, 1 flight/day. */
export const DEMO_ROUTES: RouteSeedConfig[] = [
  {
    from: 'JFK',
    to: 'SFO',
    durationMinutes: 390,
    flightsPerDay: 1,
    airlines: ['DL'],
    days: DEMO_DAYS,
  },
];

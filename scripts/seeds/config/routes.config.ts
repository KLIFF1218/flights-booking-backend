export const SEED_DAYS = 30;

export type RouteSeedConfig = {
  from: string;
  to: string;
  durationMinutes: number;
  /** How many different flights (templates) per day on this route */
  flightsPerDay: number;
  airlines: string[];
  /** Instance horizon in days (defaults to SEED_DAYS) */
  days?: number;
};

/** Primary route: JFK → SFO — 50 flights per day × 30 days */
export const PRIMARY_ROUTE: RouteSeedConfig = {
  from: 'JFK',
  to: 'SFO',
  durationMinutes: 390,
  flightsPerDay: 50,
  airlines: ['DL', 'AA', 'UA'],
};

/** Other routes: 2 flights per day × 30 days */
export const OTHER_ROUTES: RouteSeedConfig[] = [
  {
    from: 'SVO',
    to: 'JFK',
    durationMinutes: 600,
    flightsPerDay: 2,
    airlines: ['SU'],
  },
  {
    from: 'SVO',
    to: 'IST',
    durationMinutes: 300,
    flightsPerDay: 2,
    airlines: ['SU'],
  },
  {
    from: 'SVO',
    to: 'LED',
    durationMinutes: 90,
    flightsPerDay: 2,
    airlines: ['SU'],
  },
  {
    from: 'IST',
    to: 'JFK',
    durationMinutes: 650,
    flightsPerDay: 2,
    airlines: ['TK'],
  },
  {
    from: 'IST',
    to: 'SFO',
    durationMinutes: 810,
    flightsPerDay: 2,
    airlines: ['TK'],
  },
  {
    from: 'FRA',
    to: 'JFK',
    durationMinutes: 510,
    flightsPerDay: 2,
    airlines: ['LH'],
  },
  {
    from: 'FRA',
    to: 'SFO',
    durationMinutes: 700,
    flightsPerDay: 2,
    airlines: ['LH'],
  },
  {
    from: 'CDG',
    to: 'JFK',
    durationMinutes: 495,
    flightsPerDay: 2,
    airlines: ['AF'],
  },
  {
    from: 'LHR',
    to: 'JFK',
    durationMinutes: 470,
    flightsPerDay: 2,
    airlines: ['BA'],
  },
  {
    from: 'LHR',
    to: 'SFO',
    durationMinutes: 660,
    flightsPerDay: 2,
    airlines: ['BA'],
  },
  {
    from: 'AMS',
    to: 'JFK',
    durationMinutes: 480,
    flightsPerDay: 2,
    airlines: ['KL'],
  },
  {
    from: 'DXB',
    to: 'JFK',
    durationMinutes: 840,
    flightsPerDay: 2,
    airlines: ['EK'],
  },
];

export function expandRoutesWithReturns(routes: RouteSeedConfig[]): RouteSeedConfig[] {
  const expanded: RouteSeedConfig[] = [];

  for (const route of routes) {
    expanded.push(route);
    expanded.push({
      ...route,
      from: route.to,
      to: route.from,
    });
  }

  return expanded;
}

export const ALL_ROUTES = expandRoutesWithReturns([PRIMARY_ROUTE, ...OTHER_ROUTES]);

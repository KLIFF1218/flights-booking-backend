const IATA_COUNTRY: Record<string, string> = {
  SVO: 'RU',
  LED: 'RU',
  IST: 'TR',
  AYT: 'TR',
  FRA: 'DE',
  MUC: 'DE',
  CDG: 'FR',
  ORY: 'FR',
  LHR: 'GB',
  LGW: 'GB',
  AMS: 'NL',
  MAD: 'ES',
  BCN: 'ES',
  FCO: 'IT',
  ATH: 'GR',
  DXB: 'AE',
  DOH: 'QA',
  JFK: 'US',
  SFO: 'US',
  LAX: 'US',
  ORD: 'US',
  SEA: 'US',
  YYZ: 'CA',
};

export function getAirportCountry(iataCode: string): string | null {
  return IATA_COUNTRY[iataCode.trim().toUpperCase()] ?? null;
}

export function isInternationalSegment(from: string, to: string): boolean {
  const fromCountry = getAirportCountry(from);
  const toCountry = getAirportCountry(to);

  if (!fromCountry || !toCountry) {
    return true;
  }

  return fromCountry !== toCountry;
}

export function isInternationalItinerary(segments: Array<{ from: string; to: string }>): boolean {
  if (!segments.length) {
    return true;
  }

  return segments.some((segment) => isInternationalSegment(segment.from, segment.to));
}

export function extractIsInternationalFromSnapshot(snapshot: {
  offer?: {
    itineraries?: Array<{
      segments?: Array<{
        departure?: { iataCode?: string };
        arrival?: { iataCode?: string };
      }>;
    }>;
  };
}): boolean {
  const segments =
    snapshot.offer?.itineraries?.flatMap((itinerary) => itinerary.segments ?? []) ?? [];

  return isInternationalItinerary(
    segments.map((segment) => ({
      from: segment.departure?.iataCode ?? '',
      to: segment.arrival?.iataCode ?? '',
    })),
  );
}

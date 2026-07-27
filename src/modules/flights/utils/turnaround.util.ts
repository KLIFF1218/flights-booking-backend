export type TurnaroundConfig = {
  domesticMinutes: number;
  internationalMinutes: number;
};

const DEFAULT_TURNAROUND: TurnaroundConfig = {
  domesticMinutes: 120,
  internationalMinutes: 180,
};

let turnaroundConfig: TurnaroundConfig = { ...DEFAULT_TURNAROUND };

export function configureTurnaround(partial: Partial<TurnaroundConfig>): void {
  turnaroundConfig = {
    ...turnaroundConfig,
    ...partial,
  };
  MIN_DOMESTIC_TURNAROUND_MINUTES = turnaroundConfig.domesticMinutes;
  MIN_INTERNATIONAL_TURNAROUND_MINUTES = turnaroundConfig.internationalMinutes;
}

export function resetTurnaroundConfig(): void {
  configureTurnaround({ ...DEFAULT_TURNAROUND });
}

export let MIN_DOMESTIC_TURNAROUND_MINUTES = DEFAULT_TURNAROUND.domesticMinutes;
export let MIN_INTERNATIONAL_TURNAROUND_MINUTES = DEFAULT_TURNAROUND.internationalMinutes;

export function isDomesticRoundTrip(
  outboundOriginCountry: string,
  outboundDestinationCountry: string,
): boolean {
  return (
    outboundOriginCountry.trim().toLowerCase() === outboundDestinationCountry.trim().toLowerCase()
  );
}

export function getMinTurnaroundMinutes(
  outboundOriginCountry: string,
  outboundDestinationCountry: string,
): number {
  return isDomesticRoundTrip(outboundOriginCountry, outboundDestinationCountry)
    ? turnaroundConfig.domesticMinutes
    : turnaroundConfig.internationalMinutes;
}

export function meetsMinimumTurnaround(
  outboundArrivalAt: Date,
  returnDepartureAt: Date,
  minTurnaroundMinutes: number,
): boolean {
  const turnaroundMinutes = (returnDepartureAt.getTime() - outboundArrivalAt.getTime()) / 60_000;

  return turnaroundMinutes >= minTurnaroundMinutes;
}

import msImport from 'ms';

type MsFunction = (value: string) => number;

const parseMs = msImport as MsFunction;

export function parseDurationMs(value: string): number {
  return parseMs(value);
}

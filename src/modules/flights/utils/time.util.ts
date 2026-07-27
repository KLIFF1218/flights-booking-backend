export function formatDuration(minutes: number) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (m === 0) return `PT${h}H`;
  return `PT${h}H${m}M`;
}

export function timeStringOf(val: unknown): string {
  if (typeof val === 'string') return val;
  if (val instanceof Date) {
    return val.toISOString().split('T')[1].substring(0, 5);
  }
  if (val == null || val === '') return '00:00';
  if (typeof val === 'number' || typeof val === 'boolean' || typeof val === 'bigint') {
    return String(val);
  }
  return '00:00';
}

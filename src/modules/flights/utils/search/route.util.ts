export function isCyclicRoute(airports: string[]): boolean {
  const seen = new Set<string>();
  for (const ap of airports) {
    if (seen.has(ap)) return true;
    seen.add(ap);
  }
  return false;
}

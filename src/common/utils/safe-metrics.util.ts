export function runSafely(action: () => void): void {
  try {
    action();
  } catch {
    // Optional side effects (e.g. metrics) must not break the request flow.
  }
}

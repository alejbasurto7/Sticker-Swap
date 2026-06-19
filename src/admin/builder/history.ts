/** Append `present` to history, keeping at most `cap` entries (oldest dropped). */
export function pushHistory<T>(past: T[], present: T, cap = 50): T[] {
  const next = [...past, present];
  return next.length > cap ? next.slice(next.length - cap) : next;
}

/** Round `value` to the nearest `step` and clamp to 0..100. step<=0 → passthrough (clamped). */
export function snapTo(value: number, step: number): number {
  const v = step > 0 ? Math.round(value / step) * step : value;
  return Math.max(0, Math.min(100, v));
}

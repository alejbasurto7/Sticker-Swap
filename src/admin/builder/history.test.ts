import { describe, it, expect } from 'vitest';
import { snapTo, pushHistory } from './history';

describe('snapTo', () => {
  it('rounds to the nearest step', () => {
    expect(snapTo(52.3, 5)).toBe(50);
    expect(snapTo(53, 5)).toBe(55);
  });
  it('passes through when step <= 0', () => {
    expect(snapTo(52.3, 0)).toBe(52.3);
  });
  it('clamps to 0..100', () => {
    expect(snapTo(-4, 5)).toBe(0);
    expect(snapTo(140, 5)).toBe(100);
  });
});

describe('pushHistory', () => {
  it('appends present and caps length', () => {
    const past = Array.from({ length: 50 }, (_, i) => i);
    const next = pushHistory(past, 999, 50);
    expect(next.length).toBe(50);
    expect(next[next.length - 1]).toBe(999);
    expect(next[0]).toBe(1); // oldest dropped
  });
});

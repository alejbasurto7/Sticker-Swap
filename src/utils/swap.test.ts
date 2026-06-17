import { describe, it, expect } from 'vitest';
import { settleSwapCounts, reverseSettlement } from './swap';
import type { Swap } from '../types';

describe('settleSwapCounts', () => {
  it('decrements a given spare and increments a received sticker', () => {
    const { counts, delta } = settleSwapCounts(
      { A: 2, B: 0 },
      { givenIds: ['A'], receivedIds: ['B'] },
      new Map(),
    );
    expect(counts).toEqual({ A: 1, B: 1 });
    expect(delta).toEqual({ A: -1, B: 1 });
  });

  it('does not decrement (or record a delta for) a give floored by another open swap', () => {
    // A has 2 (1 spare) but another open swap also reserves A, so the spare is held.
    const { counts, delta } = settleSwapCounts(
      { A: 2 },
      { givenIds: ['A'], receivedIds: [] },
      new Map([['A', 1]]),
    );
    expect(counts).toEqual({ A: 2 });
    expect(delta).toEqual({});
  });
});

const baseSwap = (over: Partial<Swap>): Swap => ({
  id: 's1',
  name: 'Test',
  createdAt: 0,
  status: 'closed',
  theirNeeds: [],
  theirSwaps: [],
  giving: [],
  receiving: [],
  ...over,
});

describe('reverseSettlement', () => {
  it('restores counts exactly from a recorded delta', () => {
    const swap = baseSwap({ giving: ['A'], receiving: ['B'], settledDelta: { A: -1, B: 1 } });
    expect(reverseSettlement({ A: 1, B: 1 }, swap)).toEqual({ A: 2, B: 0 });
  });

  it('round-trips a floored give without inventing a copy', () => {
    // Settle a give that is floored by another open swap, then reverse it.
    const start = { A: 2 };
    const { counts, delta } = settleSwapCounts(start, { givenIds: ['A'], receivedIds: [] }, new Map([['A', 1]]));
    const swap = baseSwap({ giving: ['A'], settledDelta: delta });
    expect(reverseSettlement(counts, swap)).toEqual(start);
  });

  it('falls back to naive reversal when settledDelta is absent (legacy swap)', () => {
    const swap = baseSwap({ giving: ['A'], receiving: ['B'] }); // no settledDelta
    expect(reverseSettlement({ A: 1, B: 1 }, swap)).toEqual({ A: 2, B: 0 });
  });

  it('clamps to zero on naive reversal', () => {
    const swap = baseSwap({ giving: [], receiving: ['B'] });
    expect(reverseSettlement({ B: 0 }, swap)).toEqual({ B: 0 });
  });
});

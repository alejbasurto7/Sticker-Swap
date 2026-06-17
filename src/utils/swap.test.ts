import { describe, it, expect } from 'vitest';
import { settleSwapCounts } from './swap';

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

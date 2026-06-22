import { describe, it, expect } from 'vitest';
import { parseExport } from './import';

describe('parseExport spare-count suffix', () => {
  it('reads "(x2)" — symbol before the digit', () => {
    const p = parseExport('To Swap\nMEX: 1 (x2), 9');
    expect(p.swaps).toContain('MEX-1');
    expect(p.swapQty['MEX-1']).toBe(2);
    expect(p.swapQty['MEX-9']).toBe(1); // bare number defaults to 1
  });

  it('reads "(2x)" — digit before the symbol', () => {
    const p = parseExport('To Swap\nMEX: 1 (2x), 9');
    expect(p.swaps).toContain('MEX-1');
    expect(p.swapQty['MEX-1']).toBe(2);
  });

  it('accepts no space, either order, and "×" or upper-case "X"', () => {
    const p = parseExport('To Swap\nMEX: 1(2x), 9(×3), BRA: 4(3X)');
    expect(p.swapQty['MEX-1']).toBe(2);
    expect(p.swapQty['MEX-9']).toBe(3);
    expect(p.swapQty['BRA-4']).toBe(3);
  });

  it('still requires the multiplier symbol — "(2)" is dropped', () => {
    const p = parseExport('To Swap\nMEX: 1(2), 9');
    expect(p.swaps).not.toContain('MEX-1'); // "1(2)" is not a plain digit
    expect(p.swaps).toContain('MEX-9');
  });
});

describe('parseExport section headers', () => {
  it('recognizes "What I have" as a swap header', () => {
    const p = parseExport('I need\nMEX: 8\nWhat I have:\nCAN: 1(2x)');
    expect(p.needs).toContain('MEX-8'); // stays in needs
    expect(p.swaps).toContain('CAN-1'); // switched to swaps
    expect(p.swapQty['CAN-1']).toBe(2);
  });
});

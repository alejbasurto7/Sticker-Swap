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

describe('parseExport label forms (flags / names / codes)', () => {
  it('resolves flag emoji, country name, code+flag, and bare code without colons', () => {
    const p = parseExport(
      [
        'I NEED:',
        '🇲🇽 1,11', // flag emoji, no colon, no spaces after commas
        'Congo DR 2,3,4,8,18', // country name (reversed word order vs "DR Congo")
        'GHA🇬🇭 16', // code glued to flag
        'FWC 1,2,5,14,16', // bare code, FWC intro pages
        '🏴󠁧󠁢󠁳󠁣󠁴󠁿 3,5,12', // subdivision (Scotland) tag flag
        '🏴󠁧󠁢󠁥󠁮󠁧󠁿 2,9,13,16,', // England tag flag, trailing comma tolerated
      ].join('\n'),
    );
    expect(p.needs).toContain('MEX-1');
    expect(p.needs).toContain('MEX-11');
    expect(p.needs).toContain('COD-2'); // DR Congo
    expect(p.needs).toContain('COD-18');
    expect(p.needs).toContain('GHA-16');
    expect(p.needs).toContain('SCO-3'); // Scotland
    expect(p.needs).toContain('ENG-16'); // England
    // FWC intro numbers route to whichever intro page actually holds them.
    expect(p.needs).toContain('FWC-trophy-1');
    expect(p.needs).toContain('FWC-trophy-2');
    expect(p.needs).toContain('FWC-world-5');
    expect(p.unmatched).toHaveLength(0);
  });

  it('still resolves the legacy "CODE emoji: numbers" colon format', () => {
    const p = parseExport('I need\nMEX 🇲🇽: 1, 2');
    expect(p.needs).toEqual(expect.arrayContaining(['MEX-1', 'MEX-2']));
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

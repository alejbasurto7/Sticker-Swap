import { album } from '../src/data/sampleAlbum';
import { parseExport, parsedToCounts } from '../src/utils/import';
import { computeStats } from '../src/utils/stats';
import { computeCandidates, computeConflicts } from '../src/utils/swap';
import type { Swap } from '../src/types';

let failures = 0;
function assert(cond: boolean, msg: string) {
  if (!cond) {
    failures++;
    console.error('  ✗ FAIL:', msg);
  } else {
    console.log('  ✓', msg);
  }
}

// --- Album shape ---
console.log('Album structure');
assert(album.name === 'Usa Mex Can 26', 'album name correct');
assert(album.pages.length === 51, `51 pages (got ${album.pages.length})`);
assert(album.stickers.length === 980, `980 stickers (got ${album.stickers.length})`);
const teamPages = album.pages.filter((p) => p.type === 'team');
assert(teamPages.length === 48, `48 team pages (got ${teamPages.length})`);
assert(teamPages.every((p) => p.stickerIds.length === 20), 'each team has 20 stickers');

// --- Real export parse ---
const REAL = `Figuritas App - List
Usa Mex Can 26
I need
FWC 🏆: 00, 1, 2, 3, 4
FWC 🌎: 5, 6, 7, 8
FWC 📜: 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19
MEX 🇲🇽: 1, 2, 3, 4, 5
PAN 🇵🇦: 1, 2, 3`;

console.log('Parse real export (I need only)');
const parsed = parseExport(REAL);
assert(parsed.unmatched.length === 0, `no unmatched (got ${parsed.unmatched.length}: ${parsed.unmatched})`);
assert(parsed.needs.length === 20 + 5 + 3, `28 needs (got ${parsed.needs.length})`);
assert(parsed.needs.includes('FWC-trophy-00'), 'parses "00" intro sticker');
assert(parsed.needs.includes('MEX-5') && parsed.needs.includes('PAN-3'), 'parses team stickers');

// --- Counts from parse: needs missing, rest owned ---
console.log('parsedToCounts');
const counts = parsedToCounts(parsed, album.stickers.map((s) => s.id));
assert(counts['MEX-5'] === 0, 'needed sticker -> 0');
assert(counts['MEX-6'] === 1, 'unlisted sticker -> owned 1');
const stats = computeStats(counts);
assert(stats.missing === 28, `28 missing (got ${stats.missing})`);
assert(stats.ownedUnique === 980 - 28, `owned ${980 - 28} (got ${stats.ownedUnique})`);

// --- Export with To Swap section ---
console.log('Parse needs + swaps sections');
const WITH_SWAP = `Usa Mex Can 26
I need
BRA 🇧🇷: 3, 4
To Swap
ARG 🇦🇷: 10, 11, 12`;
const p2 = parseExport(WITH_SWAP);
assert(p2.needs.length === 2 && p2.needs.includes('BRA-3'), 'needs parsed');
assert(p2.swaps.length === 3 && p2.swaps.includes('ARG-10'), 'swaps parsed');

// --- Swap candidates ---
console.log('Swap candidates');
// My collection: I have ARG-10 missing, and BRA-3 as a duplicate.
const myCounts: Record<string, number> = { 'BRA-3': 2, 'ARG-10': 0 };
const cand = computeCandidates(myCounts, p2);
assert(cand.youGive.includes('BRA-3'), 'I can give my duplicate they need (BRA-3)');
assert(cand.youGet.includes('ARG-10'), 'I can get their duplicate I need (ARG-10)');
assert(!cand.youGet.includes('ARG-11') || myCounts['ARG-11'] === undefined, 'youGet only includes ones I miss');

// --- Conflicts across open swaps ---
console.log('Conflict detection');
const swaps: Swap[] = [
  { id: 'a', name: 'A', createdAt: 1, status: 'open', theirNeeds: [], theirSwaps: [], giving: ['BRA-3'], receiving: ['ARG-10'] },
  { id: 'b', name: 'B', createdAt: 2, status: 'open', theirNeeds: [], theirSwaps: [], giving: ['BRA-3'], receiving: ['JPN-5'] },
  { id: 'c', name: 'C', createdAt: 3, status: 'closed', theirNeeds: [], theirSwaps: [], giving: ['BRA-3'], receiving: [] },
];
const conf = computeConflicts(swaps);
assert(conf.giving.has('BRA-3'), 'BRA-3 promised in 2 open swaps -> conflict');
assert(!conf.receiving.has('ARG-10'), 'ARG-10 only received once -> no conflict');

console.log(failures === 0 ? '\nALL PASS' : `\n${failures} FAILURES`);
process.exit(failures === 0 ? 0 : 1);

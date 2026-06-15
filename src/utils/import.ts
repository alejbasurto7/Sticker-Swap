import { resolveStickerId } from '../data/sampleAlbum';

export interface ParsedList {
  /** Sticker ids the collector is missing. */
  needs: string[];
  /** Sticker ids the collector has as duplicates (available to swap). */
  swaps: string[];
  /** Raw tokens that could not be matched to a sticker. */
  unmatched: string[];
}

type Section = 'needs' | 'swaps' | null;

// Header keywords (English + Spanish), matched case-insensitively as substrings.
const NEED_KEYWORDS = ['i need', 'need', 'necesito', 'me faltan', 'faltan', 'busco'];
const SWAP_KEYWORDS = ['to swap', 'swap', 'cambio', 'repe', 'tengo', 'doy'];

const SKIP_LINES = ['figuritas app - list', 'figuritas app', 'list', 'lista'];

/** A content line looks like `CODE emoji: 1, 2, 3`. */
const CONTENT_RE = /^(.+?):\s*(.+)$/;

function classifyHeader(line: string): Section {
  const l = line.toLowerCase();
  // Swap keywords take priority so "to swap" isn't caught by a generic need rule.
  if (SWAP_KEYWORDS.some((k) => l.includes(k))) return 'swaps';
  if (NEED_KEYWORDS.some((k) => l.includes(k))) return 'needs';
  return null;
}

/**
 * Parse the Figuritas export text into needs/swaps sticker-id lists.
 * Lines before the first recognized section header (app banner, album name) are
 * ignored. Each content line maps its numbers to sticker ids via the album.
 */
export function parseExport(text: string): ParsedList {
  const needs: string[] = [];
  const swaps: string[] = [];
  const unmatched: string[] = [];
  let section: Section = null;

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;
    if (SKIP_LINES.includes(line.toLowerCase())) continue;

    const match = line.match(CONTENT_RE);
    if (match) {
      // Left side holds the code + emoji; right side the comma-separated numbers.
      const left = match[1].trim();
      const tokens = left.split(/\s+/);
      const code = tokens[0];
      const emoji = tokens.slice(1).join(' ');

      if (!section) continue; // numbers before any section header → ignore

      for (const piece of match[2].split(',')) {
        const number = piece.trim();
        if (!number) continue;
        const id = resolveStickerId(code, emoji, number);
        if (!id) {
          unmatched.push(`${code} ${number}`.trim());
          continue;
        }
        (section === 'needs' ? needs : swaps).push(id);
      }
      continue;
    }

    // Non-content line → maybe a section header.
    const next = classifyHeader(line);
    if (next) section = next;
  }

  return {
    needs: [...new Set(needs)],
    swaps: [...new Set(swaps)],
    unmatched,
  };
}

/**
 * Build a full counts map for the user's own collection from a parsed export.
 * Everything not listed as "needed" is owned (1); swap-listed gets an extra (2).
 */
export function parsedToCounts(parsed: ParsedList, allStickerIds: string[]): Record<string, number> {
  const needSet = new Set(parsed.needs);
  const swapSet = new Set(parsed.swaps);
  const counts: Record<string, number> = {};
  for (const id of allStickerIds) {
    if (needSet.has(id)) counts[id] = 0;
    else if (swapSet.has(id)) counts[id] = 2;
    else counts[id] = 1;
  }
  return counts;
}

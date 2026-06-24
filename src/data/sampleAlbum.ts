import type { Album, Edition, Page, Sticker } from '../types';
import type { SectionDef } from './albumTypes';
import { activeType, buildAlbumFromType, editionInfoFor } from './albumTypes';

/** Per-edition metadata, derived from the active type's variants + CC section. */
export const EDITION_INFO = editionInfoFor(activeType) as Record<
  Edition,
  { label: string; region: string; ccCount: number }
>;

/** Default edition = the active type's default variant. */
export const DEFAULT_EDITION: Edition = activeType.defaultVariant as Edition;

/** A new album does not track the Coca-Cola extras section until the user opts in. */
export const DEFAULT_TRACK_CC = false;

/** Emoji used for the Coca-Cola section, reused by the Settings switch. */
export const CC_EMOJI = activeType.sections.find((s) => s.id === 'CC')?.emoji ?? '🥤';

/** Optional sections enabled by the CC toggle (the FWC type's one optional section). */
const enabledOptional = (trackCC: boolean): string[] => (trackCC ? ['CC'] : []);

// Live module bindings: rebuilt by applyEdition() and read fresh on each render/call.
export let album: Album = buildAlbumFromType(activeType, {
  variant: DEFAULT_EDITION,
  enabledOptional: enabledOptional(DEFAULT_TRACK_CC),
});

/** Lookup helpers, rebuilt alongside the album. */
export let stickerById: Record<string, Sticker> = indexStickers(album);
export let pageById: Record<string, Page> = indexPages(album);

function indexStickers(a: Album): Record<string, Sticker> {
  return Object.fromEntries(a.stickers.map((s) => [s.id, s]));
}
function indexPages(a: Album): Record<string, Page> {
  return Object.fromEntries(a.pages.map((p) => [p.id, p]));
}

/**
 * Rebuild the album for the given edition (variant) and Coca-Cola tracking.
 * Existing count data is unaffected.
 */
export function applyEdition(edition: Edition, trackCC: boolean): void {
  album = buildAlbumFromType(activeType, { variant: edition, enabledOptional: enabledOptional(trackCC) });
  stickerById = indexStickers(album);
  pageById = indexPages(album);
}

/** Order/accent/punctuation-insensitive key for a country name ("Congo DR" ↔ "DR Congo"). */
function nameKey(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // strip diacritics (Côte → Cote)
    .toLowerCase()
    .split(/[^a-z0-9]+/) // words only — drops flags, punctuation, spacing
    .filter(Boolean)
    .sort()
    .join(' ');
}

/**
 * Resolve which album section a free-form import label points at. The label may
 * be a flag emoji (🇲🇽 / 🏴󠁧󠁢󠁳󠁣󠁴󠁿), a country code (MEX), a country name
 * (Congo DR ↔ DR Congo), or any mix (GHA🇬🇭). Matching is tried flag → code →
 * name. When several sections share a match — the FWC intro pages all use code
 * "FWC" — the `number` picks the one that actually contains it.
 */
function findSection(label: string, number: string): SectionDef | undefined {
  const sections = activeType.sections;
  const num = number.trim();

  // 1. Flag/emoji — does the label contain a section's emoji verbatim?
  let candidates = sections.filter((s) => s.emoji && label.includes(s.emoji));

  // 2. Country code — the label's ASCII letters (GHA🇬🇭 → GHA, "Congo DR" → CONGODR).
  if (candidates.length === 0) {
    const code = label.replace(/[^a-z]/gi, '').toUpperCase();
    if (code) candidates = sections.filter((s) => s.code.toUpperCase() === code);
  }

  // 3. Country name — order/accent-insensitive title match.
  if (candidates.length === 0) {
    const key = nameKey(label);
    if (key) candidates = sections.filter((s) => nameKey(s.title) === key);
  }

  if (candidates.length <= 1) return candidates[0];
  // Shared code/emoji (FWC intros): pick whichever section holds the number.
  return candidates.find((s) => stickerById[`${s.id}-${num}`]) ?? candidates[0];
}

/**
 * Resolve a sticker id from a free-form import label + number. See findSection
 * for the accepted label forms (flag emoji, code, country name, or a mix).
 */
export function resolveStickerIdFromLabel(label: string, number: string): string | undefined {
  const section = findSection(label, number);
  if (!section) return undefined;
  const id = `${section.id}-${number.trim()}`;
  return stickerById[id] ? id : undefined;
}

/**
 * Resolve a sticker id from a separate code + emoji + number. Thin wrapper over
 * resolveStickerIdFromLabel kept for callers that hold the parts apart (qr.ts).
 */
export function resolveStickerId(
  code: string,
  emoji: string,
  number: string,
): string | undefined {
  return resolveStickerIdFromLabel(`${code} ${emoji}`.trim(), number);
}

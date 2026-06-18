import type { Album, Edition, Page, Sticker } from '../types';
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

/**
 * Resolve a sticker id from an import line. Intro sections share code "FWC" but
 * split across pages by emoji, so we also match the emoji when provided;
 * otherwise we fall back to whichever FWC section contains that number.
 */
export function resolveStickerId(
  code: string,
  emoji: string,
  number: string,
): string | undefined {
  const normCode = code.trim().toUpperCase();
  const normNum = number.trim();

  if (normCode === 'FWC') {
    const intro = activeType.sections.filter((s) => s.code === 'FWC');
    const byEmoji = intro.find((s) => s.emoji === emoji.trim() && s.numbers.includes(normNum));
    const target = byEmoji ?? intro.find((s) => s.numbers.includes(normNum));
    if (!target) return undefined;
    const id = `${target.id}-${normNum}`;
    return stickerById[id] ? id : undefined;
  }

  const id = `${normCode}-${normNum}`;
  return stickerById[id] ? id : undefined;
}

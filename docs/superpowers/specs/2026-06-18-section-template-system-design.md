# Section Template System & Admin Editor — Design

**Date:** 2026-06-18
**Status:** Approved (pending spec review)

## Problem

The last merged PR (#64, commit `f7a9509`) added a declarative grid layout format
(`src/data/layouts.ts`) for non-country sections, so they could mirror the printed
Panini album like the country spreads do. In practice the non-country sections are
wrong on all three things they were meant to get right:

1. **Height** — sections declare only as many grid rows as they have stickers
   (`FWC_SPECIALS` and `FWC_BALL_COUNTRIES` use `rows: 1`), so their pages collapse to a
   single short sticker-row instead of preserving the full country-spread height. The
   sections "wrap around the stickers" to save vertical space (see Mexico vs. FWC
   Specials screenshots).
2. **Position** — stickers are not where they sit in the physical album.
3. **Orientation** — every non-country sticker renders portrait, even though many are
   landscape in the real album (the trophy halves, the holographic foils, several
   History champion photos).

The current grid format (`LayoutCell` with `col`/`row`/`colSpan`) is also a poor fit for
free placement, and there is no way to author a layout other than hand-editing
TypeScript coordinates.

## Goal

Build a **scalable, reusable template system** — a format, a renderer, and a dev-only
admin editor — general enough that fixing today's five sections is just its first use.
New album types in the future add templates without touching the renderer or editor.

The system must:

1. Preserve the country-spread height for **every** section (structurally, not per
   section).
2. Place each sticker at its real album position.
3. Render each sticker portrait **or** landscape per its real placement.
4. Let the author arrange layouts visually (free drag-and-drop), then bake the result
   into code as the canonical layout.

## Decisions (locked with the user)

- **Editor role:** an authoring tool that **bakes the result into code** (`layouts.ts`),
  with autosave of in-progress work to `localStorage`. The album layout is universal
  truth, so it lives in the repo, not in per-user state.
- **Placement:** **free positioning** (normalized x/y), not grid-snap.
- **System shape:** **one unified free-position registry** — a single format for all
  sections, country included. The country grid format is replaced, not kept alongside.
- **Size & orientation:** **uniform base size** per template, each slot **portrait or
  landscape** (the same foil rotated). Flip by tapping; no per-slot resizing yet.
- **Editor gating:** **dev-only** (`import.meta.env.DEV`), stripped from the deployed
  GitHub Pages build. Author on desktop, export, commit.

## Architecture

### 1. Data model — `src/data/layouts.ts`

Replaces `LayoutCell` / `LayoutPage` / `SectionLayout` entirely.

```ts
// All coordinates are 0–100, normalized to the page box. Origin top-left.
// (x, y) is the slot's CENTER, so flipping orientation does not shift it.
interface TemplateSlot {
  x: number;                            // % of page width  (center)
  y: number;                            // % of page height (center)
  orientation: 'portrait' | 'landscape';
  decorative?: boolean;                 // pre-printed picture: shown, never bound to a
                                        // sticker, never tappable, never counted
}

interface TemplatePage {
  slots: TemplateSlot[];                // rendered 2-up as spreads, in page order
}

interface SectionTemplate {
  id: string;                 // 'country-spread', 'fwc-specials', 'fwc-history', …
  pageAspect: number;         // page width / height. Default = standard country-page aspect
  stickerWidthPct: number;    // base foil width as % of page width (uniform within template)
  pages: TemplatePage[];
}

const TEMPLATES: Record<string, SectionTemplate> = { /* country-spread, fwc-specials, … */ };
```

**Binding (same idea as today's `index`, now positional):** the non-decorative slots,
walked in page order, map to `stickerIds[0], [1], …`. Decorative slots are skipped. One
`country-spread` template still serves all 48 teams.

**Equal heights:** every template shares the standard `pageAspect`, so a spread always
renders at the country-spread height no matter how few stickers it holds — empty space is
reserved, not collapsed.

**Uniform size:** `stickerWidthPct` is the single base size; orientation only flips the
aspect (portrait 5:7 ↔ landscape 7:5). Default tuned to country density (~one quarter of
the page) so stickers stay the same size as today. A future album type can pick a
different density via this field.

**Resolver:** `layoutFor(page)` keeps its current logic (`page.type === 'team'` →
`country-spread`; otherwise a `switch (page.id)`), now returning a `SectionTemplate`.

### 2. Rendering — `PageSection.tsx` + `styles.css`

Keeps the section header + spreads-of-two + fold structure. The inner page changes from a
CSS grid to an **aspect-locked, absolutely-positioned canvas**:

- `.album-page` becomes `position: relative` with `aspect-ratio: var(--page-aspect)`.
  Fixed aspect + equal page width (`flex: 1 1 0`) ⇒ every spread is the country-spread
  height. **This is the height fix.**
- Each slot renders a `StickerCell` absolutely positioned: `left: x%`, `top: y%`,
  `transform: translate(-50%, -50%)` (center anchor), width = `stickerWidthPct` of the
  page, height derived from orientation. Existing `.cell.landscape` styling is reused;
  sizing moves from column-width math to a simple % of page width.
- **Decorative slots** render the existing disabled, numberless placeholder (dashed,
  dimmed, never tappable/counted), just positioned freely.
- Pages still group two-up into `.album-spread-row`s with `.album-fold`; History's four
  pages = two stacked spreads.
- The `filter === 'all'` rule is unchanged: template/spread view is the album-order view;
  `missing` / `swaps` filters still fall back to the responsive `.sticker-grid`.
- Tap-to-add / long-press-to-remove on `StickerCell` is untouched.

**Removed:** inline `gridTemplateColumns/Rows`, the `--cols` variable, and the
`placement()` col/row helper — replaced by a small `slotStyle(slot, template)` returning
`{ left, top, width, transform }`.

### 3. Admin editor — `src/admin/TemplateEditor.tsx` (dev-only)

Mounted only when `import.meta.env.DEV`; tree-shaken from production. Reached at a hidden
path (e.g. `#/admin/templates`).

**Screen:**
- **Template picker** — choose a template to edit or create a new one; pick a real
  section to preview against so slots show actual sticker numbers.
- **Canvas** — the spread rendered by the *same* Section-2 renderer (true WYSIWYG): two
  aspect-locked pages side by side with the fold.
- **Tray** — the section's not-yet-placed stickers; drag one onto the canvas to add a
  slot.

**Interactions:**
- **Drag to move** a slot freely; stored as x/y % (center). Optional light alignment
  guides, but no hard grid.
- **Tap a placed sticker → flip** portrait↔landscape.
- **Tap → remove** sends it back to the tray.
- **Add decorative slot** — drops a pre-printed placeholder you position like any slot
  (History champion photos).
- **Pages** — add/remove pages within the template (reordering is out of scope).
- **Per-template knobs** — `stickerWidthPct` (size slider) and `pageAspect`; defaults
  match country.

**Persistence & export:**
- **Autosave** the in-progress template to a dev-only `localStorage` key so a
  half-finished layout survives a reload.
- **Export** serializes the edited template(s) to the exact `TEMPLATES` TypeScript
  literal and copies it to the clipboard (with a "download `.ts`" fallback). Paste into
  `layouts.ts` and commit — that is how it becomes canonical. No backend, no file-writing.

### 4. Seeding the first use

Pre-convert the existing five layouts into the new format as starting points:

- **country-spread** — replicated so the spread looks pixel-for-pixel as it does now (the
  regression guard).
- **fwc-specials, fwc-ball-countries, cc-latam, fwc-history** — seeded with the agreed
  orientations and rough free positions, so the editor opens with everything close.

**Agreed orientations:** landscape for stickers **00, 1, 2, 3, 10–14** and the History
**pre-printed (decorative) champion photos**; portrait for **4–9, 15–19**.

The author then nudges each non-country section to match the album photos, exports, and
commits.

## Mapping to the three original complaints

- **Same height** → locked `pageAspect` per page (structural, no per-section tuning).
- **Correct positions** → set once in the editor; data persists in `TEMPLATES`.
- **Portrait/landscape** → per-slot `orientation`; the listed stickers seeded landscape.

## Testing

- **Unit — binding:** decorative slots skipped; `stickerIds` fill non-decorative slots in
  order; over-/under-supply handled gracefully (extra stickers / extra slots do not
  crash).
- **Unit — `slotStyle` math:** center anchoring and orientation aspect.
- **Export round-trip:** serialize a template → parse back → deep-equal the original, so
  Export cannot silently corrupt data.
- **Regression:** assert `country-spread` produces the same placements as today.
- **Manual dev checklist:** country unchanged; each non-country section full-height;
  landscape stickers render landscape; filters still fall back to the flow grid;
  tap/long-press still work.

## Out of scope (YAGNI)

Per-user layout overrides; shipping the editor to production; undo/redo history;
multi-select; page reordering; arbitrary per-sticker resizing (deferred until a future
album actually needs it).

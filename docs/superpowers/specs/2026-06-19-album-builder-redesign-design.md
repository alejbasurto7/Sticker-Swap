# Album Builder UI/UX Redesign — Design Spec

## Context

The album-type builder is a **dev-only** tool at `#/admin/templates` (gated by `import.meta.env.DEV` in `src/main.tsx`; dynamically imported so it is tree-shaken out of production). It lets the developer define album types — variants, sections, and per-section slot layouts — and export them as TypeScript to paste into `src/data/albumTypes.ts`.

Today it is a cramped, inline-styled three-panel page (`TemplateEditor.tsx` + `AlbumTypeBar`/`SectionsPanel`/`SectionFields`/`TemplateCanvas`). It uses hard-coded colors (`ui.ts`) and ignores the app's design system. Rough edges: raw CSV bulk-add, browser `prompt()`/`alert()` dialogs, comma-separated number fields, no validation feedback, no drag feedback, one-click deletes with no undo, no responsive behavior, clunky export.

**Goal:** a UI/UX-only overhaul so the builder looks nice and is friendly for the developer who operates it — without changing the underlying data contract.

## Decisions (locked with user)

- **Shell:** hybrid **nav + workspace** (top toolbar + left step rail + focused workspace).
- **Audience:** the developer, **desktop-first**, dev-only; keep **export-to-TypeScript**.
- **Lead win:** the **flow/navigation** restructure.
- **Aesthetic:** **app-harmonious "studio"** — reuse app color tokens/dark base; add a denser pro-tool component layer.
- **Polish:** **full** — snap-to-grid, drag-to-reorder sections, styled inline confirms (no browser pop-ups).
- **Canvas:** **tap = select slot** (open inspector); flip orientation via the inspector toggle.

## Hard constraints

- All mutations keep flowing through `src/admin/registryOps.ts` (immutable ops + helpers — unchanged).
- State `RegistryDraft { activeId, types }` → localStorage `figuritas-albumtypes-draft-v1`, load-on-mount with fallback to seeded `ALBUM_TYPES`.
- Export via `albumTypesToSource()` in `src/admin/serializeTemplates.ts`.
- Data schemas in `src/data/albumTypes.ts` and `src/data/layoutGeometry.ts` — frozen.
- **Isolation invariant:** new builder modules reachable only through `TemplateEditor`; never imported by non-admin code → keeps the editor out of production.
- No new dependencies; drag stays on native pointer events.
- Existing tests stay green (`registryOps.test.ts`, `serializeTemplates.test.ts`).

## Architecture

```
TemplateEditor.tsx          (1-line re-export of BuilderShell — keeps main.tsx import stable)
└─ BuilderShell.tsx         (state: draft + history + step + slot selection; renders the grid)
   ├─ BuilderToolbar.tsx    (type select, preview-variant, undo/redo, export jump)
   ├─ BuilderRail.tsx       (4-step nav + completion bar + reset footer)
   └─ <workspace> one of:
      ├─ steps/TypeStep.tsx        → VariantManager.tsx
      ├─ steps/SectionsStep.tsx    → SectionList.tsx + BulkAddPanel.tsx + SectionInspector.tsx
      ├─ steps/LayoutStep.tsx      → TemplateCanvas.tsx (refactored) + SlotInspector.tsx
      └─ steps/ExportStep.tsx
```

`BuilderShell` absorbs the current `TemplateEditor` state/logic and adds `step`, `selectedSlot`, and undo/redo history. Steps call existing `registryOps` ops via `onUpdateType(mut)` / `onCanvasChange(mut)`. No new ops.

### Studio CSS layer
A single `src/admin/builder/builder.css`, imported only by `BuilderShell`, every rule scoped under `.builder-root`. Consumes app `:root` tokens (`--bg`, `--bg-elev`, `--border`, `--text`, `--green`, `--gold`, `--red`, `--radius`, …); defines no `:root` rules and no bare-element selectors → `styles.css` and the consumer app untouched; light/dark theming is free. Rejected: CSS Modules (ceremony), Tailwind (new dep), rules in `styles.css` (ships to prod).

## Per-step UX

- **Type** — create/select (toolbar) + rename (id permanent); `VariantManager` (label/region rows, default radio, safe delete disabled at one variant).
- **Sections** — `SectionList` (arrows + drag reorder) + `BulkAddPanel` (live parsed-row preview + count, replaces raw CSV) + `SectionInspector` (grouped fields, numeric range Fill replacing `prompt()`, parsed-number chips, inline slot/number validation, per-variant overrides).
- **Layout** — template toolbar (new/clone/delete/reset/copy with toast not `alert`) + canvas (drag feedback, snap-to-grid, tap=select, "+ slot"/"+ decorative", decorative dashed/muted) + `SlotInspector` (orientation toggle, decorative, x/y, size/aspect).
- **Export** — source preview `<pre>`, Copy + Download with success toasts, byte/line count, prominent "paste over `ALBUM_TYPES` + `ACTIVE_ALBUM_TYPE_ID` in `src/data/albumTypes.ts`" guidance.

## Undo/redo & safety
History wraps the whole `RegistryDraft` (cheap; small immutable JSON), funneled through the existing single `commit()` so coverage is automatic. `undo`/`redo` swap `past`/`future`, revalidating selection. Cap ~50. Keyboard `Ctrl/Cmd+Z` / `+Shift+Z` (guarded against firing in fields). Styled inline confirm on destructive actions (deletes recoverable via undo).

## Responsive (desktop-first, minimal)
CSS grid `[rail 210px][workspace 1fr]` + top toolbar. Two media queries: `<1100px` stacks inner two-pane; `<760px` collapses the rail to a horizontal strip.

## Verification
Run `npm run dev` → `#/admin/templates`, walk each step; export round-trips to valid TS (`tsc -b`); persistence via localStorage with seed fallback; **production tree-shake** confirmed by `npm run build` + grep that builder strings are absent from `dist/`; `npm run test` green.

> Implementation plan: `docs/superpowers/plans/2026-06-19-album-builder-redesign.md`.

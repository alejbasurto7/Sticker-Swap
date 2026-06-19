# Album Builder Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the dev-only album-type builder (`#/admin/templates`) as a "studio" hybrid nav + workspace tool that uses the app's design tokens, with undo/redo, inline validation, a redesigned bulk-add, a polished layout canvas, and a real export panel — without changing any underlying data/logic.

**Architecture:** A new `BuilderShell` owns all editor state (the existing `RegistryDraft` + new step/selection/history state) and renders a top toolbar, a left step rail, and one focused workspace step at a time (Type / Sections / Layout / Export). All mutations keep routing through the existing immutable `registryOps` funnels (`updateType`, `onCanvasChange`, `commit`). All new builder UI lives under `src/admin/builder/` and is reachable only through `TemplateEditor`, preserving production tree-shaking. Styling is a single scoped `builder.css` consuming the app's `:root` tokens.

**Tech Stack:** React 18 + TypeScript 5.6 + Vite 5, Vitest 4 (node env, pure-function unit tests — no jsdom/RTL is installed), plain CSS with CSS custom properties, native pointer events (no DnD library).

## Global Constraints

- **No new dependencies.** Drag stays on native pointer events (`setPointerCapture`).
- **Data contract frozen.** Do not edit `src/admin/registryOps.ts`, `src/admin/serializeTemplates.ts`, `src/data/albumTypes.ts`, `src/data/layoutGeometry.ts`, `src/data/layouts.ts`, `src/types.ts`, or `src/styles.css`. Consume them only.
- **State shape:** `RegistryDraft { activeId: string; types: Record<string, AlbumType> }`. Persist to localStorage key `figuritas-albumtypes-draft-v1`. Load on mount with fallback to seeded `ALBUM_TYPES`.
- **Export:** `albumTypesToSource(types: Record<string, AlbumType>, activeId: string): string` from `serializeTemplates`.
- **Isolation invariant (critical):** new builder modules must be imported **only** by `TemplateEditor`/`BuilderShell` (directly or transitively). Never import a builder module from `App.tsx`, `main.tsx` body, or any non-`src/admin/**` file — this is what keeps the editor out of the production bundle.
- **Keep `src/admin/TemplateEditor.tsx`** as the entry filename (re-exporting `BuilderShell`) so `main.tsx`'s `import('./admin/TemplateEditor')` is unchanged.
- **Existing tests must stay green:** `src/admin/registryOps.test.ts`, `src/admin/serializeTemplates.test.ts` (and all other `*.test.ts`).
- **Locked UX decisions:** desktop-first dev tool; app-harmonious studio aesthetic; full polish (snap-to-grid, drag-to-reorder sections, styled inline confirms — no `prompt()`/`alert()`/`window.confirm`); **tap on a canvas slot = select it** (flip orientation via the inspector toggle).
- **Tokens available on `:root`** (from `src/styles.css`, do not redefine): `--bg #0f1115`, `--bg-elev #171a21`, `--bg-elev-2 #1f232c`, `--border #2a2f3a`, `--text #f2f4f8`, `--text-dim #9aa3b2`, `--green #0b8a4b`, `--green-bright #18b563`, `--gold #f5c542`, `--red #e0533d`, `--blue #3b82f6`, `--radius 14px`, `--radius-sm 10px`.

## Existing API reference (consume; do not modify)

From `src/admin/registryOps.ts`:
- `interface RegistryDraft { activeId: string; types: Record<string, AlbumType> }`
- `parseNumbers(input: string): string[]`
- `fillNumbers(n: number): string[]`
- `parseBulkLines(input: string): { code: string; emoji: string; title: string }[]`
- `uniqueId(base: string, taken: string[]): string`
- `newAlbumType(id: string, name: string): AlbumType`
- `addVariant(type, variant: AlbumVariant): AlbumType`, `updateVariant(type, id, patch: Partial<AlbumVariant>): AlbumType`, `removeVariant(type, id): AlbumType`, `setDefaultVariant(type, id): AlbumType`
- `addSection(type): AlbumType`, `updateSection(type, sectionId, patch: Partial<SectionDef>): AlbumType`, `deleteSection(type, sectionId): AlbumType`, `moveSection(type, from: number, to: number): AlbumType`, `bulkAddSections(type, lines, opts: { templateId; numbers; foils; type: PageType }): AlbumType`
- `newTemplate(type, id): AlbumType`, `cloneTemplate(type, sourceId, newId): AlbumType`, `deleteTemplate(type, templateId): AlbumType`, `copyTemplateToType(types, fromTypeId, templateId, toTypeId): { types; newId }`

From `src/data/layoutGeometry.ts`: `bindTemplate(template, numbers)`, `slotBox(slot, template)`, `clientToPagePercent(clientX, clientY, rect)`, `realSlotCount(template): number`, `STANDARD_PAGE_ASPECT`, `STANDARD_STICKER_WIDTH_PCT`, types `SectionTemplate`, `TemplatePage`, `TemplateSlot`.
From `src/admin/serializeTemplates.ts`: `albumTypesToSource(types, activeId): string`.

## Verification model (read once)

There is **no component-render test harness** (no jsdom/RTL). So:
- **Pure new helpers** get real Vitest unit tests (red → green).
- **Components & CSS** are verified by: `npx tsc -b` (typecheck), `npm run test` (existing + new unit suites green), and a **manual route walk** at `http://localhost:5173/#/admin/templates`.
- **Production isolation** is verified once at the end via a build + grep.

Run commands (PowerShell or Bash both fine):
- Typecheck: `npx tsc -b`
- Tests: `npm run test`
- Dev server: `npm run dev` then open `http://localhost:5173/#/admin/templates`
- Build: `npm run build`

---

## File Structure

New files (all under `src/admin/builder/`, all tree-shaken via `TemplateEditor`):

| File | Responsibility |
| --- | --- |
| `builder.css` | Scoped studio styles under `.builder-root`; consumes `:root` tokens. |
| `BuilderShell.tsx` | State owner (draft + step + selection + history); renders toolbar/rail/active step. |
| `history.ts` | Pure undo/redo stack helpers + `snapTo` geometry helper (unit-tested). |
| `useConfirm.tsx` | Styled inline confirm dialog (replaces `window.confirm`). |
| `BuilderToolbar.tsx` | Album-type select, preview-variant select, undo/redo, export jump. |
| `BuilderRail.tsx` | 4-step nav + completion bar + reset footer. |
| `steps/TypeStep.tsx` | Create/select/rename type; hosts `VariantManager`. |
| `VariantManager.tsx` | Variant list/add/default/remove. |
| `steps/SectionsStep.tsx` | Composes `SectionList` + `BulkAddPanel` + `SectionInspector`. |
| `SectionList.tsx` | Reorderable (arrows + drag) sections list. |
| `BulkAddPanel.tsx` | Structured bulk-add + live parsed-row preview. |
| `SectionInspector.tsx` | Grouped section fields, range fill, parsed chips, validation. |
| `steps/LayoutStep.tsx` | Template toolbar + canvas + `SlotInspector`. |
| `SlotInspector.tsx` | Selected-slot properties + size/aspect controls. |
| `steps/ExportStep.tsx` | Source preview + copy/download + paste guidance. |

Modified: `TemplateEditor.tsx` (→ re-export), `TemplateCanvas.tsx` (classes + selection + snap + feedback), `ui.ts` (drop `BTN`/`BTN_SM`; keep `clone`).
Deleted after migration: `AlbumTypeBar.tsx`, `SectionsPanel.tsx`, `SectionFields.tsx`.

---

## Task 1: Studio CSS layer + shell skeleton (same features, new frame)

Builds the scoped CSS and the toolbar/rail/shell, rendering the **existing** `AlbumTypeBar`/`SectionsPanel`/`SectionFields`/`TemplateCanvas` inside step slots. Behavior is unchanged; only the frame and styling change. This task is the "flow" win on its own.

**Files:**
- Create: `src/admin/builder/builder.css`
- Create: `src/admin/builder/BuilderShell.tsx`
- Create: `src/admin/builder/BuilderToolbar.tsx`
- Create: `src/admin/builder/BuilderRail.tsx`
- Modify: `src/admin/TemplateEditor.tsx`

**Interfaces:**
- Consumes: `RegistryDraft`, all `registryOps` listed above, `albumTypesToSource`, existing `AlbumTypeBar`/`SectionsPanel`/`SectionFields`/`TemplateCanvas` props, `clone` from `./ui`.
- Produces (used by later tasks):
  - `BuilderShell` default export (the editor root).
  - `type BuilderStep = 'type' | 'sections' | 'layout' | 'export'`.
  - `BuilderToolbar` props: `{ types: Record<string,AlbumType>; editingTypeId: string; previewVariant: string; onSelectType(id:string):void; onPreviewVariant(id:string):void; canUndo:boolean; canRedo:boolean; onUndo():void; onRedo():void; onJumpExport():void }`.
  - `BuilderRail` props: `{ step: BuilderStep; onStep(s:BuilderStep):void; progressPct:number; onResetType():void; onResetAll():void }`.

- [ ] **Step 1: Create `builder.css`** with everything scoped under `.builder-root`. No `:root` rules, no bare-element selectors except under `.builder-root`.

```css
/* Studio styles for the dev-only album builder. Scoped under .builder-root so
   nothing leaks into the consumer app. Consumes app tokens from :root. */
.builder-root {
  color: var(--text);
  background: var(--bg);
  font: 13px/1.45 -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  min-height: 100vh;
  display: grid;
  grid-template-columns: 210px 1fr;
  grid-template-rows: auto 1fr;
  grid-template-areas: 'toolbar toolbar' 'rail workspace';
}
.builder-toolbar {
  grid-area: toolbar;
  display: flex; gap: 10px; align-items: center; flex-wrap: wrap;
  padding: 10px 14px;
  background: var(--bg-elev); border-bottom: 1px solid var(--border);
  position: sticky; top: 0; z-index: 5;
}
.builder-toolbar .spacer { flex: 1; }
.builder-rail {
  grid-area: rail;
  display: flex; flex-direction: column; gap: 4px;
  padding: 12px 10px;
  background: var(--bg-elev); border-right: 1px solid var(--border);
}
.builder-rail-item {
  display: flex; align-items: center; gap: 8px;
  padding: 9px 11px; border-radius: var(--radius-sm);
  background: transparent; border: 1px solid transparent;
  color: var(--text-dim); font-weight: 700; text-align: left; cursor: pointer;
}
.builder-rail-item:hover { background: var(--bg-elev-2); color: var(--text); }
.builder-rail-item.is-active { background: var(--bg-elev-2); color: var(--text); border-color: var(--border); }
.builder-rail-item .step-index {
  width: 20px; height: 20px; border-radius: 999px;
  display: inline-flex; align-items: center; justify-content: center;
  font-size: 11px; background: var(--bg); border: 1px solid var(--border);
}
.builder-rail-item.is-active .step-index { background: var(--green); border-color: var(--green-bright); color: #fff; }
.builder-rail-progress { margin-top: auto; padding-top: 12px; }
.builder-rail-progress .bar { height: 8px; border-radius: 999px; background: var(--bg-elev-2); overflow: hidden; }
.builder-rail-progress .bar > span { display: block; height: 100%; background: linear-gradient(90deg, var(--green), var(--green-bright)); }
.builder-rail-footer { display: flex; flex-direction: column; gap: 6px; margin-top: 10px; }

.builder-workspace { grid-area: workspace; padding: 16px 20px; overflow: auto; }
.builder-panel { background: var(--bg-elev); border: 1px solid var(--border); border-radius: var(--radius); padding: 14px; margin-bottom: 14px; }
.builder-panel > h3 { margin: 0 0 10px; font-size: 14px; }
.builder-inspector { background: var(--bg-elev); border: 1px solid var(--border); border-radius: var(--radius); padding: 14px; }
.builder-two-pane { display: grid; grid-template-columns: minmax(260px, 38%) 1fr; gap: 14px; align-items: start; }

.builder-field-row { display: flex; gap: 8px; align-items: center; margin-bottom: 8px; }
.builder-field-label { color: var(--text-dim); font-size: 12px; min-width: 84px; }
.builder-root input[type='text'], .builder-input, .builder-select, .builder-textarea {
  background: var(--bg); color: var(--text);
  border: 1px solid var(--border); border-radius: var(--radius-sm);
  padding: 6px 8px; font: inherit;
}
.builder-textarea { width: 100%; box-sizing: border-box; resize: vertical; }
.builder-root input:focus, .builder-input:focus, .builder-select:focus, .builder-textarea:focus {
  outline: none; border-color: var(--green-bright);
}

.builder-btn {
  background: var(--bg-elev-2); color: var(--text);
  border: 1px solid var(--border); border-radius: var(--radius-sm);
  padding: 6px 12px; font: inherit; font-weight: 700; cursor: pointer; white-space: nowrap;
}
.builder-btn:hover { border-color: var(--text-dim); }
.builder-btn:disabled { opacity: 0.45; cursor: not-allowed; }
.builder-btn--primary { background: var(--green); border-color: var(--green-bright); color: #fff; }
.builder-btn--danger { background: transparent; border-color: var(--red); color: var(--red); }
.builder-btn--ghost { background: transparent; }
.builder-btn--sm { padding: 3px 8px; font-size: 12px; }

.builder-validation { display: inline-flex; align-items: center; gap: 6px; font-size: 12px; padding: 4px 8px; border-radius: var(--radius-sm); }
.builder-validation--warn { background: color-mix(in srgb, var(--gold) 18%, transparent); color: var(--gold); }
.builder-validation--error { background: color-mix(in srgb, var(--red) 18%, transparent); color: var(--red); }
.builder-validation--ok { background: color-mix(in srgb, var(--green-bright) 16%, transparent); color: var(--green-bright); }
.builder-chip { display: inline-block; padding: 1px 7px; margin: 2px; border-radius: 999px; background: var(--bg-elev-2); border: 1px solid var(--border); font-size: 11px; }

.builder-toast { position: fixed; bottom: 18px; left: 50%; transform: translateX(-50%); background: var(--bg-elev); border: 1px solid var(--green-bright); color: var(--text); padding: 10px 16px; border-radius: var(--radius); z-index: 50; }

/* Canvas slots (Task 5 uses these classes) */
.builder-slot { position: absolute; transform: translate(-50%, -50%); display: flex; align-items: center; justify-content: center; border-radius: 6px; font-weight: 800; font-size: 12px; cursor: grab; touch-action: none; user-select: none; }
.builder-slot.is-real { border: 1px solid var(--blue); background: color-mix(in srgb, var(--blue) 18%, transparent); color: #cfe0ff; }
.builder-slot.is-decorative { border: 1px dashed var(--text-dim); background: color-mix(in srgb, #ffffff 6%, transparent); color: var(--text-dim); }
.builder-slot.is-selected { box-shadow: 0 0 0 2px var(--gold); }
.builder-slot.is-dragging { opacity: 0.85; box-shadow: 0 6px 16px rgba(0,0,0,0.5); z-index: 3; }
.builder-page { position: relative; width: 100%; background: #11161d; border: 1px solid var(--border); border-radius: 8px; }
.builder-slot-remove { position: absolute; top: -8px; right: -8px; width: 18px; height: 18px; border-radius: 9px; border: none; background: var(--red); color: #fff; font-size: 11px; line-height: 18px; padding: 0; cursor: pointer; }

.builder-confirm-backdrop { position: fixed; inset: 0; background: rgba(0,0,0,0.55); display: flex; align-items: center; justify-content: center; z-index: 60; }
.builder-confirm { background: var(--bg-elev); border: 1px solid var(--border); border-radius: var(--radius); padding: 18px; max-width: 360px; }
.builder-confirm-actions { display: flex; gap: 8px; justify-content: flex-end; margin-top: 14px; }

@media (max-width: 1100px) { .builder-two-pane { grid-template-columns: 1fr; } }
@media (max-width: 760px) {
  .builder-root { grid-template-columns: 1fr; grid-template-areas: 'toolbar' 'rail' 'workspace'; }
  .builder-rail { flex-direction: row; flex-wrap: wrap; border-right: none; border-bottom: 1px solid var(--border); }
  .builder-rail-progress, .builder-rail-footer { display: none; }
}
```

- [ ] **Step 2: Create `BuilderToolbar.tsx`** (presentational; props per Interfaces above). Renders, in a `.builder-toolbar`: an "Album type" `<select className="builder-select">` over `Object.values(types)` showing `{t.name} ({t.id})`; a "Preview as" `<select>` over `types[editingTypeId].variants` (value `previewVariant`); a `.spacer`; Undo/Redo `.builder-btn--ghost --sm` buttons (`disabled={!canUndo}` / `!canRedo`); an "Export ↓" `.builder-btn--sm` calling `onJumpExport`. Guard: if `!types[editingTypeId]` return `null`.

- [ ] **Step 3: Create `BuilderRail.tsx`** (presentational). Renders 4 `.builder-rail-item` buttons for `STEPS = [['type','Type'],['sections','Sections'],['layout','Layout'],['export','Export']] as const`, each with a `.step-index` (1-4) and label, `className` gets `is-active` when `step === key`, `onClick={() => onStep(key)}`. A `.builder-rail-progress` with `<div className="bar"><span style={{ width: progressPct + '%' }} /></div>` and a caption like `{progressPct}% defined`. A `.builder-rail-footer` with two `.builder-btn--ghost --sm` buttons: "Reset this type" → `onResetType`, "Reset all" → `onResetAll`.

- [ ] **Step 4: Create `BuilderShell.tsx`** — move all state/logic from the current `TemplateEditor` here verbatim, import `'./builder.css'`, and render the new frame. Add `const [step, setStep] = useState<BuilderStep>('type')`. Keep `loadDraft`/`seed`/`DRAFT_KEY`/`numbersFor`/`commit`/`updateType`/`focusType`/`selectType`/`addType`/`resetAll`/`resetType`/`resetTemplate`/`onCanvasChange`/`exportRegistry` exactly as in `TemplateEditor.tsx` today. Compute `progressPct` = `type.sections.length === 0 ? 0 : Math.round(100 * type.sections.filter(s => s.numbers.length > 0 && type.templates[s.templateId] && realSlotCount(type.templates[s.templateId]) === s.numbers.length).length / type.sections.length)`. Render:

```tsx
return (
  <div className="builder-root">
    <BuilderToolbar
      types={draft.types} editingTypeId={editingTypeId} previewVariant={previewVariant}
      onSelectType={selectType} onPreviewVariant={setPreviewVariantId}
      canUndo={false} canRedo={false} onUndo={() => {}} onRedo={() => {}}
      onJumpExport={() => setStep('export')} />
    <BuilderRail step={step} onStep={setStep} progressPct={progressPct}
      onResetType={resetType} onResetAll={resetAll} />
    <div className="builder-workspace">
      {step === 'type' && (
        <AlbumTypeBar types={draft.types} editingTypeId={editingTypeId} previewVariant={previewVariant}
          onSelectType={selectType} onNewType={addType} onPreviewVariant={setPreviewVariantId}
          onUpdateType={updateType} onExport={exportRegistry} onResetAll={resetAll} onResetType={resetType} />
      )}
      {step === 'sections' && (
        <div className="builder-two-pane">
          <SectionsPanel type={type} selectedSectionId={selectedSectionId}
            onSelectSection={setSelectedSectionId} onUpdateType={updateType} />
          {section ? <SectionFields type={type} section={section} onUpdateType={updateType} />
                   : <p style={{ opacity: 0.6 }}>Select or add a section to edit it.</p>}
        </div>
      )}
      {step === 'layout' && (section && template
        ? <TemplateCanvas template={template} numbers={previewNumbers} onChange={onCanvasChange} />
        : <p style={{ opacity: 0.6 }}>Pick a section with a template in Sections first.</p>)}
      {step === 'export' && (
        <div className="builder-panel"><button className="builder-btn builder-btn--primary" onClick={exportRegistry}>Export registry</button></div>
      )}
    </div>
  </div>
);
```

(Undo/redo are wired in Task 2 — left as no-ops here so this task compiles and ships independently.) Keep the existing `import AlbumTypeBar`, `SectionsPanel`, `SectionFields`, `TemplateCanvas`, and `realSlotCount` from `../../data/layoutGeometry`.

- [ ] **Step 5: Reduce `TemplateEditor.tsx` to a re-export.** Replace the entire file with:

```tsx
// The dev-only album builder. Kept as the entry filename so main.tsx's
// dynamic import path is stable; all logic lives in BuilderShell.
export { default } from './builder/BuilderShell';
```

- [ ] **Step 6: Typecheck.** Run: `npx tsc -b` — Expected: no errors. (If `BuilderShell` has an unused-var error for `numbersFor`, ensure it is used by `previewNumbers` as in the original.)

- [ ] **Step 7: Tests still green.** Run: `npm run test` — Expected: all suites pass (unchanged; no logic touched).

- [ ] **Step 8: Manual walk.** Run `npm run dev`, open `http://localhost:5173/#/admin/templates`. Expected: dark studio frame with toolbar + left rail (Type/Sections/Layout/Export) + completion bar; clicking rail items swaps the workspace; Type shows the old type/variant bar, Sections shows list+fields two-pane, Layout shows the canvas. Also open `http://localhost:5173/#/` and confirm the consumer app looks unchanged.

- [ ] **Step 9: Commit.**

```bash
git add src/admin/builder/builder.css src/admin/builder/BuilderShell.tsx src/admin/builder/BuilderToolbar.tsx src/admin/builder/BuilderRail.tsx src/admin/TemplateEditor.tsx
git commit -m "feat(builder): studio shell frame around existing panels"
```

---

## Task 2: Undo/redo history + styled confirm

Wires a history stack into the single `commit()` funnel (so coverage is automatic), exposes undo/redo on the toolbar with keyboard shortcuts, and adds a styled inline confirm to replace `window.confirm`/`alert`. Includes a pure `snapTo` helper used later by Task 5.

**Files:**
- Create: `src/admin/builder/history.ts`
- Create: `src/admin/builder/history.test.ts`
- Create: `src/admin/builder/useConfirm.tsx`
- Modify: `src/admin/builder/BuilderShell.tsx`

**Interfaces:**
- Produces:
  - `function pushHistory<T>(past: T[], present: T, cap?: number): T[]` — returns `[...past, present]` truncated to last `cap` (default 50).
  - `function snapTo(value: number, step: number): number` — rounds `value` to nearest `step` (step ≤ 0 returns `value` unchanged), clamped to `[0,100]`.
  - `useConfirm(): { confirm(opts: { message: string; confirmLabel?: string; danger?: boolean }): Promise<boolean>; element: ReactNode }` — render `element` once inside `.builder-root`; call `await confirm(...)` to gate destructive actions.

- [ ] **Step 1: Write failing test for `snapTo` and `pushHistory`** in `src/admin/builder/history.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { snapTo, pushHistory } from './history';

describe('snapTo', () => {
  it('rounds to the nearest step', () => {
    expect(snapTo(52.3, 5)).toBe(50);
    expect(snapTo(53, 5)).toBe(55);
  });
  it('passes through when step <= 0', () => {
    expect(snapTo(52.3, 0)).toBe(52.3);
  });
  it('clamps to 0..100', () => {
    expect(snapTo(-4, 5)).toBe(0);
    expect(snapTo(140, 5)).toBe(100);
  });
});

describe('pushHistory', () => {
  it('appends present and caps length', () => {
    const past = Array.from({ length: 50 }, (_, i) => i);
    const next = pushHistory(past, 999, 50);
    expect(next.length).toBe(50);
    expect(next[next.length - 1]).toBe(999);
    expect(next[0]).toBe(1); // oldest dropped
  });
});
```

- [ ] **Step 2: Run test to verify it fails.** Run: `npx vitest run src/admin/builder/history.test.ts` — Expected: FAIL (`snapTo`/`pushHistory` not found).

- [ ] **Step 3: Implement `history.ts`.**

```ts
/** Append `present` to history, keeping at most `cap` entries (oldest dropped). */
export function pushHistory<T>(past: T[], present: T, cap = 50): T[] {
  const next = [...past, present];
  return next.length > cap ? next.slice(next.length - cap) : next;
}

/** Round `value` to the nearest `step` and clamp to 0..100. step<=0 → passthrough (clamped). */
export function snapTo(value: number, step: number): number {
  const v = step > 0 ? Math.round(value / step) * step : value;
  return Math.max(0, Math.min(100, v));
}
```

- [ ] **Step 4: Run test to verify it passes.** Run: `npx vitest run src/admin/builder/history.test.ts` — Expected: PASS.

- [ ] **Step 5: Implement `useConfirm.tsx`** — a hook returning an `element` (a backdrop+dialog using `.builder-confirm*` classes) and an async `confirm()` that resolves `true`/`false`. Hold `{ message, confirmLabel, danger, resolve } | null` in state; `confirm` sets it and returns a `Promise`; the dialog's Cancel/Confirm buttons resolve and clear it. When state is null, `element` is `null`.

```tsx
import { useCallback, useState, type ReactNode } from 'react';

interface ConfirmOpts { message: string; confirmLabel?: string; danger?: boolean; }
interface Pending extends ConfirmOpts { resolve: (ok: boolean) => void; }

export function useConfirm() {
  const [pending, setPending] = useState<Pending | null>(null);
  const confirm = useCallback(
    (opts: ConfirmOpts) => new Promise<boolean>((resolve) => setPending({ ...opts, resolve })),
    [],
  );
  const close = (ok: boolean) => { pending?.resolve(ok); setPending(null); };
  const element: ReactNode = pending ? (
    <div className="builder-confirm-backdrop" onClick={() => close(false)}>
      <div className="builder-confirm" onClick={(e) => e.stopPropagation()}>
        <p style={{ margin: 0 }}>{pending.message}</p>
        <div className="builder-confirm-actions">
          <button className="builder-btn builder-btn--ghost builder-btn--sm" onClick={() => close(false)}>Cancel</button>
          <button className={`builder-btn builder-btn--sm ${pending.danger ? 'builder-btn--danger' : 'builder-btn--primary'}`}
            onClick={() => close(true)}>{pending.confirmLabel ?? 'Confirm'}</button>
        </div>
      </div>
    </div>
  ) : null;
  return { confirm, element };
}
```

- [ ] **Step 6: Wire history into `BuilderShell.tsx`.** Add `const [past, setPast] = useState<RegistryDraft[]>([])` and `const [future, setFuture] = useState<RegistryDraft[]>([])`. Change `commit` to record history (import `pushHistory`):

```tsx
const commit = (next: RegistryDraft) => {
  setPast((p) => pushHistory(p, draft));
  setFuture([]);
  setDraft(next);
  try { localStorage.setItem(DRAFT_KEY, JSON.stringify(next)); } catch { /* quota */ }
};
const persist = (d: RegistryDraft) => { try { localStorage.setItem(DRAFT_KEY, JSON.stringify(d)); } catch { /* quota */ } };
const undo = () => {
  setPast((p) => { if (!p.length) return p; const prev = p[p.length - 1];
    setFuture((f) => [draft, ...f]); setDraft(prev); persist(prev); return p.slice(0, -1); });
};
const redo = () => {
  setFuture((f) => { if (!f.length) return f; const nextDraft = f[0];
    setPast((p) => [...p, draft]); setDraft(nextDraft); persist(nextDraft); return f.slice(1); });
};
```

Pass `canUndo={past.length > 0} canRedo={future.length > 0} onUndo={undo} onRedo={redo}` to `BuilderToolbar`. Add a keydown effect (desktop): on `Ctrl/Cmd+Z` call `undo()`, on `Ctrl/Cmd+Shift+Z` call `redo()`, but ignore when `document.activeElement` is an INPUT/TEXTAREA/SELECT.

```tsx
useEffect(() => {
  const onKey = (e: KeyboardEvent) => {
    if (!(e.ctrlKey || e.metaKey) || e.key.toLowerCase() !== 'z') return;
    const tag = (document.activeElement?.tagName ?? '').toUpperCase();
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
    e.preventDefault();
    e.shiftKey ? redo() : undo();
  };
  window.addEventListener('keydown', onKey);
  return () => window.removeEventListener('keydown', onKey);
});
```

(Import `useEffect`. The effect runs each render so the `draft`/`past`/`future` closures are current — acceptable for a dev tool.)

- [ ] **Step 7: Mount the confirm element.** In `BuilderShell`, add `const { confirm, element: confirmEl } = useConfirm();` and render `{confirmEl}` just inside the `.builder-root` div. Replace the `copyTemplateToType` `alert(...)` path and any destructive action you already own here with `confirm`-gated equivalents (later tasks pass `confirm` down to lists/inspectors). For now, at minimum, thread `confirm` so Task 3-5 can use it; no behavior change required if nothing here deletes yet.

- [ ] **Step 8: Typecheck + tests.** Run: `npx tsc -b` (Expected: clean) then `npm run test` (Expected: all green incl. new `history.test.ts`).

- [ ] **Step 9: Manual walk.** Dev server: make an edit in the old Type bar (e.g. add a variant), confirm Undo enables and reverts it, Redo re-applies; `Ctrl+Z` works when focus is not in a field; deletes (where present) show the styled dialog, not a browser popup.

- [ ] **Step 10: Commit.**

```bash
git add src/admin/builder/history.ts src/admin/builder/history.test.ts src/admin/builder/useConfirm.tsx src/admin/builder/BuilderShell.tsx
git commit -m "feat(builder): undo/redo history + styled confirm dialog"
```

---

## Task 3: Type step + variant manager

Replaces `AlbumTypeBar` with a focused Type workspace and a clean `VariantManager`. Type create/select moves to the toolbar (already there); rename + variants live in the step.

**Files:**
- Create: `src/admin/builder/steps/TypeStep.tsx`
- Create: `src/admin/builder/VariantManager.tsx`
- Modify: `src/admin/builder/BuilderShell.tsx`
- Modify: `src/admin/builder/BuilderToolbar.tsx` (add new-type create inline)
- Delete: `src/admin/builder/AlbumTypeBar.tsx`

**Interfaces:**
- Consumes: `updateVariant`, `addVariant`, `removeVariant`, `setDefaultVariant`, `newAlbumType` via `addType`.
- Produces:
  - `TypeStep` props: `{ type: AlbumType; onRename(name:string):void; onUpdateType(mut:(t:AlbumType)=>AlbumType):void; confirm: Confirm }` where `type Confirm = (opts:{message:string;confirmLabel?:string;danger?:boolean})=>Promise<boolean>`.
  - `VariantManager` props: `{ type: AlbumType; onUpdateType(mut:(t:AlbumType)=>AlbumType):void; confirm: Confirm }`.
  - `BuilderToolbar` gains `onNewType(id:string,name:string):void`.

- [ ] **Step 1: Create `VariantManager.tsx`.** A `.builder-panel` titled "Variants". For each `type.variants`: a `.builder-field-row` with a label `<input className="builder-input">` (→ `updateVariant(t, v.id, { label })`), a region `<input>` placeholder "region" (→ `updateVariant(t, v.id, { region })`), a radio `name="defaultVariant"` checked when `type.defaultVariant === v.id` (→ `setDefaultVariant(t, v.id)`), and a `.builder-btn--danger --sm` "Remove" button that is `disabled={type.variants.length <= 1}` and, when enabled, calls `if (await confirm({ message: 'Remove variant "'+v.label+'"?', confirmLabel:'Remove', danger:true })) onUpdateType(t => removeVariant(t, v.id))`. Helper text under a single-variant list: "An album type always has at least one variant." A `.builder-btn --sm` "+ variant" → `onUpdateType(t => addVariant(t, { id: 'v'+(t.variants.length+1), label: 'Variant' }))`.

- [ ] **Step 2: Create `steps/TypeStep.tsx`.** A `.builder-panel` "Album type" containing: a rename `.builder-field-row` — label "Name", `<input className="builder-input" value={type.name}>` → `onRename(e.target.value)`; a read-only line "ID: `{type.id}`" with helper text "The id is permanent — create a new type to change it." Then render `<VariantManager type={type} onUpdateType={onUpdateType} confirm={confirm} />`.

- [ ] **Step 3: Add inline new-type create to `BuilderToolbar.tsx`.** After the type `<select>`, add a small `<input className="builder-input" placeholder="new-id">` + `<input placeholder="New name">` + `.builder-btn--sm` "+ type" that calls `onNewType(idTrimmed, name)` and clears the fields (local `useState` in the toolbar). Guard: skip if id is blank.

- [ ] **Step 4: Wire into `BuilderShell.tsx`.** Add `onNewType={addType}` to `BuilderToolbar`. Replace the `step === 'type'` body with:

```tsx
{step === 'type' && (
  <TypeStep type={type}
    onRename={(name) => updateType((t) => ({ ...t, name }))}
    onUpdateType={updateType} confirm={confirm} />
)}
```

Remove the `import AlbumTypeBar` line.

- [ ] **Step 5: Delete `AlbumTypeBar.tsx`.** Run: `git rm src/admin/builder/AlbumTypeBar.tsx`.

- [ ] **Step 6: Typecheck + tests.** Run: `npx tsc -b` (Expected: clean — no dangling `AlbumTypeBar` import) then `npm run test` (Expected: green).

- [ ] **Step 7: Manual walk.** Dev server → Type step: rename a type (persists, toolbar select label updates); add/remove variants (last one's Remove disabled with helper text); change default (radio); create a new type from the toolbar and confirm it becomes active. Undo reverts each.

- [ ] **Step 8: Commit.**

```bash
git add -A src/admin/builder/
git commit -m "feat(builder): Type step + variant manager, drop AlbumTypeBar"
```

---

## Task 4: Sections step (list + bulk-add preview + inspector)

Replaces `SectionsPanel` + `SectionFields` with `SectionList` (arrows + drag reorder), `BulkAddPanel` (live parsed preview), and `SectionInspector` (range fill replacing `prompt()`, parsed chips, inline validation).

**Files:**
- Create: `src/admin/builder/steps/SectionsStep.tsx`
- Create: `src/admin/builder/SectionList.tsx`
- Create: `src/admin/builder/BulkAddPanel.tsx`
- Create: `src/admin/builder/SectionInspector.tsx`
- Modify: `src/admin/builder/BuilderShell.tsx`
- Delete: `src/admin/builder/SectionsPanel.tsx`, `src/admin/builder/SectionFields.tsx`

**Interfaces:**
- Consumes: `addSection`, `deleteSection`, `moveSection`, `bulkAddSections`, `updateSection`, `parseBulkLines`, `parseNumbers`, `fillNumbers`, `realSlotCount`, `Confirm`.
- Produces:
  - `SectionsStep` props: `{ type: AlbumType; selectedSectionId: string; onSelectSection(id:string):void; onUpdateType(mut):void; confirm: Confirm }`.
  - `SectionList` props: `{ type; selectedSectionId; onSelectSection; onUpdateType; confirm }`.
  - `BulkAddPanel` props: `{ type; onUpdateType }`.
  - `SectionInspector` props: `{ type; section: SectionDef; onUpdateType }`.

- [ ] **Step 1: Create `SectionList.tsx`.** A `.builder-panel` "Sections". Each section row (`.builder-field-row`, `is-selected` styling on the selected one) shows emoji, bold code, title (flex 1), `{s.numbers.length}` dim, `{s.templateId || '—'}` dim, then `↑`/`↓` `.builder-btn--sm` (`moveSection(t, i, i-1)` / `i+1`) and a `✕` `.builder-btn--danger --sm` gated by `confirm({ message:'Delete section "'+(s.title||s.code)+'"?', confirmLabel:'Delete', danger:true })`. Row `onClick` → `onSelectSection(s.id)`. A "+ section" `.builder-btn--sm` → `onUpdateType(addSection)` then select the newly added (it's the last in `type.sections` after the op; select by re-deriving). **Drag-to-reorder** (full polish): give each row a drag handle `⋮⋮`; reuse the native-pointer pattern — `onPointerDown` on the handle stores `fromIndex`; track the row under the pointer via `elementFromPoint` or row indices; on `pointerup` call `onUpdateType(t => moveSection(t, from, to))`. Keep arrows as the primary, guaranteed path; drag is the enhancement. Empty state: "No sections yet."

- [ ] **Step 2: Create `BulkAddPanel.tsx`** (collapsible `.builder-panel`, default collapsed). Inputs: a `.builder-textarea` (placeholder `MEX, 🇲🇽, Mexico\nUSA, 🇺🇸, United States`); a template `<select>` over `Object.keys(type.templates)` (+ "(no template)"); a page-type `<select>` (team/intro/extra); a numbers `<input>` + a "Fill 1..N" inline numeric input that sets numbers to `fillNumbers(n).join(',')`; a foils `<input>`. **Live preview:** compute `const rows = parseBulkLines(bulkText)` on each render and show a small table of `{code, emoji, title}` with the count caption "`{rows.length}` sections will be added", flagging rows with blank `code` via a `.builder-validation--warn` chip ("blank code → auto-id"). "Add sections" `.builder-btn--primary` runs `onUpdateType(t => bulkAddSections(t, rows, { templateId: bulkTemplate, numbers: parseNumbers(bulkNumbers), foils: parseNumbers(bulkFoils), type: bulkType }))` then clears `bulkText`.

- [ ] **Step 3: Create `SectionInspector.tsx`** — grouped fields replacing `SectionFields`. Use `patch = (p) => onUpdateType(t => updateSection(t, section.id, p))`. Groups in `.builder-panel`s:
  - **Identity:** Code, Emoji, Title inputs.
  - **Classification:** Type `<select>` (team/intro/extra), Template `<select>` (`(none)` + `Object.keys(type.templates)`), Optional checkbox (`patch({ optional: e.target.checked || undefined })`).
  - **Numbers:** numbers `<input value={section.numbers.join(',')}>` → `patch({ numbers: parseNumbers(e.target.value) })`; a range fill = a numeric `<input className="builder-input" style={{width:64}}>` (local state `fillN`) + "Fill 1..N" `.builder-btn--sm` → `if (fillN>0) patch({ numbers: fillNumbers(fillN) })` (replaces `prompt()`); **parsed chips** beneath: `section.numbers.map(n => <span className="builder-chip" key={n}>{n}</span>)`; foils `<input>` → `patch({ foils: parseNumbers(...) })`.
  - **Per-variant** (only when `type.variants.length > 1`): one row per variant with an `<input placeholder="(base)">` editing `section.numbersByVariant?.[v.id]`; on change, rebuild the map and `patch({ numbersByVariant: Object.keys(next).length ? next : undefined })` (same logic as today's `SectionFields`).
  - **Validation:** compute `tpl = type.templates[section.templateId]`, `slots = tpl ? realSlotCount(tpl) : 0`. If `tpl && slots !== section.numbers.length`, render `<span className="builder-validation builder-validation--warn">⚠ {section.numbers.length} numbers vs {slots} real slots in "{section.templateId}" — adjust numbers or edit slots in Layout.</span>`. If `section.numbers.length > 0 && !tpl`, render a `--warn` chip "No template assigned." Per-variant overrides whose length ≠ slots → a `--warn` chip naming the variant.

- [ ] **Step 4: Create `steps/SectionsStep.tsx`.** Renders `<BulkAddPanel>` (full width) above a `.builder-two-pane` of `<SectionList>` and either `<SectionInspector>` (when a section is selected) or a `.builder-panel` placeholder "Select or add a section to edit it."

- [ ] **Step 5: Wire into `BuilderShell.tsx`.** Replace the `step === 'sections'` block with `<SectionsStep type={type} selectedSectionId={selectedSectionId} onSelectSection={setSelectedSectionId} onUpdateType={updateType} confirm={confirm} />`. Remove `import SectionsPanel`, `import SectionFields`.

- [ ] **Step 6: Delete old files.** Run: `git rm src/admin/builder/SectionsPanel.tsx src/admin/builder/SectionFields.tsx`.

- [ ] **Step 7: Typecheck + tests.** Run: `npx tsc -b` (Expected: clean) then `npm run test` (Expected: green — `registryOps.test.ts` still covers the ops).

- [ ] **Step 8: Manual walk.** Sections step: bulk-add a pasted block → preview rows + count match what gets added; reorder via arrows and via drag handle; add a section; select one → inspector groups render; Range "Fill 1..N" sets numbers with **no browser prompt**; parsed chips show the captured numbers; set a mismatched count → warning chip appears; per-variant editor shows only with >1 variant; delete via styled confirm; Undo reverts.

- [ ] **Step 9: Commit.**

```bash
git add -A src/admin/builder/
git commit -m "feat(builder): Sections step with bulk-add preview, range fill, validation"
```

---

## Task 5: Layout step (canvas polish + slot inspector)

Refactors `TemplateCanvas` to classes, lifts slot selection up, makes **tap = select**, adds drag feedback + snap-to-grid, and adds a `SlotInspector` (orientation toggle, decorative, x/y, size/aspect). Moves the template toolbar (new/clone/delete/reset/copy) into the step with a toast instead of `alert()`.

**Files:**
- Modify: `src/admin/builder/TemplateCanvas.tsx`
- Create: `src/admin/builder/SlotInspector.tsx`
- Create: `src/admin/builder/steps/LayoutStep.tsx`
- Modify: `src/admin/builder/BuilderShell.tsx`

**Interfaces:**
- Consumes: `bindTemplate`, `slotBox`, `clientToPagePercent`, `realSlotCount`, `snapTo`, `newTemplate`, `cloneTemplate`, `deleteTemplate`, `copyTemplateToType`, `Confirm`.
- Produces:
  - `type SelectedSlot = { pageIdx: number; slotIdx: number } | null`.
  - `TemplateCanvas` props: `{ template; numbers: string[]; onChange(mut:(t:SectionTemplate)=>void):void; selected: SelectedSlot; onSelect(sel: SelectedSlot):void; snap: number }`.
  - `SlotInspector` props: `{ template; selected: SelectedSlot; onChange(mut:(t:SectionTemplate)=>void):void; snap: number; onSnapChange(step:number):void }`.
  - `LayoutStep` props: `{ type; section; template; previewNumbers; editingTypeId; otherTypeIds; onUpdateType; onCanvasChange; onResetTemplate; onCopyTemplate(toId:string):void; confirm: Confirm }`.

- [ ] **Step 1: Refactor `TemplateCanvas.tsx` to classes + selection + snap.** Replace the inline `slotStyle` with `className` usage. Keep `bindTemplate`/`labels`/`slotBox` and the pointer handlers, but:
  - Slot element: `className={`builder-slot ${slot.decorative ? 'is-decorative' : 'is-real'} ${isSelected ? 'is-selected' : ''} ${isDragging ? 'is-dragging' : ''}`}` with only positioning left/top/width/height via inline `style` from `slotBox`.
  - `onSlotPointerMove`: apply snap before writing — `slot.x = snapTo(x, snap); slot.y = snapTo(y, snap);` (import `snapTo`). Set a `dragging` ref/state to drive `is-dragging`.
  - `onSlotPointerUp`: if `!moved` → **select** this slot (`onSelect({ pageIdx, slotIdx })`) instead of flipping orientation. (Orientation flip now lives in `SlotInspector`.)
  - Page container: `className="builder-page"` with inline `style={{ aspectRatio: String(template.pageAspect) }}`.
  - Remove the in-canvas size/aspect sliders (they move to `SlotInspector`); keep `+ page` and per-page `+ slot` / `+ decorative` / `✕ page` buttons (rename "+ sticker"→"+ slot", "+ photo"→"+ decorative"), using `.builder-btn--sm`. Keep the unplaced-stickers warning as a `.builder-validation--warn`.
  - Remove the `import { BTN, BTN_SM } from './ui'`.

- [ ] **Step 2: Create `SlotInspector.tsx`.** A `.builder-inspector`. Top: snap control — `<select>` mapping to `0` (Off), `1`, `2.5`, `5` (`onSnapChange(Number(value))`). Size/aspect: the two range inputs moved from the canvas (Sticker size → `onChange(t => { t.stickerWidthPct = v; })`, Page aspect → `onChange(t => { t.pageAspect = v; })`) with numeric readouts. When `selected` is set, read `const slot = template.pages[selected.pageIdx]?.slots[selected.slotIdx]` and show: an **Orientation** toggle `.builder-btn--sm` ("Portrait"/"Landscape") flipping `slot.orientation`; a **Decorative** checkbox (`slot.decorative`); read-only `x: {slot.x}%  y: {slot.y}%`. When nothing selected: helper text "Tap a slot to edit it."

- [ ] **Step 3: Create `steps/LayoutStep.tsx`.** Holds `const [snap, setSnap] = useState(0)` and reads `selectedSlot`/`onSelectSlot` from props (lifted to shell — see Step 4). A template toolbar row of `.builder-btn--sm`: "+ template" (`newTemplate(t,'template')`), and when `section?.templateId`: "Clone" (`cloneTemplate`), "Delete template" (gated by `confirm`, `danger`), "Reset template" (only when a code seed exists → `onResetTemplate`), and a "Copy → (album type)" `<select>` over `otherTypeIds` calling `onCopyTemplate(id)`. Layout: `.builder-two-pane` of the canvas (left/main) and `<SlotInspector>` (right). If no template, show the placeholder text.

- [ ] **Step 4: Wire into `BuilderShell.tsx`.** Add `const [selectedSlot, setSelectedSlot] = useState<SelectedSlot>(null)`. Replace the `step === 'layout'` block with a `<LayoutStep ... selectedSlot={selectedSlot} onSelectSlot={setSelectedSlot} />` (extend `LayoutStep` props to receive `selectedSlot`/`onSelectSlot` and pass through to canvas/inspector). Implement `onCopyTemplate(toId)` here using the existing `copyTemplateToType` + `commit`, then trigger a toast (local `const [toast, setToast] = useState<string|null>(null)`, render `{toast && <div className="builder-toast">{toast}</div>}`, auto-clear via `setTimeout`). Clear `selectedSlot` when `section`/`template` changes (an effect keyed on `section?.id`/`section?.templateId`).

- [ ] **Step 5: Typecheck + tests.** Run: `npx tsc -b` (Expected: clean) then `npm run test` (Expected: green — `layoutGeometry.test.ts` unaffected; only UI changed).

- [ ] **Step 6: Manual walk.** Layout step: drag a slot → it lifts (`is-dragging`), position persists; set Snap = 5 → drags round to 5% steps; tap a slot → it gets the gold ring and the inspector shows its props; toggle orientation/decorative from the inspector; adjust size/aspect sliders; add/remove slot and page (remove-page via confirm); copy template to another type → toast appears (no `alert`); unplaced warning shows when numbers > slots.

- [ ] **Step 7: Commit.**

```bash
git add -A src/admin/builder/
git commit -m "feat(builder): Layout step — tap-select, snap-to-grid, slot inspector, toast"
```

---

## Task 6: Export step (preview + copy/download + guidance) and ui.ts cleanup

Replaces the bare Export button with a real panel and removes the now-unused inline button styles.

**Files:**
- Create: `src/admin/builder/steps/ExportStep.tsx`
- Modify: `src/admin/builder/BuilderShell.tsx`
- Modify: `src/admin/builder/ui.ts`

**Interfaces:**
- Consumes: `albumTypesToSource`.
- Produces: `ExportStep` props: `{ source: string }` (the shell computes `albumTypesToSource(draft.types, draft.activeId)` and passes it in).

- [ ] **Step 1: Create `steps/ExportStep.tsx`.** A `.builder-panel` "Export registry". Show a read-only `<pre>` (max-height ~360px, scroll, `.builder-input`-like background) of `source`; a caption "`{source.split('\n').length}` lines · `{source.length}` chars". Two `.builder-btn` buttons: **Copy** (`await navigator.clipboard.writeText(source)` → set a local "Copied!" toast; on throw, set "Clipboard blocked — use Download") and **Download** (Blob → anchor `download='albumTypes.generated.ts'` → "Downloaded albumTypes.generated.ts" toast). A guidance block: "Paste this over the `ALBUM_TYPES` and `ACTIVE_ALBUM_TYPE_ID` exports in `src/data/albumTypes.ts`, then commit." Render the local toast via `.builder-toast`.

- [ ] **Step 2: Wire into `BuilderShell.tsx`.** Replace the `step === 'export'` block with `<ExportStep source={albumTypesToSource(draft.types, draft.activeId)} />`. The old `exportRegistry` can be removed (or kept only if still referenced); the toolbar "Export" button now just jumps to the step (`onJumpExport` already does `setStep('export')`).

- [ ] **Step 3: Clean up `ui.ts`.** Remove `BTN` and `BTN_SM` (no longer imported anywhere — verify via search). Keep `clone`. Resulting file:

```ts
/** Deep clone via JSON — editor data is plain. */
export const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v)) as T;
```

- [ ] **Step 4: Verify no dangling `BTN`/`BTN_SM` imports.** Run a search for `BTN` under `src/admin/builder/` — Expected: no matches except (none). Fix any stragglers.

- [ ] **Step 5: Typecheck + tests.** Run: `npx tsc -b` (Expected: clean) then `npm run test` (Expected: all green).

- [ ] **Step 6: Manual walk.** Export step: preview matches the generated source; Copy shows a success toast and the clipboard holds valid TS; Download saves `albumTypes.generated.ts`; guidance is visible. Toolbar "Export" jumps here.

- [ ] **Step 7: Commit.**

```bash
git add -A src/admin/builder/
git commit -m "feat(builder): Export step with source preview, copy/download, guidance"
```

---

## Task 7: Final verification — export validity, persistence, production isolation

No new features — proves the redesign preserves every contract.

**Files:** none (verification only; may touch a scratch copy that is NOT committed).

- [ ] **Step 1: Full typecheck + test suite.** Run: `npx tsc -b` then `npm run test` — Expected: all green, including `registryOps.test.ts` and `serializeTemplates.test.ts` (untouched).

- [ ] **Step 2: Export round-trips to valid TS.** In the dev editor, make a small edit, go to Export, Download `albumTypes.generated.ts`. Paste its contents over the `ALBUM_TYPES` + `ACTIVE_ALBUM_TYPE_ID` exports in a **scratch git-stashable** copy of `src/data/albumTypes.ts`, run `npx tsc -b` — Expected: type-checks. Revert the scratch change (`git checkout -- src/data/albumTypes.ts`). Quick proxy if you skip the paste: `npx vitest run src/admin/serializeTemplates.test.ts` stays green.

- [ ] **Step 3: Persistence.** Mutate, reload `#/admin/templates` → draft restored from `figuritas-albumtypes-draft-v1`. In devtools, clear that key and reload → editor falls back to seeded `ALBUM_TYPES`.

- [ ] **Step 4: Production isolation (critical).** Run: `npm run build`. Then confirm builder-only strings are ABSENT from the production bundle:

```bash
grep -rl "builder-root\|builder-rail\|SlotInspector\|Album type" dist/assets || echo "NOT FOUND (good)"
```

Expected: `NOT FOUND (good)` (no builder JS/CSS shipped). Optionally `npm run preview`, open `/#/admin/templates`, and confirm it renders the **normal app**, not the editor (the `import.meta.env.DEV` guard is false in preview).

- [ ] **Step 5: Commit (if any verification fixes were needed).**

```bash
git add -A
git commit -m "chore(builder): verification pass — export validity + prod isolation confirmed"
```

---

## Self-Review notes

- **Spec coverage:** shell/nav (T1), studio CSS + tokens (T1), undo/redo + confirms (T2), Type+variants (T3), Sections list/bulk-preview/range-fill/validation/per-variant (T4), Layout tap-select/snap/inspector/decorative/copy-toast (T5), Export panel (T6), tree-shaking + export validity + persistence (T7). All locked decisions mapped.
- **Type consistency:** `Confirm` type is `(opts:{message:string;confirmLabel?:string;danger?:boolean})=>Promise<boolean>` everywhere; `SelectedSlot` = `{pageIdx:number;slotIdx:number}|null` used in canvas/inspector/shell; `BuilderStep` literal union is identical in toolbar/rail/shell.
- **No placeholders:** logic-bearing steps (CSS map, history/commit wiring, snap, confirm hook, validation, bulk preview, export) include full code; presentational components specify exact classes, props, and registryOps calls to use.
- **Honest testing note:** no jsdom/RTL is installed, so components are verified by typecheck + existing unit suites + manual walk; only the genuinely pure new helpers (`snapTo`, `pushHistory`) get Vitest tests — adding a render-test harness would violate the no-new-deps constraint.

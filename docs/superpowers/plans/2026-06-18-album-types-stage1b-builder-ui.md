# Album Types — Stage 1B (Album-Type Builder UI) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Grow the dev-only `#/admin/templates` editor from a single-template editor into a full **album-type builder** — pick/create album types, edit variants, add/bulk-add/reorder/delete sections, edit each section's fields, manage and copy templates across types, and **Export the whole `ALBUM_TYPES` registry** to paste back into `src/data/albumTypes.ts`.

**Architecture:** Keep all mutation logic in a new **pure, fully-tested** module `src/admin/registryOps.ts` (operating on `AlbumType`/registry values immutably) plus a registry serializer in `src/admin/serializeTemplates.ts`. The React layer is a thin shell: small focused components under `src/admin/builder/` (`AlbumTypeBar`, `SectionsPanel`, `SectionFields`, `TemplateCanvas`, shared `ui.ts`) composed by a rewritten `src/admin/TemplateEditor.tsx` that holds the draft registry, autosaves it, and wires the pure ops to the UI. This mirrors the repo's existing split: pure functions are unit-tested in the node Vitest env; the dev-only UI is manually verified.

**Tech Stack:** React 18, TypeScript (strict, `noUnusedLocals`/`noUnusedParameters` ON), Vite, Vitest (node env, `src/**/*.test.ts` only — no component tests).

## Global Constraints

- **Dev-only, behaviour-preserving for the app:** this stage touches only `src/admin/**` and adds to `src/admin/serializeTemplates.ts`. It does **not** modify `src/data/albumTypes.ts`, `src/data/sampleAlbum.ts`, `src/data/layouts.ts`, `src/data/layoutGeometry.ts`, or any app component — so the shipped app (Album/Stats/Swaps) and all existing tests stay green and unchanged. The editor stays tree-shaken out of production via the existing `import.meta.env.DEV` dynamic import in `src/main.tsx` (do not touch the mount guard).
- **Pure ops are immutable:** every function in `registryOps.ts` returns a new value and never mutates its arguments (the React shell relies on this for `setState`).
- **Stable section ids:** a section's `id` backs its sticker ids (`${id}-${number}`); editing a section's `code`/fields must **never** change its `id`. New ids are assigned only at create/bulk-add time and de-duplicated.
- **Templates owned per type, copy = duplicate:** copying a template to another album type produces an **independent** deep copy (editing either side never affects the other); on id collision in the target, auto-rename (`id`, `id-2`, …).
- **Export = whole registry:** Export serializes the entire `{ types, activeId }` draft to a pasteable TS module declaring `ALBUM_TYPES` and `ACTIVE_ALBUM_TYPE_ID`. `AlbumType` is plain data, so the JSON literal round-trips via `JSON.parse`.
- **TypeScript build gate is real:** `noUnusedLocals`/`noUnusedParameters` are ON. Every import/param in new `.ts`/`.tsx` files must be used. `tsc -b` (part of `npm run build`) typechecks all of `src/**` except `*.test.ts`.
- **Preserve & extend, don't break:** keep the existing `templatesToJSON`/`templatesToSource` exports (and their passing test) in `serializeTemplates.ts`; add the new registry serializers alongside.
- **Test command:** `npm test` (Vitest). Build: `npm run build` (`tsc -b && vite build`). Run **both** before each commit. Dev server for manual checks: `npm run dev` → open `#/admin/templates`.
- **Branch:** `claude/album-types-stage1b` (created off `main` in Task 1).

---

## File Structure

- **Modify** `src/admin/serializeTemplates.ts` — add `albumTypesToJSON()` + `albumTypesToSource()` (registry → pasteable TS); keep existing template serializers.
- **Modify** `src/admin/serializeTemplates.test.ts` — add round-trip + source tests for the registry serializers.
- **Create** `src/admin/registryOps.ts` — `RegistryDraft` type + all pure registry mutation ops (parsing helpers, variants, sections, templates, cross-type copy).
- **Create** `src/admin/registryOps.test.ts` — unit tests for every op.
- **Create** `src/admin/builder/ui.ts` — shared `BTN`/`BTN_SM` styles + `clone`.
- **Create** `src/admin/builder/TemplateCanvas.tsx` — the slot canvas (drag/flip/✕/add/size/aspect), extracted from today's editor as a props-driven component.
- **Create** `src/admin/builder/AlbumTypeBar.tsx` — album-type picker + new-type + variant editor + preview-as-variant + Export/Reset buttons.
- **Create** `src/admin/builder/SectionsPanel.tsx` — sections list with add / bulk-add / reorder / delete.
- **Create** `src/admin/builder/SectionFields.tsx` — the selected section's fields form (code/emoji/title/type/numbers/foils/template/optional/per-variant) + count check.
- **Modify** `src/admin/TemplateEditor.tsx` — rewrite into the orchestrator: holds the `RegistryDraft`, autosaves, composes the components, wires the ops, hosts the template toolbar + canvas.

---

## Task 1: Whole-registry serialization (Export)

**Files:**
- Modify: `src/admin/serializeTemplates.ts`
- Test: `src/admin/serializeTemplates.test.ts`

**Interfaces:**
- Consumes: `AlbumType` from `../data/albumTypes` (type only); existing `ALBUM_TYPES`, `ACTIVE_ALBUM_TYPE_ID` for the test.
- Produces (used by Task 5):
  - `albumTypesToJSON(types: Record<string, AlbumType>): string`
  - `albumTypesToSource(types: Record<string, AlbumType>, activeId: string): string`

- [ ] **Step 1: Create the branch**

```bash
git checkout main
git checkout -b claude/album-types-stage1b
```

- [ ] **Step 2: Write the failing tests**

Append to `src/admin/serializeTemplates.test.ts`:

```ts
import { albumTypesToJSON, albumTypesToSource } from './serializeTemplates';
import { ALBUM_TYPES, ACTIVE_ALBUM_TYPE_ID } from '../data/albumTypes';

describe('albumTypesToJSON', () => {
  it('round-trips the album-type registry through JSON', () => {
    const json = albumTypesToJSON(ALBUM_TYPES);
    expect(JSON.parse(json)).toEqual(ALBUM_TYPES);
  });
});

describe('albumTypesToSource', () => {
  it('emits pasteable ALBUM_TYPES + ACTIVE_ALBUM_TYPE_ID declarations', () => {
    const src = albumTypesToSource(ALBUM_TYPES, ACTIVE_ALBUM_TYPE_ID);
    expect(src).toContain('export const ALBUM_TYPES');
    expect(src).toContain('export const ACTIVE_ALBUM_TYPE_ID = "2026-fwc"');
    expect(src).toContain('2026-fwc');
    expect(src).toContain(albumTypesToJSON(ALBUM_TYPES));
  });
});
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `npm test -- src/admin/serializeTemplates.test.ts`
Expected: FAIL — `albumTypesToJSON`/`albumTypesToSource` not exported.

- [ ] **Step 4: Implement the registry serializers**

Append to `src/admin/serializeTemplates.ts` (keep the existing imports + functions; add a type import for `AlbumType`):

```ts
import type { AlbumType } from '../data/albumTypes';

/** Pretty-printed, round-trippable JSON of the whole album-type registry. */
export function albumTypesToJSON(types: Record<string, AlbumType>): string {
  return JSON.stringify(types, null, 2);
}

/**
 * The whole album-type registry as a TypeScript module to paste over the
 * ALBUM_TYPES / ACTIVE_ALBUM_TYPE_ID exports in src/data/albumTypes.ts. Every
 * AlbumType is plain data (sections + templates), so the JSON literal is a
 * faithful, round-trippable representation of the registry.
 */
export function albumTypesToSource(
  types: Record<string, AlbumType>,
  activeId: string,
): string {
  return [
    '// Generated by the dev-only album-type builder — paste over ALBUM_TYPES and',
    '// ACTIVE_ALBUM_TYPE_ID in src/data/albumTypes.ts.',
    "import type { AlbumType } from './albumTypes';",
    '',
    `export const ALBUM_TYPES: Record<string, AlbumType> = ${albumTypesToJSON(types)};`,
    '',
    `export const ACTIVE_ALBUM_TYPE_ID = ${JSON.stringify(activeId)};`,
    '',
  ].join('\n');
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npm test -- src/admin/serializeTemplates.test.ts`
Expected: PASS (both new describes + the two existing template-serializer tests).

- [ ] **Step 6: Build + full suite**

Run: `npm run build && npm test`
Expected: PASS — `tsc` clean, all tests green.

- [ ] **Step 7: Commit**

```bash
git add src/admin/serializeTemplates.ts src/admin/serializeTemplates.test.ts
git commit -m "feat(admin): serialize the whole ALBUM_TYPES registry for Export"
```

---

## Task 2: Pure registry-ops module

All editor mutations as pure, tested functions. The React shell (Tasks 3–5) only calls these.

**Files:**
- Create: `src/admin/registryOps.ts`
- Test: `src/admin/registryOps.test.ts`

**Interfaces:**
- Consumes: `AlbumType`, `AlbumVariant`, `SectionDef` from `../data/albumTypes` (types); `PageType` from `../types`; `SectionTemplate`, `STANDARD_PAGE_ASPECT`, `STANDARD_STICKER_WIDTH_PCT` from `../data/layoutGeometry`.
- Produces (used by Tasks 3–5):
  - `interface RegistryDraft { activeId: string; types: Record<string, AlbumType> }`
  - `parseNumbers(input: string): string[]`
  - `fillNumbers(n: number): string[]`
  - `parseBulkLines(input: string): { code: string; emoji: string; title: string }[]`
  - `uniqueId(base: string, taken: string[]): string`
  - `blankTemplate(id: string): SectionTemplate`
  - `newAlbumType(id: string, name: string): AlbumType`
  - `addVariant(type, variant: AlbumVariant): AlbumType`
  - `updateVariant(type, id: string, patch: Partial<AlbumVariant>): AlbumType`
  - `removeVariant(type, id: string): AlbumType`
  - `setDefaultVariant(type, id: string): AlbumType`
  - `addSection(type): AlbumType`
  - `updateSection(type, sectionId: string, patch: Partial<SectionDef>): AlbumType`
  - `deleteSection(type, sectionId: string): AlbumType`
  - `moveSection(type, from: number, to: number): AlbumType`
  - `bulkAddSections(type, lines, opts: { templateId: string; numbers: string[]; foils: string[]; type: PageType }): AlbumType`
  - `newTemplate(type, id: string): AlbumType`
  - `cloneTemplate(type, sourceId: string, newId: string): AlbumType`
  - `deleteTemplate(type, templateId: string): AlbumType`
  - `copyTemplateToType(types, fromTypeId: string, templateId: string, toTypeId: string): { types: Record<string, AlbumType>; newId: string }`

- [ ] **Step 1: Write the failing tests**

Create `src/admin/registryOps.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import {
  parseNumbers, fillNumbers, parseBulkLines, uniqueId, blankTemplate, newAlbumType,
  addVariant, updateVariant, removeVariant, setDefaultVariant,
  addSection, updateSection, deleteSection, moveSection, bulkAddSections,
  newTemplate, cloneTemplate, deleteTemplate, copyTemplateToType,
} from './registryOps';
import type { AlbumType } from '../data/albumTypes';

const T = (): AlbumType => newAlbumType('demo', 'Demo');

describe('parsing helpers', () => {
  it('parseNumbers trims and drops empties', () => {
    expect(parseNumbers(' 1, 2 ,,3 ')).toEqual(['1', '2', '3']);
  });
  it('fillNumbers builds 1..N', () => {
    expect(fillNumbers(4)).toEqual(['1', '2', '3', '4']);
    expect(fillNumbers(0)).toEqual([]);
  });
  it('parseBulkLines splits code/emoji/title and skips blanks', () => {
    expect(parseBulkLines('MEX, 🇲🇽, Mexico\n\nUSA, 🇺🇸, United States')).toEqual([
      { code: 'MEX', emoji: '🇲🇽', title: 'Mexico' },
      { code: 'USA', emoji: '🇺🇸', title: 'United States' },
    ]);
  });
  it('uniqueId suffixes on collision', () => {
    expect(uniqueId('x', [])).toBe('x');
    expect(uniqueId('x', ['x'])).toBe('x-2');
    expect(uniqueId('x', ['x', 'x-2'])).toBe('x-3');
  });
});

describe('album type + variants', () => {
  it('newAlbumType has one default variant and no sections', () => {
    const t = T();
    expect(t.variants).toEqual([{ id: 'base', label: 'Base' }]);
    expect(t.defaultVariant).toBe('base');
    expect(t.sections).toEqual([]);
    expect(t.templates).toEqual({});
  });
  it('addVariant uniquifies the id; removeVariant reassigns default and trims overrides', () => {
    let t = addVariant(T(), { id: 'na', label: 'NA' });
    t = addVariant(t, { id: 'na', label: 'NA2' }); // collides
    expect(t.variants.map((v) => v.id)).toEqual(['base', 'na', 'na-2']);
    t = setDefaultVariant(t, 'na');
    t = addSection(t);
    const sid = t.sections[0].id;
    t = updateSection(t, sid, { numbersByVariant: { na: ['1'] } });
    t = removeVariant(t, 'na');
    expect(t.variants.map((v) => v.id)).toEqual(['base', 'na-2']);
    expect(t.defaultVariant).toBe('base'); // default moved off the removed variant
    expect(t.sections[0].numbersByVariant).toEqual({}); // 'na' override dropped
  });
  it('removeVariant refuses to drop the last variant', () => {
    expect(removeVariant(T(), 'base')).toEqual(T());
  });
});

describe('sections', () => {
  it('addSection appends with a unique id and the first template', () => {
    let t = newTemplate(T(), 'tpl');
    t = addSection(t);
    expect(t.sections).toHaveLength(1);
    expect(t.sections[0].templateId).toBe('tpl');
    t = addSection(t);
    expect(t.sections.map((s) => s.id)).toEqual(['section', 'section-2']);
  });
  it('updateSection patches fields but keeps id stable', () => {
    let t = addSection(T());
    const id = t.sections[0].id;
    t = updateSection(t, id, { title: 'Mexico', numbers: ['1', '2'] });
    expect(t.sections[0].title).toBe('Mexico');
    expect(t.sections[0].numbers).toEqual(['1', '2']);
    expect(t.sections[0].id).toBe(id);
  });
  it('deleteSection removes by id', () => {
    const t = addSection(T());
    expect(deleteSection(t, t.sections[0].id).sections).toEqual([]);
  });
  it('moveSection reorders (clamped)', () => {
    let t = bulkAddSections(T(), parseBulkLines('A,,\nB,,\nC,,'),
      { templateId: '', numbers: [], foils: [], type: 'team' });
    expect(t.sections.map((s) => s.id)).toEqual(['A', 'B', 'C']);
    t = moveSection(t, 2, 0);
    expect(t.sections.map((s) => s.id)).toEqual(['C', 'A', 'B']);
    t = moveSection(t, 0, 99); // clamps to last
    expect(t.sections.map((s) => s.id)).toEqual(['A', 'B', 'C']);
  });
  it('bulkAddSections makes one section per line sharing template + numbers', () => {
    const t = bulkAddSections(T(), parseBulkLines('MEX, 🇲🇽, Mexico\nUSA, 🇺🇸, United States'),
      { templateId: 'country-spread', numbers: fillNumbers(20), foils: ['1'], type: 'team' });
    expect(t.sections.map((s) => s.id)).toEqual(['MEX', 'USA']);
    expect(t.sections[0]).toMatchObject({
      code: 'MEX', emoji: '🇲🇽', title: 'Mexico', templateId: 'country-spread', foils: ['1'], type: 'team',
    });
    expect(t.sections[0].numbers).toHaveLength(20);
  });
});

describe('templates', () => {
  it('blankTemplate is one empty page at standard geometry', () => {
    const t = blankTemplate('x');
    expect(t.id).toBe('x');
    expect(t.pages).toEqual([{ slots: [] }]);
  });
  it('newTemplate / cloneTemplate / deleteTemplate handle collisions', () => {
    let t = newTemplate(T(), 'a');
    expect(Object.keys(t.templates)).toEqual(['a']);
    t = newTemplate(t, 'a'); // collide
    expect(Object.keys(t.templates)).toEqual(['a', 'a-2']);
    t = cloneTemplate(t, 'a', 'a'); // collide -> a-3
    expect(Object.keys(t.templates)).toEqual(['a', 'a-2', 'a-3']);
    expect(t.templates['a-3'].id).toBe('a-3');
    t = deleteTemplate(t, 'a-2');
    expect(Object.keys(t.templates)).toEqual(['a', 'a-3']);
  });
  it('copyTemplateToType duplicates across types with a non-colliding id', () => {
    const from = newTemplate(newAlbumType('from', 'From'), 'shared');
    const to = newTemplate(newAlbumType('to', 'To'), 'shared'); // target already has 'shared'
    const reg = { from, to };
    const { types, newId } = copyTemplateToType(reg, 'from', 'shared', 'to');
    expect(newId).toBe('shared-2');
    expect(Object.keys(types.to.templates)).toEqual(['shared', 'shared-2']);
    expect(types.to.templates['shared-2']).not.toBe(types.from.templates['shared']); // independent copy
    expect(types.from).toBe(reg.from); // source type untouched
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test -- src/admin/registryOps.test.ts`
Expected: FAIL — module `./registryOps` not found.

- [ ] **Step 3: Implement the ops module**

Create `src/admin/registryOps.ts`:

```ts
import type { AlbumType, AlbumVariant, SectionDef } from '../data/albumTypes';
import type { PageType } from '../types';
import type { SectionTemplate } from '../data/layoutGeometry';
import { STANDARD_PAGE_ASPECT, STANDARD_STICKER_WIDTH_PCT } from '../data/layoutGeometry';

/** The dev-only editor's working copy: the whole registry + which type is active. */
export interface RegistryDraft {
  activeId: string;
  types: Record<string, AlbumType>;
}

/** Deep clone via JSON — every value here is plain data. */
const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v)) as T;

/** Split a comma-separated label list into trimmed, non-empty tokens. */
export function parseNumbers(input: string): string[] {
  return input.split(',').map((s) => s.trim()).filter((s) => s.length > 0);
}

/** ['1','2',…,'N'] — the "fill 1..N" helper. */
export function fillNumbers(n: number): string[] {
  return Array.from({ length: Math.max(0, Math.floor(n)) }, (_, i) => String(i + 1));
}

/** Parse pasted "code, emoji, title" lines into section seeds (blank lines skipped). */
export function parseBulkLines(input: string): { code: string; emoji: string; title: string }[] {
  return input
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((line) => {
      const [code = '', emoji = '', ...rest] = line.split(',').map((s) => s.trim());
      return { code, emoji, title: rest.join(', ') };
    });
}

/** A non-colliding id: `base`, else `base-2`, `base-3`, … */
export function uniqueId(base: string, taken: string[]): string {
  const seed = base.trim() || 'item';
  if (!taken.includes(seed)) return seed;
  for (let i = 2; ; i++) {
    const candidate = `${seed}-${i}`;
    if (!taken.includes(candidate)) return candidate;
  }
}

/** An empty single-page template at the standard album geometry. */
export function blankTemplate(id: string): SectionTemplate {
  return {
    id,
    pageAspect: STANDARD_PAGE_ASPECT,
    stickerWidthPct: STANDARD_STICKER_WIDTH_PCT,
    pages: [{ slots: [] }],
  };
}

/** A fresh album type with one default variant and no sections/templates. */
export function newAlbumType(id: string, name: string): AlbumType {
  return {
    id,
    name: name.trim() || id,
    variants: [{ id: 'base', label: 'Base' }],
    defaultVariant: 'base',
    sections: [],
    templates: {},
  };
}

// --- variants -------------------------------------------------------------

export function addVariant(type: AlbumType, variant: AlbumVariant): AlbumType {
  const id = uniqueId(variant.id, type.variants.map((v) => v.id));
  return { ...type, variants: [...type.variants, { ...variant, id }] };
}

export function updateVariant(type: AlbumType, id: string, patch: Partial<AlbumVariant>): AlbumType {
  return {
    ...type,
    variants: type.variants.map((v) => (v.id === id ? { ...v, ...patch, id: v.id } : v)),
  };
}

export function removeVariant(type: AlbumType, id: string): AlbumType {
  if (type.variants.length <= 1) return type; // never drop the last variant
  const variants = type.variants.filter((v) => v.id !== id);
  const defaultVariant = type.defaultVariant === id ? variants[0].id : type.defaultVariant;
  // Drop any per-variant number overrides keyed by the removed variant.
  const sections = type.sections.map((s) => {
    if (!s.numbersByVariant || !(id in s.numbersByVariant)) return s;
    const rest = { ...s.numbersByVariant };
    delete rest[id];
    return { ...s, numbersByVariant: rest };
  });
  return { ...type, variants, defaultVariant, sections };
}

export function setDefaultVariant(type: AlbumType, id: string): AlbumType {
  if (!type.variants.some((v) => v.id === id)) return type;
  return { ...type, defaultVariant: id };
}

// --- sections -------------------------------------------------------------

export function addSection(type: AlbumType): AlbumType {
  const id = uniqueId('section', type.sections.map((s) => s.id));
  const templateId = Object.keys(type.templates)[0] ?? '';
  const section: SectionDef = {
    id, code: '', emoji: '', title: 'New section', type: 'extra',
    templateId, numbers: [], foils: [],
  };
  return { ...type, sections: [...type.sections, section] };
}

export function updateSection(type: AlbumType, sectionId: string, patch: Partial<SectionDef>): AlbumType {
  return {
    ...type,
    sections: type.sections.map((s) => (s.id === sectionId ? { ...s, ...patch, id: s.id } : s)),
  };
}

export function deleteSection(type: AlbumType, sectionId: string): AlbumType {
  return { ...type, sections: type.sections.filter((s) => s.id !== sectionId) };
}

/** Move the section at `from` to index `to` (clamped); array order = album order. */
export function moveSection(type: AlbumType, from: number, to: number): AlbumType {
  if (from < 0 || from >= type.sections.length) return type;
  const sections = [...type.sections];
  const target = Math.max(0, Math.min(sections.length - 1, to));
  const [moved] = sections.splice(from, 1);
  sections.splice(target, 0, moved);
  return { ...type, sections };
}

/** Append one section per pasted line, all sharing a template + numbers/foils. */
export function bulkAddSections(
  type: AlbumType,
  lines: { code: string; emoji: string; title: string }[],
  opts: { templateId: string; numbers: string[]; foils: string[]; type: PageType },
): AlbumType {
  const taken = type.sections.map((s) => s.id);
  const sections = [...type.sections];
  for (const line of lines) {
    const id = uniqueId(line.code || 'section', taken);
    taken.push(id);
    sections.push({
      id, code: line.code, emoji: line.emoji, title: line.title, type: opts.type,
      templateId: opts.templateId, numbers: [...opts.numbers], foils: [...opts.foils],
    });
  }
  return { ...type, sections };
}

// --- templates ------------------------------------------------------------

export function newTemplate(type: AlbumType, id: string): AlbumType {
  const finalId = uniqueId(id, Object.keys(type.templates));
  return { ...type, templates: { ...type.templates, [finalId]: blankTemplate(finalId) } };
}

export function cloneTemplate(type: AlbumType, sourceId: string, newId: string): AlbumType {
  const source = type.templates[sourceId];
  if (!source) return type;
  const finalId = uniqueId(newId || `${sourceId}-copy`, Object.keys(type.templates));
  return { ...type, templates: { ...type.templates, [finalId]: { ...clone(source), id: finalId } } };
}

export function deleteTemplate(type: AlbumType, templateId: string): AlbumType {
  const templates = { ...type.templates };
  delete templates[templateId];
  return { ...type, templates };
}

/**
 * Copy a template from one album type into another as an independent duplicate
 * (id auto-renamed on collision). Returns the new registry + the id used.
 */
export function copyTemplateToType(
  types: Record<string, AlbumType>,
  fromTypeId: string,
  templateId: string,
  toTypeId: string,
): { types: Record<string, AlbumType>; newId: string } {
  const source = types[fromTypeId]?.templates[templateId];
  const target = types[toTypeId];
  if (!source || !target) return { types, newId: '' };
  const newId = uniqueId(templateId, Object.keys(target.templates));
  return {
    types: {
      ...types,
      [toTypeId]: {
        ...target,
        templates: { ...target.templates, [newId]: { ...clone(source), id: newId } },
      },
    },
    newId,
  };
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test -- src/admin/registryOps.test.ts`
Expected: PASS (all describes).

- [ ] **Step 5: Build + full suite**

Run: `npm run build && npm test`
Expected: PASS — `tsc` clean, all tests green.

- [ ] **Step 6: Commit**

```bash
git add src/admin/registryOps.ts src/admin/registryOps.test.ts
git commit -m "feat(admin): pure registry-ops module (variants, sections, templates, copy)"
```

---

## Task 3: Shared UI helpers + extracted `TemplateCanvas`

Extract today's slot-editing canvas into a reusable, props-driven component so the orchestrator can point it at any template. This is the regression-sensitive piece — the canvas behaviour (drag to move, tap to flip, ✕ to remove, +sticker/+photo/±page, size/aspect sliders, unplaced warning) must match today's editor exactly.

**Files:**
- Create: `src/admin/builder/ui.ts`
- Create: `src/admin/builder/TemplateCanvas.tsx`

**Interfaces:**
- Consumes: `slotBox`, `bindTemplate`, `clientToPagePercent`, `SectionTemplate`, `TemplateSlot` from `../../data/layoutGeometry`.
- Produces (used by Tasks 4–5):
  - `BTN: CSSProperties`, `BTN_SM: CSSProperties`, `clone<T>(v: T): T` (from `ui.ts`)
  - `TemplateCanvas` default export with props:
    `interface TemplateCanvasProps { template: SectionTemplate; numbers: string[]; onChange: (mut: (t: SectionTemplate) => void) => void }`
    — `numbers` are the sticker numbers in bind order (slot labels); `onChange(mut)` applies `mut` to the live template (the parent clones + persists).

- [ ] **Step 1: Create `src/admin/builder/ui.ts`**

```ts
import type { CSSProperties } from 'react';

// Readable buttons on the editor's dark background (the app's global button CSS
// renders plain buttons as near-invisible light-on-light).
export const BTN: CSSProperties = {
  background: '#223047', color: '#e7ecf3', border: '1px solid #3a4a60',
  borderRadius: 6, padding: '5px 10px', fontSize: 13, fontWeight: 600,
  cursor: 'pointer', whiteSpace: 'nowrap',
};
export const BTN_SM: CSSProperties = { ...BTN, padding: '3px 7px', fontSize: 11 };

/** Deep clone via JSON — editor data is plain. */
export const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v)) as T;
```

- [ ] **Step 2: Create `src/admin/builder/TemplateCanvas.tsx`**

```tsx
import { useRef } from 'react';
import type { CSSProperties, PointerEvent as ReactPointerEvent } from 'react';
import {
  slotBox, bindTemplate, clientToPagePercent,
  type SectionTemplate, type TemplateSlot,
} from '../../data/layoutGeometry';
import { BTN, BTN_SM } from './ui';

interface TemplateCanvasProps {
  template: SectionTemplate;
  /** Sticker numbers in bind order — shown as the label on each real slot. */
  numbers: string[];
  /** Apply a mutation to the live template (the parent clones + persists). */
  onChange: (mut: (t: SectionTemplate) => void) => void;
}

export default function TemplateCanvas({ template, numbers, onChange }: TemplateCanvasProps) {
  const bound = bindTemplate(template, numbers);
  const pageRefs = useRef<(HTMLDivElement | null)[]>([]);
  const drag = useRef<{ pageIdx: number; slotIdx: number; moved: boolean } | null>(null);

  const onSlotPointerDown =
    (pageIdx: number, slotIdx: number) => (e: ReactPointerEvent) => {
      e.preventDefault();
      (e.target as Element).setPointerCapture?.(e.pointerId);
      drag.current = { pageIdx, slotIdx, moved: false };
    };

  const onSlotPointerMove = (e: ReactPointerEvent) => {
    const d = drag.current;
    if (!d) return;
    const el = pageRefs.current[d.pageIdx];
    if (!el) return;
    const { x, y } = clientToPagePercent(e.clientX, e.clientY, el.getBoundingClientRect());
    d.moved = true;
    onChange((t) => {
      const slot = t.pages[d.pageIdx].slots[d.slotIdx];
      slot.x = Math.round(x * 10) / 10;
      slot.y = Math.round(y * 10) / 10;
    });
  };

  const onSlotPointerUp = (pageIdx: number, slotIdx: number) => () => {
    const d = drag.current;
    drag.current = null;
    if (d && !d.moved) {
      // A tap (no drag) flips orientation.
      onChange((t) => {
        const slot = t.pages[pageIdx].slots[slotIdx];
        slot.orientation = slot.orientation === 'portrait' ? 'landscape' : 'portrait';
      });
    }
  };

  const removeSlot = (pageIdx: number, slotIdx: number) =>
    onChange((t) => { t.pages[pageIdx].slots.splice(slotIdx, 1); });

  const addSlot = (pageIdx: number, decorative: boolean) =>
    onChange((t) => {
      t.pages[pageIdx].slots.push({
        x: 50, y: 50, orientation: decorative ? 'landscape' : 'portrait',
        ...(decorative ? { decorative: true } : {}),
      });
    });

  const addPage = () => onChange((t) => { t.pages.push({ slots: [] }); });
  const removePage = (pageIdx: number) =>
    onChange((t) => { if (t.pages.length > 1) t.pages.splice(pageIdx, 1); });
  const setWidth = (v: number) => onChange((t) => { t.stickerWidthPct = v; });
  const setAspect = (v: number) => onChange((t) => { t.pageAspect = v; });

  const labels = (pageIdx: number): string[] =>
    bound.pages[pageIdx].placements.map((pl) =>
      pl.slot.decorative ? '—' : (pl.stickerId ?? '·'),
    );

  const slotStyle = (slot: TemplateSlot): CSSProperties => {
    const b = slotBox(slot, template);
    return {
      position: 'absolute',
      left: `${b.leftPct}%`, top: `${b.topPct}%`,
      width: `${b.widthPct}%`, height: `${b.heightPct}%`,
      transform: 'translate(-50%, -50%)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      border: '1px solid #6aa9ff', borderRadius: 6,
      background: slot.decorative ? 'rgba(255,255,255,0.06)' : 'rgba(106,169,255,0.18)',
      borderStyle: slot.decorative ? 'dashed' : 'solid',
      color: '#cfe0ff', fontWeight: 800, fontSize: 12,
      cursor: 'grab', touchAction: 'none', userSelect: 'none',
    };
  };

  return (
    <div>
      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', alignItems: 'center', marginBottom: 12, fontSize: 13 }}>
        <label>
          Sticker size: {template.stickerWidthPct.toFixed(1)}%{' '}
          <input type="range" min={10} max={40} step={0.25}
            value={template.stickerWidthPct} onChange={(e) => setWidth(Number(e.target.value))} />
        </label>
        <label>
          Page aspect: {template.pageAspect.toFixed(3)}{' '}
          <input type="range" min={0.6} max={1.4} step={0.001}
            value={template.pageAspect} onChange={(e) => setAspect(Number(e.target.value))} />
        </label>
        <button style={BTN} onClick={addPage}>+ page</button>
        {bound.unplaced.length > 0 && (
          <span style={{ color: '#f0b450' }}>
            {bound.unplaced.length} sticker(s) unplaced — add slots to place them
          </span>
        )}
      </div>

      <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start', flexWrap: 'wrap' }}>
        {template.pages.map((p, pageIdx) => (
          <div key={pageIdx} style={{ flex: '1 1 0', maxWidth: 320, display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div ref={(el) => (pageRefs.current[pageIdx] = el)}
              style={{ position: 'relative', width: '100%', aspectRatio: String(template.pageAspect),
                background: '#11161d', border: '1px solid #2a3340', borderRadius: 8 }}>
              {p.slots.map((slot, slotIdx) => (
                <div key={slotIdx} style={slotStyle(slot)}
                  onPointerDown={onSlotPointerDown(pageIdx, slotIdx)}
                  onPointerMove={onSlotPointerMove}
                  onPointerUp={onSlotPointerUp(pageIdx, slotIdx)}>
                  {labels(pageIdx)[slotIdx]}
                  <button onPointerDown={(e) => e.stopPropagation()}
                    onClick={(e) => { e.stopPropagation(); removeSlot(pageIdx, slotIdx); }}
                    style={{ position: 'absolute', top: -8, right: -8, width: 18, height: 18, borderRadius: 9,
                      border: 'none', background: '#c0392b', color: '#fff', fontSize: 11, lineHeight: '18px',
                      padding: 0, cursor: 'pointer' }}
                    aria-label="Remove slot">✕</button>
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 4, justifyContent: 'center' }}>
              <button style={BTN_SM} onClick={() => addSlot(pageIdx, false)}>+ sticker</button>
              <button style={BTN_SM} onClick={() => addSlot(pageIdx, true)}>+ photo</button>
              <button style={BTN_SM} onClick={() => removePage(pageIdx)}>✕ page</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Build (these files are not yet mounted)**

Run: `npm run build`
Expected: PASS — `tsc` typechecks both new files (no unused imports/params); `vite build` succeeds. The components are not imported anywhere yet, so the bundle is unchanged.

- [ ] **Step 4: Commit**

```bash
git add src/admin/builder/ui.ts src/admin/builder/TemplateCanvas.tsx
git commit -m "feat(admin): shared editor UI helpers + extracted TemplateCanvas"
```

---

## Task 4: Form components — `AlbumTypeBar`, `SectionsPanel`, `SectionFields`

The three form components, each a thin shell over the Task 2 ops. They are not mounted yet; the build gate confirms they typecheck against their props and the ops. All type-level edits flow through a single `onUpdateType(mut)` channel the orchestrator (Task 5) provides.

**Files:**
- Create: `src/admin/builder/AlbumTypeBar.tsx`
- Create: `src/admin/builder/SectionsPanel.tsx`
- Create: `src/admin/builder/SectionFields.tsx`

**Interfaces:**
- Consumes: ops from `../registryOps`; `AlbumType`, `SectionDef` from `../../data/albumTypes`; `PageType` from `../../types`; `realSlotCount` from `../../data/layoutGeometry`; `BTN`/`BTN_SM` from `./ui`.
- Produces (used by Task 5) — three default exports with these props:
  - `AlbumTypeBarProps { types: Record<string, AlbumType>; editingTypeId: string; previewVariant: string; onSelectType: (id: string) => void; onNewType: (id: string, name: string) => void; onPreviewVariant: (variantId: string) => void; onUpdateType: (mut: (t: AlbumType) => AlbumType) => void; onExport: () => void; onResetAll: () => void; onResetType: () => void }`
  - `SectionsPanelProps { type: AlbumType; selectedSectionId: string; onSelectSection: (id: string) => void; onUpdateType: (mut: (t: AlbumType) => AlbumType) => void }`
  - `SectionFieldsProps { type: AlbumType; section: SectionDef; onUpdateType: (mut: (t: AlbumType) => AlbumType) => void }`

- [ ] **Step 1: Create `src/admin/builder/AlbumTypeBar.tsx`**

```tsx
import { useState } from 'react';
import type { AlbumType } from '../../data/albumTypes';
import { addVariant, updateVariant, removeVariant, setDefaultVariant } from '../registryOps';
import { BTN, BTN_SM } from './ui';

interface AlbumTypeBarProps {
  types: Record<string, AlbumType>;
  editingTypeId: string;
  previewVariant: string;
  onSelectType: (id: string) => void;
  onNewType: (id: string, name: string) => void;
  onPreviewVariant: (variantId: string) => void;
  onUpdateType: (mut: (t: AlbumType) => AlbumType) => void;
  onExport: () => void;
  onResetAll: () => void;
  onResetType: () => void;
}

export default function AlbumTypeBar({
  types, editingTypeId, previewVariant, onSelectType, onNewType,
  onPreviewVariant, onUpdateType, onExport, onResetAll, onResetType,
}: AlbumTypeBarProps) {
  const type = types[editingTypeId];
  const [newId, setNewId] = useState('');
  const [newName, setNewName] = useState('');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 14 }}>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
        <label>
          Album type:{' '}
          <select value={editingTypeId} onChange={(e) => onSelectType(e.target.value)}>
            {Object.values(types).map((t) => (
              <option key={t.id} value={t.id}>{t.name} ({t.id})</option>
            ))}
          </select>
        </label>
        <input placeholder="new-id" value={newId} onChange={(e) => setNewId(e.target.value)} style={{ width: 110 }} />
        <input placeholder="New name" value={newName} onChange={(e) => setNewName(e.target.value)} style={{ width: 140 }} />
        <button style={BTN} onClick={() => {
          if (!newId.trim()) return;
          onNewType(newId.trim(), newName);
          setNewId(''); setNewName('');
        }}>+ album type</button>
        <button style={BTN} onClick={onExport}>Export registry</button>
        <button style={BTN} onClick={onResetType}>Reset this type</button>
        <button style={BTN} onClick={onResetAll}>Reset all</button>
      </div>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <strong style={{ fontSize: 13 }}>Variants:</strong>
        {type.variants.map((v) => (
          <span key={v.id} style={{ display: 'inline-flex', gap: 4, alignItems: 'center',
            border: '1px solid #3a4a60', borderRadius: 6, padding: '2px 6px' }}>
            <input value={v.label} aria-label={`${v.id} label`} style={{ width: 90 }}
              onChange={(e) => onUpdateType((t) => updateVariant(t, v.id, { label: e.target.value }))} />
            <input value={v.region ?? ''} placeholder="region" aria-label={`${v.id} region`} style={{ width: 90 }}
              onChange={(e) => onUpdateType((t) => updateVariant(t, v.id, { region: e.target.value }))} />
            <label style={{ fontSize: 11 }}>
              <input type="radio" name="defaultVariant" checked={type.defaultVariant === v.id}
                onChange={() => onUpdateType((t) => setDefaultVariant(t, v.id))} /> default
            </label>
            <button style={BTN_SM} onClick={() => onUpdateType((t) => removeVariant(t, v.id))}>✕</button>
          </span>
        ))}
        <button style={BTN_SM}
          onClick={() => onUpdateType((t) => addVariant(t, { id: `v${t.variants.length + 1}`, label: 'Variant' }))}>
          + variant
        </button>
        <label style={{ marginLeft: 8 }}>
          Preview as:{' '}
          <select value={previewVariant} onChange={(e) => onPreviewVariant(e.target.value)}>
            {type.variants.map((v) => (<option key={v.id} value={v.id}>{v.label}</option>))}
          </select>
        </label>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create `src/admin/builder/SectionsPanel.tsx`**

```tsx
import { useState } from 'react';
import type { AlbumType } from '../../data/albumTypes';
import type { PageType } from '../../types';
import {
  addSection, deleteSection, moveSection, bulkAddSections,
  parseBulkLines, parseNumbers, fillNumbers,
} from '../registryOps';
import { BTN, BTN_SM } from './ui';

interface SectionsPanelProps {
  type: AlbumType;
  selectedSectionId: string;
  onSelectSection: (id: string) => void;
  onUpdateType: (mut: (t: AlbumType) => AlbumType) => void;
}

export default function SectionsPanel({ type, selectedSectionId, onSelectSection, onUpdateType }: SectionsPanelProps) {
  const [showBulk, setShowBulk] = useState(false);
  const [bulkText, setBulkText] = useState('');
  const [bulkTemplate, setBulkTemplate] = useState('');
  const [bulkNumbers, setBulkNumbers] = useState('');
  const [bulkFoils, setBulkFoils] = useState('');
  const [bulkType, setBulkType] = useState<PageType>('team');
  const templateIds = Object.keys(type.templates);

  return (
    <div style={{ minWidth: 250 }}>
      <div style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
        <button style={BTN_SM} onClick={() => onUpdateType(addSection)}>+ section</button>
        <button style={BTN_SM} onClick={() => setShowBulk((s) => !s)}>Bulk-add…</button>
      </div>

      {showBulk && (
        <div style={{ border: '1px solid #3a4a60', borderRadius: 6, padding: 8, marginBottom: 8, fontSize: 12 }}>
          <textarea value={bulkText} onChange={(e) => setBulkText(e.target.value)} rows={4}
            placeholder={'MEX, 🇲🇽, Mexico\nUSA, 🇺🇸, United States'} style={{ width: '100%', boxSizing: 'border-box' }} />
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 6, alignItems: 'center' }}>
            <select value={bulkTemplate} onChange={(e) => setBulkTemplate(e.target.value)}>
              <option value="">(no template)</option>
              {templateIds.map((id) => (<option key={id} value={id}>{id}</option>))}
            </select>
            <select value={bulkType} onChange={(e) => setBulkType(e.target.value as PageType)}>
              <option value="team">team</option>
              <option value="intro">intro</option>
              <option value="extra">extra</option>
            </select>
            <input placeholder="numbers e.g. 1,2,3" value={bulkNumbers}
              onChange={(e) => setBulkNumbers(e.target.value)} style={{ width: 120 }} />
            <button style={BTN_SM} onClick={() => setBulkNumbers(fillNumbers(20).join(','))}>fill 1..20</button>
            <input placeholder="foils e.g. 1" value={bulkFoils}
              onChange={(e) => setBulkFoils(e.target.value)} style={{ width: 90 }} />
            <button style={BTN} onClick={() => {
              onUpdateType((t) => bulkAddSections(t, parseBulkLines(bulkText), {
                templateId: bulkTemplate, numbers: parseNumbers(bulkNumbers),
                foils: parseNumbers(bulkFoils), type: bulkType,
              }));
              setBulkText('');
            }}>Add sections</button>
          </div>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {type.sections.map((s, i) => (
          <div key={s.id} onClick={() => onSelectSection(s.id)}
            style={{ display: 'flex', gap: 6, alignItems: 'center', padding: '3px 6px', borderRadius: 4, cursor: 'pointer',
              background: s.id === selectedSectionId ? '#223047' : 'transparent', fontSize: 13 }}>
            <span style={{ width: 20 }}>{s.emoji}</span>
            <span style={{ width: 44, fontWeight: 700 }}>{s.code}</span>
            <span style={{ flex: 1 }}>{s.title}</span>
            <span style={{ opacity: 0.6 }}>{s.numbers.length}</span>
            <span style={{ opacity: 0.5, fontSize: 11 }}>{s.templateId || '—'}</span>
            <button style={BTN_SM} onClick={(e) => { e.stopPropagation(); onUpdateType((t) => moveSection(t, i, i - 1)); }}>↑</button>
            <button style={BTN_SM} onClick={(e) => { e.stopPropagation(); onUpdateType((t) => moveSection(t, i, i + 1)); }}>↓</button>
            <button style={BTN_SM} onClick={(e) => { e.stopPropagation(); onUpdateType((t) => deleteSection(t, s.id)); }}>✕</button>
          </div>
        ))}
        {type.sections.length === 0 && <p style={{ opacity: 0.6, fontSize: 13 }}>No sections yet.</p>}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Create `src/admin/builder/SectionFields.tsx`**

```tsx
import type { CSSProperties } from 'react';
import type { AlbumType, SectionDef } from '../../data/albumTypes';
import type { PageType } from '../../types';
import { realSlotCount } from '../../data/layoutGeometry';
import { updateSection, parseNumbers, fillNumbers } from '../registryOps';
import { BTN_SM } from './ui';

interface SectionFieldsProps {
  type: AlbumType;
  section: SectionDef;
  onUpdateType: (mut: (t: AlbumType) => AlbumType) => void;
}

const row: CSSProperties = { display: 'flex', gap: 8, alignItems: 'center', marginBottom: 6, fontSize: 13 };

export default function SectionFields({ type, section, onUpdateType }: SectionFieldsProps) {
  const patch = (p: Partial<SectionDef>) => onUpdateType((t) => updateSection(t, section.id, p));
  const tpl = type.templates[section.templateId];
  const slots = tpl ? realSlotCount(tpl) : 0;
  const mismatch = tpl ? slots !== section.numbers.length : false;

  return (
    <div style={{ minWidth: 290 }}>
      <div style={row}>
        <label>Code <input value={section.code} onChange={(e) => patch({ code: e.target.value })} style={{ width: 70 }} /></label>
        <label>Emoji <input value={section.emoji} onChange={(e) => patch({ emoji: e.target.value })} style={{ width: 56 }} /></label>
      </div>
      <div style={row}>
        <label style={{ flex: 1 }}>Title{' '}
          <input value={section.title} onChange={(e) => patch({ title: e.target.value })} style={{ width: '70%' }} /></label>
      </div>
      <div style={row}>
        <label>Type{' '}
          <select value={section.type} onChange={(e) => patch({ type: e.target.value as PageType })}>
            <option value="team">team</option>
            <option value="intro">intro</option>
            <option value="extra">extra</option>
          </select>
        </label>
        <label>Template{' '}
          <select value={section.templateId} onChange={(e) => patch({ templateId: e.target.value })}>
            <option value="">(none)</option>
            {Object.keys(type.templates).map((id) => (<option key={id} value={id}>{id}</option>))}
          </select>
        </label>
      </div>
      <div style={row}>
        <label style={{ flex: 1 }}>Numbers{' '}
          <input value={section.numbers.join(',')} onChange={(e) => patch({ numbers: parseNumbers(e.target.value) })}
            style={{ width: '60%' }} /></label>
        <button style={BTN_SM} onClick={() => {
          const n = Number(prompt('Fill 1..N — enter N', '20'));
          if (n > 0) patch({ numbers: fillNumbers(n) });
        }}>fill 1..N</button>
      </div>
      <div style={row}>
        <label style={{ flex: 1 }}>Foils{' '}
          <input value={section.foils.join(',')} onChange={(e) => patch({ foils: parseNumbers(e.target.value) })}
            style={{ width: '60%' }} /></label>
      </div>
      <div style={row}>
        <label>
          <input type="checkbox" checked={!!section.optional}
            onChange={(e) => patch({ optional: e.target.checked || undefined })} />{' '}
          Optional (opt-in section, like Coca-Cola)
        </label>
      </div>

      {type.variants.length > 1 && (
        <div style={{ borderTop: '1px solid #2a3340', paddingTop: 6, marginTop: 6 }}>
          <strong style={{ fontSize: 12 }}>Per-variant numbers (blank = use base)</strong>
          {type.variants.map((v) => (
            <div key={v.id} style={row}>
              <label style={{ flex: 1 }}>{v.label}{' '}
                <input placeholder="(base)" style={{ width: '60%' }}
                  value={(section.numbersByVariant?.[v.id] ?? []).join(',')}
                  onChange={(e) => {
                    const tokens = parseNumbers(e.target.value);
                    const next = { ...(section.numbersByVariant ?? {}) };
                    if (tokens.length === 0) delete next[v.id]; else next[v.id] = tokens;
                    patch({ numbersByVariant: Object.keys(next).length ? next : undefined });
                  }} />
              </label>
            </div>
          ))}
        </div>
      )}

      {mismatch && (
        <p style={{ color: '#f0b450', fontSize: 12 }}>
          ⚠ {section.numbers.length} numbers vs {slots} real slots in “{section.templateId}”. They should match.
        </p>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Build (still not mounted)**

Run: `npm run build`
Expected: PASS — `tsc` typechecks the three components against the ops + props (no unused imports/params); `vite build` succeeds. Bundle still unchanged (nothing imports them yet).

- [ ] **Step 5: Commit**

```bash
git add src/admin/builder/AlbumTypeBar.tsx src/admin/builder/SectionsPanel.tsx src/admin/builder/SectionFields.tsx
git commit -m "feat(admin): album-type bar, sections panel, and section-fields form"
```

---

## Task 5: Orchestrator — rewrite `TemplateEditor.tsx` and wire it up

Compose the components into the live builder: hold the `RegistryDraft`, autosave it, route every edit through the pure ops, and host the template toolbar (new/clone/delete/reset/copy-to-type) + canvas. This is where the whole feature becomes usable and is manually verified.

**Files:**
- Modify: `src/admin/TemplateEditor.tsx` (full rewrite; only `src/main.tsx` imports it, via the dev-only dynamic import — unchanged)

**Interfaces:**
- Consumes: `ALBUM_TYPES`, `ACTIVE_ALBUM_TYPE_ID`, `AlbumType`, `SectionDef` from `../data/albumTypes`; `SectionTemplate` from `../data/layoutGeometry`; `RegistryDraft` + `newAlbumType`/`newTemplate`/`cloneTemplate`/`deleteTemplate`/`copyTemplateToType` from `./registryOps`; `albumTypesToSource` from `./serializeTemplates`; `BTN_SM`/`clone` from `./builder/ui`; the four builder components.

- [ ] **Step 1: Replace the entire contents of `src/admin/TemplateEditor.tsx`**

```tsx
import { useState } from 'react';
import {
  ALBUM_TYPES, ACTIVE_ALBUM_TYPE_ID,
  type AlbumType, type SectionDef,
} from '../data/albumTypes';
import type { SectionTemplate } from '../data/layoutGeometry';
import {
  newAlbumType, newTemplate, cloneTemplate, deleteTemplate, copyTemplateToType,
  type RegistryDraft,
} from './registryOps';
import { albumTypesToSource } from './serializeTemplates';
import { BTN_SM, clone } from './builder/ui';
import AlbumTypeBar from './builder/AlbumTypeBar';
import SectionsPanel from './builder/SectionsPanel';
import SectionFields from './builder/SectionFields';
import TemplateCanvas from './builder/TemplateCanvas';

const DRAFT_KEY = 'figuritas-albumtypes-draft-v1';

const seed = (): RegistryDraft => ({ activeId: ACTIVE_ALBUM_TYPE_ID, types: clone(ALBUM_TYPES) });

/** Load the saved draft, falling back to the code seed if missing/corrupt. */
function loadDraft(): RegistryDraft {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    if (raw) {
      const d = JSON.parse(raw) as RegistryDraft;
      if (d && d.types && d.activeId && d.types[d.activeId]) return d;
    }
  } catch {
    /* ignore corrupt draft */
  }
  return seed();
}

const numbersFor = (s: SectionDef, variant: string): string[] =>
  s.numbersByVariant?.[variant] ?? s.numbers;

export default function TemplateEditor() {
  const [draft, setDraft] = useState<RegistryDraft>(loadDraft);
  const [editingTypeId, setEditingTypeId] = useState<string>(() => loadDraft().activeId);
  const [previewVariantId, setPreviewVariantId] = useState<string>('');
  const [selectedSectionId, setSelectedSectionId] = useState<string>('');

  const type: AlbumType = draft.types[editingTypeId] ?? Object.values(draft.types)[0];
  // Keep preview/selection valid even after deletes or a stale saved draft.
  const previewVariant = type.variants.some((v) => v.id === previewVariantId)
    ? previewVariantId
    : type.defaultVariant;
  const section = type.sections.find((s) => s.id === selectedSectionId);
  const template: SectionTemplate | undefined = section ? type.templates[section.templateId] : undefined;
  const previewNumbers = section ? numbersFor(section, previewVariant) : [];
  const otherTypeIds = Object.keys(draft.types).filter((id) => id !== editingTypeId);

  const commit = (next: RegistryDraft) => {
    setDraft(next);
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify(next));
    } catch {
      /* ignore quota errors */
    }
  };

  const updateType = (mut: (t: AlbumType) => AlbumType) =>
    commit({ ...draft, types: { ...draft.types, [editingTypeId]: mut(type) } });

  const focusType = (t: AlbumType) => {
    setEditingTypeId(t.id);
    setPreviewVariantId(t.defaultVariant);
    setSelectedSectionId(t.sections[0]?.id ?? '');
  };

  const selectType = (id: string) => focusType(draft.types[id]);

  const addType = (id: string, name: string) => {
    const t = newAlbumType(id, name);
    commit({ ...draft, types: { ...draft.types, [t.id]: t } });
    focusType(t);
  };

  const resetAll = () => {
    const s = seed();
    commit(s);
    focusType(s.types[s.activeId]);
  };

  const resetType = () => {
    if (!ALBUM_TYPES[editingTypeId]) return; // only code-seeded types can be reset
    updateType(() => clone(ALBUM_TYPES[editingTypeId]));
  };

  const resetTemplate = () => {
    if (!section) return;
    const seedTpl = ALBUM_TYPES[editingTypeId]?.templates[section.templateId];
    if (!seedTpl) return;
    updateType((t) => ({ ...t, templates: { ...t.templates, [section.templateId]: clone(seedTpl) } }));
  };

  const onCanvasChange = (mut: (t: SectionTemplate) => void) => {
    if (!section || !template) return;
    updateType((t) => {
      const next = clone(t);
      mut(next.templates[section.templateId]);
      return next;
    });
  };

  const exportRegistry = async () => {
    const src = albumTypesToSource(draft.types, draft.activeId);
    try {
      await navigator.clipboard.writeText(src);
    } catch {
      /* clipboard may be blocked; the download below still works */
    }
    const blob = new Blob([src], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'albumTypes.generated.ts';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div style={{ padding: 16, color: '#e7ecf3', fontFamily: 'system-ui, sans-serif' }}>
      <h2 style={{ marginTop: 0 }}>Album-type builder (dev only)</h2>

      <AlbumTypeBar
        types={draft.types} editingTypeId={editingTypeId} previewVariant={previewVariant}
        onSelectType={selectType} onNewType={addType} onPreviewVariant={setPreviewVariantId}
        onUpdateType={updateType} onExport={exportRegistry} onResetAll={resetAll} onResetType={resetType} />

      <p style={{ opacity: 0.7, fontSize: 13, maxWidth: 720 }}>
        Pick or create an album type, edit its sections, and drag slots on the canvas to position
        each section's template. Editing autosaves to this browser; “Export registry” writes the
        whole <code>ALBUM_TYPES</code> literal to paste into <code>src/data/albumTypes.ts</code>.
      </p>

      <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start', flexWrap: 'wrap' }}>
        <SectionsPanel type={type} selectedSectionId={selectedSectionId}
          onSelectSection={setSelectedSectionId} onUpdateType={updateType} />

        {section ? (
          <SectionFields type={type} section={section} onUpdateType={updateType} />
        ) : (
          <p style={{ opacity: 0.6 }}>Select or add a section to edit it.</p>
        )}

        <div style={{ flex: '1 1 380px' }}>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10, alignItems: 'center' }}>
            <button style={BTN_SM} onClick={() => updateType((t) => newTemplate(t, 'template'))}>+ template</button>
            {section?.templateId && (
              <>
                <button style={BTN_SM}
                  onClick={() => updateType((t) => cloneTemplate(t, section.templateId, `${section.templateId}-copy`))}>
                  Clone
                </button>
                <button style={BTN_SM} onClick={() => updateType((t) => deleteTemplate(t, section.templateId))}>
                  Delete template
                </button>
                {ALBUM_TYPES[editingTypeId]?.templates[section.templateId] && (
                  <button style={BTN_SM} onClick={resetTemplate}>Reset template</button>
                )}
                {otherTypeIds.length > 0 && (
                  <label style={{ fontSize: 12 }}>
                    Copy →{' '}
                    <select value="" onChange={(e) => {
                      const to = e.target.value;
                      if (!to) return;
                      const { types, newId } = copyTemplateToType(draft.types, editingTypeId, section.templateId, to);
                      commit({ ...draft, types });
                      alert(`Copied “${section.templateId}” to ${to} as “${newId}”.`);
                    }}>
                      <option value="">(album type)</option>
                      {otherTypeIds.map((id) => (<option key={id} value={id}>{id}</option>))}
                    </select>
                  </label>
                )}
              </>
            )}
          </div>

          {template ? (
            <TemplateCanvas template={template} numbers={previewNumbers} onChange={onCanvasChange} />
          ) : (
            <p style={{ opacity: 0.6 }}>
              {section ? 'This section has no template assigned — pick one in the dropdown or add a template.' : ''}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Build + full suite**

Run: `npm run build && npm test`
Expected: PASS — `tsc` clean (the old single-template editor code is fully replaced; no dangling imports of `album`/`TEMPLATES`/`templateFor`), all existing tests green (Tasks 1–2 added tests; no app/test files changed here).

- [ ] **Step 3: Manual verification (dev server)**

Run `npm run dev`, open `#/admin/templates`, and confirm:

1. **Loads on the active type:** the builder opens editing `2026-fwc` ("Usa Mex Can 26"); the sections list shows Specials, Ball and Countries, the 48 countries, Coca-Cola (after Tunisia), History — in order; selecting **Mexico** shows the country-spread canvas with 20 numbered slots (1 + sticker 13 landscape on page 2).
2. **Canvas parity:** drag a slot (moves), tap a slot (flips portrait↔landscape), ✕ removes a slot, +sticker/+photo add slots, +page/✕page add/remove a page, the size + aspect sliders work, and the "unplaced" warning appears when slots < stickers. Reload the page → edits persisted (autosave).
3. **Variant editor + preview:** the Variants row shows North America / Latin America with regions and a "default" radio (Latin America). Switch **Preview as → North America**: the CC section's preview numbers reflect 12 (NA) where applicable. Edit a variant label → it updates live.
4. **Sections panel:** **+ section** appends "New section"; ↑/↓ reorder; ✕ deletes; **Bulk-add…** → paste `BLU, 🐶, Bluey`-style lines, choose a template + `fill 1..20` + foils, "Add sections" appends one per line.
5. **Section fields:** select a section and edit code/emoji/title/type/numbers (`fill 1..N` prompt)/foils; toggle **Optional**; with >1 variant, the per-variant number overrides appear (blank = base). The ⚠ count-check shows when numbers ≠ the template's real-slot count.
6. **Template management:** **+ template** adds a blank template (it appears in the section's Template dropdown and on the canvas once assigned); **Clone** duplicates; **Delete template**; **Reset template** restores a code-seeded template. Create a second album type via **+ album type** (e.g. `bluey` / "Bluey"), then on a `2026-fwc` section use **Copy → bluey** and confirm an alert reports the new id and the template appears under the `bluey` type (independent copy).
7. **Export:** click **Export registry** → an `albumTypes.generated.ts` downloads and the same text is on the clipboard; it declares `export const ALBUM_TYPES` (containing `2026-fwc` and any new types) and `export const ACTIVE_ALBUM_TYPE_ID = "2026-fwc"`.
8. **Reset all** restores the seeded registry (`2026-fwc` only) and re-selects it.
9. **App unaffected:** navigate to the app root (drop the `#/admin/templates` hash) → Album/Stats/Swaps render exactly as before (this stage changed no app code).

- [ ] **Step 4: Update the spec status + commit**

Edit `docs/superpowers/specs/2026-06-18-album-types-stage1-design.md`: change the line `**Status:** Approved (pending spec review)` to `**Status:** Implemented (Stage 1A + 1B, 2026-06-18)`.

```bash
git add src/admin/TemplateEditor.tsx docs/superpowers/specs/2026-06-18-album-types-stage1-design.md
git commit -m "feat(admin): album-type builder UI — variants, sections, templates, registry Export"
```

---

## Self-Review

**1. Spec coverage** (spec §3 "Authoring UI" + §4.5 + Testing):

| Spec item | Task |
| --- | --- |
| Album-type bar: pick type / New album type (id + name) | Task 4 (`AlbumTypeBar`) + Task 5 (`addType`) |
| Variant editor (add/remove/label/region/default) | Task 2 (variant ops) + Task 4 (`AlbumTypeBar`) |
| Preview-as-variant rebuilds the preview | Task 5 (`previewVariant` → `previewNumbers` → canvas) |
| Sections panel: add / **bulk-add** (paste lines) / **drag-reorder** (↑/↓) / delete | Task 2 (`addSection`/`bulkAddSections`/`moveSection`/`deleteSection`) + Task 4 (`SectionsPanel`) |
| Section fields: code/emoji/title/type/numbers (fill 1..N)/foils/template dropdown/optional/per-variant numbers | Task 2 (`updateSection`/`fillNumbers`/`parseNumbers`) + Task 4 (`SectionFields`) |
| Count check (numbers vs real slots) | Task 4 (`SectionFields` `mismatch`) |
| Template canvas (drag/flip/✕/size/aspect/±page) edits the section's template | Task 3 (`TemplateCanvas`) + Task 5 (`onCanvasChange`) |
| Template mgmt: New / Clone / **Copy → other type** (collision rename) / Delete / Reset | Task 2 (`newTemplate`/`cloneTemplate`/`copyTemplateToType`/`deleteTemplate`) + Task 5 (toolbar) |
| Autosave whole registry to localStorage; Reset all / Reset this type | Task 5 (`commit`/`loadDraft`/`resetAll`/`resetType`) |
| **Export** whole `ALBUM_TYPES` + `ACTIVE_ALBUM_TYPE_ID` (extends `serializeTemplates`) | Task 1 (`albumTypesToSource`) + Task 5 (`exportRegistry`) |
| Export round-trip test (serialize → `JSON.parse` → deep-equal) | Task 1 test |
| Copy-template-to-type independence test | Task 2 test |
| Builder UI dev-only, manually verified | Task 5 Step 3 |

Note (out of scope, per spec "Out of scope (YAGNI)" and the roadmap): no end-user album-type selection, no store refactor (`edition`→`variant`), no setting `ACTIVE_ALBUM_TYPE_ID` from the UI (Stage 2). The deferred `as Edition` cast cleanup in `sampleAlbum.ts` is **not** required here — it lives in `src/data/`, which this dev-only stage deliberately does not touch; track it as a separate cleanup.

**2. Placeholder scan:** No "TBD"/"add error handling"/"similar to Task N". Every component and op is shown in full; the canvas is a faithful extraction of the existing editor's handlers.

**3. Type consistency:** `onUpdateType: (mut: (t: AlbumType) => AlbumType) => void` is the single type-edit channel used identically by `AlbumTypeBar`, `SectionsPanel`, `SectionFields`, and the orchestrator. `TemplateCanvas`'s `onChange: (mut: (t: SectionTemplate) => void) => void` matches `onCanvasChange`. The ops' signatures in Task 2's "Produces" block match their call sites in Tasks 4–5 (e.g. `bulkAddSections(t, lines, { templateId, numbers, foils, type })`, `copyTemplateToType(types, fromTypeId, templateId, toTypeId) → { types, newId }`). `RegistryDraft { activeId, types }` is defined once (Task 2) and consumed in Task 5. Imports are minimal and all used (satisfying `noUnusedLocals`/`noUnusedParameters`).

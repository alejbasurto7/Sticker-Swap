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
  // Reuse the already-loaded draft's activeId (lazy init → reads it once at mount).
  const [editingTypeId, setEditingTypeId] = useState<string>(() => draft.activeId);
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
        each section's template. Editing autosaves to this browser; "Export registry" writes the
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
                      alert(`Copied "${section.templateId}" to ${to} as "${newId}".`);
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

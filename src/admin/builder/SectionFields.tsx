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
          ⚠ {section.numbers.length} numbers vs {slots} real slots in "{section.templateId}". They should match.
        </p>
      )}
    </div>
  );
}

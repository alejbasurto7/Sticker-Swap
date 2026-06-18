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

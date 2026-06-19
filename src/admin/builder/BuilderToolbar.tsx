import { useState } from 'react';
import type { AlbumType } from '../../data/albumTypes';

export interface BuilderToolbarProps {
  types: Record<string, AlbumType>;
  editingTypeId: string;
  previewVariant: string;
  onSelectType: (id: string) => void;
  onPreviewVariant: (id: string) => void;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onJumpExport: () => void;
  onNewType: (id: string, name: string) => void;
}

export default function BuilderToolbar({
  types, editingTypeId, previewVariant,
  onSelectType, onPreviewVariant,
  canUndo, canRedo, onUndo, onRedo,
  onJumpExport, onNewType,
}: BuilderToolbarProps) {
  const [newId, setNewId] = useState('');
  const [newName, setNewName] = useState('');

  if (!types[editingTypeId]) return null;

  const type = types[editingTypeId];

  return (
    <div className="builder-toolbar">
      <select
        className="builder-select"
        value={editingTypeId}
        onChange={(e) => onSelectType(e.target.value)}
      >
        {Object.values(types).map((t) => (
          <option key={t.id} value={t.id}>{t.name} ({t.id})</option>
        ))}
      </select>

      <input
        className="builder-input"
        placeholder="new-id"
        value={newId}
        onChange={(e) => setNewId(e.target.value)}
        style={{ width: 90 }}
      />
      <input
        className="builder-input"
        placeholder="New name"
        value={newName}
        onChange={(e) => setNewName(e.target.value)}
        style={{ width: 110 }}
      />
      <button
        className="builder-btn builder-btn--sm"
        onClick={() => {
          if (!newId.trim()) return;
          onNewType(newId.trim(), newName);
          setNewId('');
          setNewName('');
        }}
      >
        + type
      </button>

      <select
        className="builder-select"
        value={previewVariant}
        onChange={(e) => onPreviewVariant(e.target.value)}
      >
        {type.variants.map((v) => (
          <option key={v.id} value={v.id}>{v.label}</option>
        ))}
      </select>

      <div className="spacer" />

      <button
        className="builder-btn builder-btn--ghost builder-btn--sm"
        disabled={!canUndo}
        onClick={onUndo}
      >
        Undo
      </button>
      <button
        className="builder-btn builder-btn--ghost builder-btn--sm"
        disabled={!canRedo}
        onClick={onRedo}
      >
        Redo
      </button>
      <button
        className="builder-btn builder-btn--sm"
        onClick={onJumpExport}
      >
        Export ↓
      </button>
    </div>
  );
}

import { useRef, useState } from 'react';

interface ExportStepProps {
  source: string;
}

export default function ExportStep({ source }: ExportStepProps) {
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = (msg: string) => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast(msg);
    toastTimer.current = setTimeout(() => setToast(null), 2500);
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(source);
      showToast('Copied to clipboard');
    } catch {
      showToast('Clipboard blocked — use Download');
    }
  };

  const handleDownload = () => {
    const blob = new Blob([source], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'albumTypes.generated.ts';
    a.click();
    URL.revokeObjectURL(url);
    showToast('Downloaded albumTypes.generated.ts');
  };

  return (
    <div className="builder-panel">
      <h3 style={{ margin: '0 0 12px' }}>Export registry</h3>

      <pre
        style={{
          background: 'var(--bg)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-sm)',
          padding: 10,
          fontSize: 12,
          whiteSpace: 'pre',
          maxHeight: 360,
          overflow: 'auto',
          margin: '0 0 8px',
        }}
      >
        {source}
      </pre>

      <p style={{ margin: '0 0 12px', fontSize: 12, opacity: 0.7 }}>
        {source.split('\n').length} lines · {source.length} chars
      </p>

      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <button className="builder-btn" onClick={handleCopy}>Copy</button>
        <button className="builder-btn builder-btn--primary" onClick={handleDownload}>Download</button>
      </div>

      <p style={{ margin: 0, fontSize: 13 }}>
        Paste this over the <code>ALBUM_TYPES</code> and <code>ACTIVE_ALBUM_TYPE_ID</code> exports
        in <code>src/data/albumTypes.ts</code>, then commit.
      </p>

      {toast && <div className="builder-toast">{toast}</div>}
    </div>
  );
}

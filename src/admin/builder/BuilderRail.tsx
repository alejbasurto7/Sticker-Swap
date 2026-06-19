export type BuilderStep = 'type' | 'sections' | 'layout' | 'export';

const STEPS = [
  ['type', 'Type'],
  ['sections', 'Sections'],
  ['layout', 'Layout'],
  ['export', 'Export'],
] as const;

export interface BuilderRailProps {
  step: BuilderStep;
  onStep: (s: BuilderStep) => void;
  progressPct: number;
  onResetType: () => void;
  onResetAll: () => void;
}

export default function BuilderRail({ step, onStep, progressPct, onResetType, onResetAll }: BuilderRailProps) {
  return (
    <nav className="builder-rail">
      {STEPS.map(([key, label], i) => (
        <button
          key={key}
          className={`builder-rail-item${step === key ? ' is-active' : ''}`}
          onClick={() => onStep(key)}
        >
          <span className="step-index">{i + 1}</span>
          {label}
        </button>
      ))}

      <div className="builder-rail-progress">
        <div className="bar">
          <span style={{ width: progressPct + '%' }} />
        </div>
        <p style={{ margin: '6px 0 0', fontSize: 12, opacity: 0.7 }}>{progressPct}% defined</p>
      </div>

      <div className="builder-rail-footer">
        <button className="builder-btn builder-btn--ghost builder-btn--sm" onClick={onResetType}>
          Reset this type
        </button>
        <button className="builder-btn builder-btn--ghost builder-btn--sm" onClick={onResetAll}>
          Reset all
        </button>
      </div>
    </nav>
  );
}

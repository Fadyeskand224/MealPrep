import { useEffect } from 'react';

export function Sheet({ title, onClose, children }) {
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [onClose]);

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" role="dialog" aria-label={title} onClick={(e) => e.stopPropagation()}>
        <div className="sheet-grab" />
        <button className="sheet-close" onClick={onClose} aria-label="Close">✕</button>
        {children}
      </div>
    </div>
  );
}

export function Ring({ value, max, size = 132, stroke = 13, children }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(1, max ? value / max : 0));
  return (
    <div className="ring" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={size / 2} cy={size / 2} r={r} className="ring-track" strokeWidth={stroke} fill="none" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          className="ring-fill"
          strokeWidth={stroke}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - pct)}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </svg>
      <div className="ring-label">{children}</div>
    </div>
  );
}

export function MacroBar({ label, eaten, planned, goal, color }) {
  const plannedPct = Math.min(100, (planned / goal) * 100);
  const eatenPct = Math.min(100, (eaten / goal) * 100);
  return (
    <div className="macro">
      <div className="macro-head">
        <span>{label}</span>
        <span>
          <b>{Math.round(eaten)}</b> / {Math.round(planned)}g <small>of {goal}g goal</small>
        </span>
      </div>
      <div className="macro-track">
        <div className="macro-planned" style={{ width: `${plannedPct}%`, background: color }} />
        <div className="macro-eaten" style={{ width: `${eatenPct}%`, background: color }} />
      </div>
    </div>
  );
}

/** Food "photo" without photos: a warm gradient tile with a big emoji. */
export function Tile({ recipe, size = 'md' }) {
  return (
    <div className={`tile tile-${recipe.meal} tile-${size}`} aria-hidden="true">
      <span>{recipe.emoji}</span>
    </div>
  );
}

export function Stat({ k, v }) {
  return (
    <div className="stat">
      <b>{v}</b>
      <small>{k}</small>
    </div>
  );
}

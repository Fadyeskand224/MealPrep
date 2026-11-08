import { useEffect, useRef, useState } from 'react';

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
        <button className="sheet-close" onClick={onClose} aria-label="Close">
          <Icon name="close" size={18} />
        </button>
        {children}
      </div>
    </div>
  );
}

/** Counts smoothly from the previous value to the new one. */
export function Num({ value }) {
  const [v, setV] = useState(0);
  const from = useRef(0);
  useEffect(() => {
    const start = from.current;
    const t0 = performance.now();
    let raf;
    const tick = (t) => {
      const p = Math.min(1, (t - t0) / 700);
      setV(Math.round(start + (value - start) * (1 - Math.pow(1 - p, 3))));
      if (p < 1) raf = requestAnimationFrame(tick);
      else from.current = value;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value]);
  return v;
}

export function Ring({ value, max, size = 140, stroke = 12, children }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(1, max ? value / max : 0));
  return (
    <div className="ring" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <defs>
          <linearGradient id="ringGrad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#a6e86a" />
            <stop offset="1" stopColor="#2fbf71" />
          </linearGradient>
        </defs>
        <circle cx={size / 2} cy={size / 2} r={r} className="ring-track" strokeWidth={stroke} fill="none" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          className="ring-fill"
          stroke="url(#ringGrad)"
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
          <b>{Math.round(eaten)}</b>
          <small> / {Math.round(planned)}g · goal {goal}g</small>
        </span>
      </div>
      <div className="macro-track">
        <div className="macro-planned" style={{ width: `${plannedPct}%`, background: color }} />
        <div className="macro-eaten" style={{ width: `${eatenPct}%`, background: color }} />
      </div>
    </div>
  );
}

/**
 * Real food photo from /public/food, with a warm shimmer while it loads and an
 * emoji fallback if the file is ever missing. size: sm | md | fill
 */
export function Tile({ recipe, size = 'md', zoom = false }) {
  const [state, setState] = useState('loading');
  return (
    <div className={`tile tile-${recipe.meal} tile-${size} ${state}`}>
      {state === 'error' ? (
        <span className="tile-emoji">{recipe.emoji}</span>
      ) : (
        <img
          src={`/food/${recipe.id}.jpg`}
          alt={recipe.name}
          loading="lazy"
          decoding="async"
          className={zoom ? 'zoom' : ''}
          onLoad={() => setState('ready')}
          onError={() => setState('error')}
        />
      )}
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

const PATHS = {
  today: 'M4 13a8 8 0 1 1 16 0M12 13l4-4M5 20h14',
  week: 'M7 3v3M17 3v3M4 9h16M5 5h14a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1z',
  pantry: 'M5 8h14l-1.2 11a1 1 0 0 1-1 .9H7.2a1 1 0 0 1-1-.9L5 8zM9 8a3 3 0 0 1 6 0',
  me: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21a8 8 0 0 1 16 0',
  close: 'M6 6l12 12M18 6L6 18',
  swap: 'M4 8h13l-3-3M20 16H7l3 3',
  check: 'M5 12.5l4.5 4.5L19 7.5',
  sparkle: 'M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3z',
  clock: 'M12 7v5l3 2M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z',
  dice: 'M5 5h14v14H5zM9 9h.01M15 9h.01M12 12h.01M9 15h.01M15 15h.01',
};

export function Icon({ name, size = 22 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={PATHS[name]} />
    </svg>
  );
}

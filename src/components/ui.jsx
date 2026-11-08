import { useEffect, useRef, useState } from 'react';
import { isLoaded, loadPhoto, photoUrl } from '../lib/imageCache';

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
  const id = recipe.id;
  const [state, setState] = useState(() => (isLoaded(id) ? 'ready' : 'loading'));
  const instant = useRef(isLoaded(id)).current; // already cached: show with no fade

  useEffect(() => {
    let alive = true;
    if (isLoaded(id)) {
      setState('ready');
      return undefined;
    }
    setState('loading');
    loadPhoto(id).then((ok) => alive && setState(ok ? 'ready' : 'error'));
    return () => {
      alive = false;
    };
  }, [id]);

  return (
    <div className={`tile tile-${recipe.meal} tile-${size} ${state} ${instant ? 'instant' : ''}`}>
      {state === 'ready' && <img src={photoUrl(id)} alt={recipe.name} className={zoom ? 'zoom' : ''} />}
      {state === 'error' && <span className="tile-emoji">{recipe.emoji}</span>}
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
  recipes: 'M5 4h11a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3V4zM5 17a3 3 0 0 1 3-3h11',
  heart: 'M12 20s-7-4.5-7-10a4 4 0 0 1 7-2.5A4 4 0 0 1 19 10c0 5.5-7 10-7 10z',
  search: 'M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM21 21l-5-5',
  plus: 'M12 5v14M5 12h14',
  camera: 'M4 8a2 2 0 0 1 2-2h1.5l1.2-2h6.6l1.2 2H18a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8zM12 17a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z',
  flash: 'M13 2L4 14h7l-1 8 9-12h-7l1-8z',
  alert: 'M12 9v4M12 17h.01M10.3 3.9L2.4 18a2 2 0 0 0 1.7 3h15.8a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z',
  cart: 'M3 4h2l2.4 11h10.2l2-8H6.2M9 20h.01M17 20h.01',
  share: 'M12 3v12M8 7l4-4 4 4M5 13v6a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-6',
  copy: 'M9 9h10v11H9zM5 15V4h10',
};

export function Icon({ name, size = 22, fill = false }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={fill ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={PATHS[name]} />
    </svg>
  );
}

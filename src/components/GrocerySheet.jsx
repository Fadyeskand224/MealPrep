import { useMemo, useState } from 'react';
import { Icon, Sheet } from './ui';
import { buildGroceryList, groceryText } from '../lib/grocery';
import { fmtFull, planDate } from '../lib/store';

async function copyToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // Fallback for browsers/contexts without the async clipboard API.
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.cssText = 'position:fixed;opacity:0';
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    ta.remove();
    return ok;
  }
}

export default function GrocerySheet({ plan, pantry, checked, onToggle, onClearChecked, onClose }) {
  const [people, setPeople] = useState(1);
  const [toast, setToast] = useState('');
  const list = useMemo(() => buildGroceryList(plan, pantry, people), [plan, pantry, people]);

  const title = `Grocery list: week of ${fmtFull(planDate(plan, 0))}`;
  const remaining = list.groups.reduce((s, g) => s + g.items.filter((i) => !checked[i.name]).length, 0);
  const canShare = typeof navigator !== 'undefined' && !!navigator.share;
  const buildText = () => groceryText(list, checked, `${title} (${people} ${people > 1 ? 'people' : 'person'})`);

  const flash = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(''), 2500);
  };
  const copy = async () => flash((await copyToClipboard(buildText())) ? 'Copied! Paste it into Notes.' : 'Could not copy');

  // On iPhone this opens the share sheet, where "Notes" is one of the options.
  const share = async () => {
    if (!canShare) return copy();
    try {
      await navigator.share({ title, text: buildText() });
    } catch (e) {
      if (e.name !== 'AbortError') copy();
    }
  };

  const anyChecked = Object.keys(checked).length > 0;

  return (
    <Sheet title="Grocery list" onClose={onClose}>
      <div className="sheet-body grocery">
        <div className="eyebrow">This week’s shopping</div>
        <h2>Grocery list</h2>
        <p className="muted">
          {list.meals} meals · <b>{remaining}</b> to buy
          {list.have.length > 0 && ` · ${list.have.length} already in your pantry`}
        </p>

        <div className="people">
          <span>Cooking for</span>
          <div className="stepper-sm">
            <button onClick={() => setPeople(Math.max(1, people - 1))} disabled={people === 1} aria-label="Fewer people">−</button>
            <b>{people}</b>
            <button onClick={() => setPeople(Math.min(8, people + 1))} disabled={people === 8} aria-label="More people">+</button>
          </div>
        </div>

        {list.groups.map((g) => (
          <section key={g.aisle}>
            <h3 className="aisle">{g.aisle}</h3>
            <ul className="glist">
              {g.items.map((i) => (
                <li key={i.name}>
                  <button className={`grow ${checked[i.name] ? 'done' : ''}`} onClick={() => onToggle(i.name)} aria-pressed={!!checked[i.name]}>
                    <span className="box">{checked[i.name] && <Icon name="check" size={16} />}</span>
                    <span className="gname">
                      {i.name}
                      <small>{i.meals.length} {i.meals.length === 1 ? 'meal' : 'meals'}</small>
                    </span>
                    <span className="gqty">{i.qty}</span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        ))}

        {list.staples.length > 0 && (
          <p className="muted staples">Also check you have: {list.staples.join(', ')}.</p>
        )}

        {list.have.length > 0 && (
          <details className="have-box">
            <summary>Already in your pantry ({list.have.length})</summary>
            <ul>
              {list.have.map((i) => (
                <li key={i.name}><span>✓ {i.name}</span><small>{i.qty}</small></li>
              ))}
            </ul>
          </details>
        )}

        {anyChecked && (
          <button className="btn btn-ghost btn-sm" onClick={onClearChecked}>Uncheck everything</button>
        )}
      </div>

      <div className="grocery-actions">
        {toast && <div className="toast" role="status">{toast}</div>}
        <button className="btn btn-primary" onClick={share} disabled={remaining === 0}>
          <Icon name="share" size={18} /> {canShare ? 'Send to Notes' : 'Copy list'}
        </button>
        {canShare && (
          <button className="btn btn-ghost" onClick={copy} disabled={remaining === 0} aria-label="Copy list">
            <Icon name="copy" size={18} /> Copy
          </button>
        )}
        {canShare && <small className="share-hint">Pick Notes in the share sheet.</small>}
      </div>
    </Sheet>
  );
}

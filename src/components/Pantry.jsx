import { useMemo, useState } from 'react';
import { Icon, Tile } from './ui';
import ScanSheet from './ScanSheet';
import ExpiryAlert from './ExpiryAlert';
import { ALL_INGREDIENTS, STAPLES } from '../data/recipes';
import { hasIngredient, recommend } from '../lib/planner';
import { expiringItems, labelOf, sortByUrgency, statusOf } from '../lib/expiry';

const QUICK = ['eggs', 'chicken breast', 'rice', 'pasta', 'spinach', 'black beans', 'cheddar cheese', 'tortillas', 'banana', 'onion'];
const FILTERS = [['all', 'All'], ['breakfast', 'Breakfast'], ['lunch', 'Lunch'], ['dinner', 'Dinner']];

export default function Pantry({ pantry, expiry, warnDays, usable, onAdd, onRemove, onRename, onSetExpiry, onWarnDays, onOpen }) {
  const [text, setText] = useState('');
  const [date, setDate] = useState('');
  const [filter, setFilter] = useState('all');
  const [scanning, setScanning] = useState(false);
  const [onlyUndated, setOnlyUndated] = useState(false);

  const attention = useMemo(() => expiringItems(pantry, expiry, warnDays), [pantry, expiry, warnDays]);
  const sorted = useMemo(() => sortByUrgency(pantry, expiry), [pantry, expiry]);
  const undatedCount = useMemo(() => pantry.filter((n) => !expiry[n]).length, [pantry, expiry]);
  const showUndatedOnly = onlyUndated && undatedCount > 0; // falls back to everything once all have dates
  const visible = showUndatedOnly ? sorted.filter((n) => !expiry[n]) : sorted;
  const closeScan = (count) => {
    setScanning(false);
    if (count > 0) setOnlyUndated(true); // jump straight to adding dates for what was just scanned
  };
  // Food that is still good but should be eaten soon; recipes using it float to the top.
  const useSoon = useMemo(() => attention.filter((i) => i.status === 'soon').map((i) => i.name), [attention]);

  const results = useMemo(() => {
    const list = recommend(usable, filter).map((r) => ({
      ...r,
      uses: r.ingredients.filter((i) => i.have && hasIngredient(useSoon, i.name)).map((i) => i.name),
    }));
    return list.sort((a, b) => b.uses.length - a.uses.length); // stable: keeps the match ranking otherwise
  }, [usable, filter, useSoon]);

  const add = (e) => {
    e?.preventDefault();
    const v = text.trim().toLowerCase();
    if (v) onAdd(v, date || null);
    setText('');
    setDate('');
  };

  return (
    <div className="screen">
      <header className="top">
        <div>
          <div className="eyebrow">Fridge &amp; pantry</div>
          <h1>What do you have?</h1>
        </div>
      </header>

      <ExpiryAlert items={attention} />

      <button className="btn btn-primary btn-block scan-cta" onClick={() => setScanning(true)}>
        <Icon name="camera" size={20} /> Scan barcodes
      </button>

      <form className="addform" onSubmit={add}>
        <div className="addbar">
          <input
            list="ingredients"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Add an ingredient, e.g. eggs"
            enterKeyHint="done"
            autoCapitalize="none"
            maxLength={60}
          />
          <datalist id="ingredients">
            {ALL_INGREDIENTS.filter((i) => !STAPLES.has(i)).map((i) => <option key={i} value={i} />)}
          </datalist>
          <button className="btn btn-primary" type="submit">Add</button>
        </div>
        <label className="date-field">
          <span>Expires <small>(optional)</small></span>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </label>
      </form>

      {pantry.length > 0 && (
        <>
          {undatedCount > 0 && (
            <div className="pills" role="group" aria-label="Which items to show">
              <button className={`pill ${!showUndatedOnly ? 'on' : ''}`} onClick={() => setOnlyUndated(false)}>All items ({pantry.length})</button>
              <button className={`pill ${showUndatedOnly ? 'on' : ''}`} onClick={() => setOnlyUndated(true)}>Needs a date ({undatedCount})</button>
            </div>
          )}
          {showUndatedOnly && <p className="muted fine">Showing items without an expiration date. Tap a date field to set one.</p>}
          <ul className="pitems">
            {visible.map((name) => {
              const status = statusOf(expiry[name], warnDays);
              return (
                <li key={name} className={`pitem ${status}`}>
                  <div className="pitem-main">
                    <b>{name}</b>
                    <span className={`exp-badge ${status}`}>{status === 'none' ? 'No date set' : labelOf(expiry[name])}</span>
                  </div>
                  <input
                    type="date"
                    aria-label={`Expiration date for ${name}`}
                    value={expiry[name] || ''}
                    onChange={(e) => onSetExpiry(name, e.target.value || null)}
                  />
                  <button className="pitem-x" onClick={() => onRemove(name)} aria-label={`Remove ${name}`}>✕</button>
                </li>
              );
            })}
          </ul>

          <div className="people warn-row">
            <span>Warn me <small>before items expire</small></span>
            <div className="stepper-sm">
              <button onClick={() => onWarnDays(Math.max(1, warnDays - 1))} disabled={warnDays <= 1} aria-label="Warn one day later">−</button>
              <b aria-live="polite">{warnDays}<small> {warnDays === 1 ? 'day' : 'days'}</small></b>
              <button onClick={() => onWarnDays(Math.min(14, warnDays + 1))} disabled={warnDays >= 14} aria-label="Warn one day earlier">+</button>
            </div>
          </div>
          <p className="muted fine">Expired items are left out of recipe ideas and your grocery list, so you’ll be reminded to replace them.</p>
        </>
      )}

      {pantry.length === 0 && (
        <>
          <p className="muted">Quick add:</p>
          <div className="chips">
            {QUICK.map((q) => (
              <button key={q} className="chip chip-quick" onClick={() => onAdd(q, null)}>+ {q}</button>
            ))}
          </div>
        </>
      )}

      {usable.length > 0 && (
        <>
          <div className="section-head">
            <h2>Ideas for you</h2>
            <span className="muted">{results.length} found</span>
          </div>
          <div className="pills">
            {FILTERS.map(([k, label]) => (
              <button key={k} className={`pill ${filter === k ? 'on' : ''}`} onClick={() => setFilter(k)}>{label}</button>
            ))}
          </div>

          {results.length === 0 && <p className="muted">Nothing matches yet. Try adding a few more items.</p>}

          {results.map(({ recipe, ingredients, haveCount, coreCount, missing, uses }) => (
            <button key={recipe.id} className="card idea" onClick={() => onOpen(recipe.id)}>
              <div className="idea-top">
                <Tile recipe={recipe} size="md" />
                <div className="row-main">
                  <b>{recipe.name}</b>
                  <small>{recipe.cuisine} · {recipe.mins} min · {recipe.kcal} kcal · {recipe.protein}g protein</small>
                  <span className={`badge ${missing.length === 0 ? 'badge-have' : 'badge-part'}`}>
                    {missing.length === 0 ? '✓ You have everything' : `You have ${haveCount} of ${coreCount}`}
                  </span>
                  {uses.length > 0 && <span className="badge badge-soon">Uses up your {uses.join(', ')}</span>}
                </div>
              </div>
              <ul className="mini-ings">
                {ingredients.filter((i) => !i.staple || i.have).map((i) => (
                  <li key={i.name} className={i.have ? 'have' : 'need'}>
                    {i.have ? '✓ You have this' : 'Need'} · {i.name}
                  </li>
                ))}
              </ul>
            </button>
          ))}
        </>
      )}
      {scanning && (
        <ScanSheet
          pantry={pantry}
          onAdd={(name) => onAdd(name, null)}
          onRemove={onRemove}
          onRename={onRename}
          onClose={closeScan}
        />
      )}
    </div>
  );
}

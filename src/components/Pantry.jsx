import { useMemo, useState } from 'react';
import { Tile } from './ui';
import { ALL_INGREDIENTS, STAPLES } from '../data/recipes';
import { recommend } from '../lib/planner';

const QUICK = ['eggs', 'chicken breast', 'rice', 'pasta', 'spinach', 'black beans', 'cheddar cheese', 'tortillas', 'banana', 'onion'];
const FILTERS = [['all', 'All'], ['breakfast', 'Breakfast'], ['lunch', 'Lunch'], ['dinner', 'Dinner']];

export default function Pantry({ pantry, onAdd, onRemove, onOpen }) {
  const [text, setText] = useState('');
  const [filter, setFilter] = useState('all');
  const results = useMemo(() => recommend(pantry, filter), [pantry, filter]);

  const add = (e) => {
    e?.preventDefault();
    const v = text.trim().toLowerCase();
    if (v) onAdd(v);
    setText('');
  };

  return (
    <div className="screen">
      <header className="top">
        <div>
          <div className="eyebrow">Fridge &amp; pantry</div>
          <h1>What do you have?</h1>
        </div>
      </header>

      <form className="addbar" onSubmit={add}>
        <input
          list="ingredients"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Add an ingredient, e.g. eggs"
          enterKeyHint="done"
          autoCapitalize="none"
        />
        <datalist id="ingredients">
          {ALL_INGREDIENTS.filter((i) => !STAPLES.has(i)).map((i) => <option key={i} value={i} />)}
        </datalist>
        <button className="btn btn-primary" type="submit">Add</button>
      </form>

      <div className="chips">
        {pantry.map((p) => (
          <button key={p} className="chip chip-item" onClick={() => onRemove(p)} aria-label={`Remove ${p}`}>
            {p} <span>✕</span>
          </button>
        ))}
      </div>

      {pantry.length === 0 && (
        <>
          <p className="muted">Quick add:</p>
          <div className="chips">
            {QUICK.map((q) => (
              <button key={q} className="chip chip-quick" onClick={() => onAdd(q)}>+ {q}</button>
            ))}
          </div>
        </>
      )}

      {pantry.length > 0 && (
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

          {results.map(({ recipe, ingredients, haveCount, coreCount, missing }) => (
            <button key={recipe.id} className="card idea" onClick={() => onOpen(recipe.id)}>
              <div className="idea-top">
                <Tile recipe={recipe} size="sm" />
                <div className="row-main">
                  <b>{recipe.name}</b>
                  <small>{recipe.mins} min · {recipe.kcal} kcal · {recipe.protein}g protein</small>
                  <span className={`badge ${missing.length === 0 ? 'badge-have' : 'badge-part'}`}>
                    {missing.length === 0 ? '✓ You have everything' : `You have ${haveCount} of ${coreCount}`}
                  </span>
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
    </div>
  );
}

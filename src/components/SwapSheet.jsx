import { useMemo, useState } from 'react';
import { Icon, Sheet, Tile } from './ui';
import { RECIPES, RECIPE_BY_ID, MEAL_LABEL } from '../data/recipes';

/** Replace a slot with any recipe: surprise me, or search the whole catalog. */
export default function SwapSheet({ plan, dislikes, favorites, day, slot, dayLabel, onPick, onClose }) {
  const current = RECIPE_BY_ID[plan.days[day][slot]];
  const [never, setNever] = useState(false);
  const [query, setQuery] = useState('');

  const { fresh, all } = useMemo(() => {
    const used = new Set(plan.days.map((d) => d[slot]));
    const q = query.trim().toLowerCase();
    const pool = RECIPES.filter(
      (x) => x.meal === slot && x.id !== current.id && !dislikes.includes(x.id) &&
        (!q || x.name.toLowerCase().includes(q) || x.ingredients.some((i) => i.name.includes(q)))
    );
    const rank = (x) => (favorites.includes(x.id) ? 0 : 1);
    const sorted = [...pool].sort((a, b) => rank(a) - rank(b) || a.name.localeCompare(b.name));
    return { fresh: pool.filter((x) => !used.has(x.id)), all: sorted.map((x) => ({ x, inWeek: used.has(x.id) })) };
  }, [plan, slot, dislikes, favorites, query, current.id]);

  const surprise = () => {
    const src = fresh.length ? fresh : all.map((a) => a.x);
    onPick(src[Math.floor(Math.random() * src.length)].id, never);
  };

  return (
    <Sheet title="Replace meal" onClose={onClose}>
      <div className="sheet-body">
        <div className="eyebrow">{dayLabel} · {MEAL_LABEL[slot]}</div>
        <h2>Replace “{current.name}”</h2>

        <button className="btn btn-primary btn-block" onClick={surprise} disabled={all.length === 0}>
          <Icon name="dice" size={18} /> Surprise me
        </button>

        <label className="check">
          <input type="checkbox" checked={never} onChange={(e) => setNever(e.target.checked)} />
          Never suggest “{current.name}” again
        </label>

        <h3>Or choose any {MEAL_LABEL[slot].toLowerCase()}</h3>
        <label className="searchbar">
          <Icon name="search" size={20} />
          <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder={`Search ${all.length} options`} />
        </label>

        {all.length === 0 ? (
          <p className="muted">No matches. Try a different search, or restore hidden recipes in Profile.</p>
        ) : (
          <div className="list">
            {all.map(({ x, inWeek }) => (
              <button key={x.id} className="row" onClick={() => onPick(x.id, never)}>
                <Tile recipe={x} size="sm" />
                <div className="row-main">
                  <b>{x.name}</b>
                  <small>
                    {x.mins} min · {x.kcal} kcal · {x.protein}g protein
                    {inWeek && ' · already in your week'}
                  </small>
                </div>
                {favorites.includes(x.id) && <span className="fav-dot"><Icon name="heart" size={16} fill /></span>}
                <span className="chev">›</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </Sheet>
  );
}

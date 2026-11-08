import { useMemo, useState } from 'react';
import { Sheet, Tile } from './ui';
import { RECIPE_BY_ID, MEAL_LABEL } from '../data/recipes';
import { swapOptions } from '../lib/planner';

export default function SwapSheet({ plan, dislikes, day, slot, dayLabel, onPick, onClose }) {
  const current = RECIPE_BY_ID[plan.days[day][slot]];
  const [never, setNever] = useState(false);
  const options = useMemo(() => {
    const o = swapOptions(plan, slot, dislikes);
    return o.sort(() => Math.random() - 0.5);
  }, [plan, slot, dislikes]);

  return (
    <Sheet title="Replace meal" onClose={onClose}>
      <div className="sheet-body">
        <div className="eyebrow">{dayLabel} · {MEAL_LABEL[slot]}</div>
        <h2>Replace “{current.name}”</h2>

        {options.length === 0 ? (
          <p className="muted">No other {slot} options left. Un-hide some recipes from your Profile.</p>
        ) : (
          <>
            <button
              className="btn btn-primary btn-block"
              onClick={() => onPick(options[0].id, never)}
            >
              🎲 Surprise me
            </button>

            <label className="check">
              <input type="checkbox" checked={never} onChange={(e) => setNever(e.target.checked)} />
              Never suggest “{current.name}” again
            </label>

            <h3>Or choose one</h3>
            <div className="list">
              {options.map((r) => (
                <button key={r.id} className="row" onClick={() => onPick(r.id, never)}>
                  <Tile recipe={r} size="sm" />
                  <div className="row-main">
                    <b>{r.name}</b>
                    <small>
                      {r.mins} min · {r.kcal} kcal · {r.protein}g protein
                    </small>
                  </div>
                  <span className="chev">›</span>
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    </Sheet>
  );
}

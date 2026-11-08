import { useState } from 'react';
import { Icon, Sheet } from './ui';
import { MEALS, MEAL_LABEL, RECIPE_BY_ID } from '../data/recipes';
import { fmtDay, planDate } from '../lib/store';

/** Pick a day and meal slot to drop a recipe into. */
export default function AddToPlanSheet({ recipe, plan, onAdd, onClose }) {
  const dateFor = (i) => (plan ? planDate(plan, i) : new Date(Date.now() + i * 86400000));
  const [day, setDay] = useState(0);
  const [slot, setSlot] = useState(recipe.meal);

  const current = plan ? RECIPE_BY_ID[plan.days[day][slot]] : null;

  return (
    <Sheet title="Add to my week" onClose={onClose}>
      <div className="sheet-body">
        <div className="eyebrow">Add to my week</div>
        <h2>{recipe.name}</h2>

        {!plan && <p className="muted">You don’t have a plan yet. We’ll build your week around this meal.</p>}

        <h3>Day</h3>
        <div className="days picker" role="radiogroup">
          {Array.from({ length: 7 }, (_, i) => (
            <button key={i} role="radio" aria-checked={i === day} className={`daychip ${i === day ? 'on' : ''}`} onClick={() => setDay(i)}>
              <small>{fmtDay(dateFor(i))}</small>
              <b>{dateFor(i).getDate()}</b>
            </button>
          ))}
        </div>

        <h3>Meal</h3>
        <div className="seg seg-3" role="radiogroup">
          {MEALS.map((m) => (
            <button key={m} role="radio" aria-checked={m === slot} className={m === slot ? 'on' : ''} onClick={() => setSlot(m)}>
              {MEAL_LABEL[m]}
            </button>
          ))}
        </div>

        {current && current.id !== recipe.id && (
          <p className="muted">Replaces “{current.name}”.</p>
        )}

        <button className="btn btn-primary btn-block" onClick={() => onAdd(day, slot)}>
          <Icon name="plus" size={18} /> Add to {fmtDay(dateFor(day))} {MEAL_LABEL[slot].toLowerCase()}
        </button>
      </div>
    </Sheet>
  );
}

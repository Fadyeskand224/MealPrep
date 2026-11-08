import { Tile } from './ui';
import { RECIPE_BY_ID, MEALS, MEAL_LABEL } from '../data/recipes';
import { dayTotals } from '../lib/planner';
import { fmtFull, planDate } from '../lib/store';

export default function Plan({ data, onGenerate, onOpen, onSwap, onJumpDay }) {
  const { plan } = data;

  return (
    <div className="screen">
      <header className="top">
        <div>
          <div className="eyebrow">Your 7-day plan</div>
          <h1>This week</h1>
        </div>
        <button className="btn btn-primary btn-sm" onClick={onGenerate}>
          {plan ? '✨ New week' : '✨ Generate'}
        </button>
      </header>

      {!plan ? (
        <div className="empty">
          <div className="empty-emoji">📅</div>
          <h2>No plan yet</h2>
          <p>Tap generate for a full week of easy meals. You can swap out anything you don’t fancy.</p>
        </div>
      ) : (
        plan.days.map((d, i) => {
          const t = dayTotals(d);
          return (
            <section key={i} className="card day">
              <button className="day-head" onClick={() => onJumpDay(i)}>
                <b>{fmtFull(planDate(plan, i))}</b>
                <small>{t.kcal} kcal · {t.protein}g protein</small>
              </button>
              {MEALS.map((slot) => {
                const rec = RECIPE_BY_ID[d[slot]];
                return (
                  <div key={slot} className="row plain">
                    <button className="row-tap" onClick={() => onOpen(rec.id, i, slot)}>
                      <Tile recipe={rec} size="sm" />
                      <div className="row-main">
                        <small className="eyebrow">{MEAL_LABEL[slot]}</small>
                        <b>{rec.name}</b>
                        <small>{rec.mins} min · {rec.kcal} kcal</small>
                      </div>
                    </button>
                    <button className="icon-btn swap" onClick={() => onSwap(i, slot)} aria-label={`Replace ${rec.name}`}>↻</button>
                  </div>
                );
              })}
            </section>
          );
        })
      )}
    </div>
  );
}

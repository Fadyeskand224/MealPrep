import { useRef, useState } from 'react';
import { MacroBar, Ring, Tile } from './ui';
import { RECIPE_BY_ID, MEALS, MEAL_LABEL } from '../data/recipes';
import { dayTotals, goalsFor } from '../lib/planner';
import { fmtDay, fmtFull, planDate } from '../lib/store';

export default function Dashboard({
  user, data, day, setDay, onGenerate, onOpen, onSwap, onToggleEaten,
}) {
  const { plan, eaten, target } = data;
  const goals = goalsFor(target);
  const [slotIdx, setSlotIdx] = useState(0);
  const carousel = useRef(null);

  if (!plan) {
    return (
      <div className="screen">
        <header className="top">
          <div>
            <div className="eyebrow">Hi {user.name.split(' ')[0]} 👋</div>
            <h1>Today</h1>
          </div>
        </header>
        <div className="empty">
          <div className="empty-emoji">🍽️</div>
          <h2>Let’s plan your week</h2>
          <p>One tap gives you 7 days of tasty, easy meals with the macros worked out for you.</p>
          <button className="btn btn-primary btn-block" onClick={onGenerate}>
            ✨ Generate my week
          </button>
        </div>
      </div>
    );
  }

  const d = plan.days[day];
  const dayEaten = Object.fromEntries(MEALS.map((s) => [s, !!eaten[`${day}:${s}`]]));
  const planned = dayTotals(d);
  const done = dayTotals(d, dayEaten);
  const weekAvg = Math.round(plan.days.reduce((s, x) => s + dayTotals(x).kcal, 0) / 7);
  const left = goals.kcal - done.kcal;

  const goSlot = (i) => {
    const el = carousel.current;
    if (el) el.scrollTo({ left: i * el.clientWidth, behavior: 'smooth' });
    setSlotIdx(i);
  };
  const onScroll = (e) => {
    const el = e.currentTarget;
    setSlotIdx(Math.round(el.scrollLeft / el.clientWidth));
  };

  return (
    <div className="screen">
      <header className="top">
        <div>
          <div className="eyebrow">{fmtFull(planDate(plan, day))}</div>
          <h1>{day === 0 ? 'Today' : fmtDay(planDate(plan, day))}’s fuel</h1>
        </div>
      </header>

      <div className="daybar">
        <button className="icon-btn" onClick={() => setDay(Math.max(0, day - 1))} disabled={day === 0} aria-label="Previous day">‹</button>
        <div className="days" role="tablist">
          {plan.days.map((_, i) => (
            <button
              key={i}
              role="tab"
              aria-selected={i === day}
              className={`daychip ${i === day ? 'on' : ''}`}
              onClick={() => setDay(i)}
            >
              <small>{fmtDay(planDate(plan, i))}</small>
              <b>{planDate(plan, i).getDate()}</b>
            </button>
          ))}
        </div>
        <button className="icon-btn" onClick={() => setDay(Math.min(6, day + 1))} disabled={day === 6} aria-label="Next day">›</button>
      </div>

      <section className="card macros">
        <div className="macros-top">
          <Ring value={done.kcal} max={goals.kcal}>
            <b>{Math.round(done.kcal)}</b>
            <small>of {goals.kcal} kcal</small>
          </Ring>
          <div className="macros-side">
            <div className="big">{left >= 0 ? Math.round(left) : 0}</div>
            <div className="muted">kcal left to eat</div>
            <div className="chip">Planned today: {planned.kcal} kcal</div>
            <div className="chip chip-soft">Week avg: {weekAvg} kcal</div>
          </div>
        </div>
        <MacroBar label="Protein" eaten={done.protein} planned={planned.protein} goal={goals.protein} color="var(--tomato)" />
        <MacroBar label="Carbs" eaten={done.carbs} planned={planned.carbs} goal={goals.carbs} color="var(--saffron)" />
        <MacroBar label="Fat" eaten={done.fat} planned={planned.fat} goal={goals.fat} color="var(--olive)" />
        <p className="legend"><i className="lg-eaten" /> eaten <i className="lg-plan" /> planned</p>
      </section>

      <div className="section-head">
        <h2>Meals</h2>
        <div className="dots">
          {MEALS.map((s, i) => (
            <button key={s} className={`dot ${i === slotIdx ? 'on' : ''}`} onClick={() => goSlot(i)} aria-label={MEAL_LABEL[s]} />
          ))}
        </div>
      </div>

      <div className="carousel" ref={carousel} onScroll={onScroll}>
        {MEALS.map((slot) => {
          const rec = RECIPE_BY_ID[d[slot]];
          const isEaten = dayEaten[slot];
          return (
            <article key={slot} className={`meal ${isEaten ? 'eaten' : ''}`}>
              <button className="meal-main" onClick={() => onOpen(rec.id, day, slot)}>
                <Tile recipe={rec} size="lg" />
                <div className="meal-info">
                  <div className="eyebrow">{MEAL_LABEL[slot]} · {rec.mins} min</div>
                  <h3>{rec.name}</h3>
                  <div className="meal-macros">
                    <span><b>{rec.kcal}</b> kcal</span>
                    <span><b>{rec.protein}</b>g P</span>
                    <span><b>{rec.carbs}</b>g C</span>
                    <span><b>{rec.fat}</b>g F</span>
                  </div>
                </div>
              </button>
              <div className="meal-actions">
                <button className={`btn ${isEaten ? 'btn-done' : 'btn-primary'}`} onClick={() => onToggleEaten(day, slot)}>
                  {isEaten ? '✓ Eaten' : 'Mark eaten'}
                </button>
                <button className="btn btn-ghost" onClick={() => onSwap(day, slot)}>↻ Replace</button>
              </div>
            </article>
          );
        })}
      </div>
      <p className="hint">Swipe to flip through breakfast, lunch and dinner.</p>
    </div>
  );
}

import { useRef, useState } from 'react';
import { Icon, MacroBar, Num, Ring, Tile } from './ui';
import ExpiryAlert from './ExpiryAlert';
import { MEALS, MEAL_LABEL } from '../data/recipes';
import { useRecipes } from './RecipesContext';
import { dayTotals, goalsFor } from '../lib/planner';
import { fmtDay, fmtFull, planDate } from '../lib/store';

export default function Dashboard({
  user, data, day, setDay, onGenerate, onOpen, onSwap, onToggleEaten, expiring = [], onGoPantry,
}) {
  const { plan, eaten, target } = data;
  const { byId } = useRecipes(); // macros already adjusted for the user's scanned products
  const goals = goalsFor(target);
  const [slotIdx, setSlotIdx] = useState(0);
  const carousel = useRef(null);

  if (!plan) {
    return (
      <div className="screen">
        <header className="top">
          <div>
            <div className="eyebrow">Hi {user.name.split(' ')[0]}</div>
            <h1>Let’s eat well</h1>
          </div>
        </header>
        <ExpiryAlert items={expiring} onClick={onGoPantry} />
        <div className="empty hero-empty">
          <div className="empty-photos" aria-hidden="true">
            {['d-baked-salmon', 'b-banana-pancakes', 'l-greek-chickpea-salad'].map((id) => (
              <img key={id} src={`/food/${id}.jpg`} alt="" />
            ))}
          </div>
          <h2>Plan your whole week in one tap</h2>
          <p>Easy, good-looking meals with the macros already worked out.</p>
          <button className="btn btn-primary btn-block" onClick={onGenerate}>
            <Icon name="sparkle" size={18} /> Generate my week
          </button>
        </div>
      </div>
    );
  }

  const d = plan.days[day];
  const dayEaten = Object.fromEntries(MEALS.map((s) => [s, !!eaten[`${day}:${s}`]]));
  const planned = dayTotals(d, undefined, byId);
  const done = dayTotals(d, dayEaten, byId);
  const weekAvg = Math.round(plan.days.reduce((s, x) => s + dayTotals(x, undefined, byId).kcal, 0) / 7);
  // Which scanned products are changing today's numbers (shown under the macro bars).
  const usedItems = [...new Set(MEALS.flatMap((s) => (byId[d[s]].adjustments || []).map((a) => a.item)))];
  const left = Math.max(0, goals.kcal - done.kcal);

  const goSlot = (i) => {
    const el = carousel.current;
    if (el) el.scrollTo({ left: i * (el.firstChild.offsetWidth + 12), behavior: 'smooth' });
    setSlotIdx(i);
  };
  const onScroll = (e) => {
    const el = e.currentTarget;
    setSlotIdx(Math.round(el.scrollLeft / (el.firstChild.offsetWidth + 12)));
  };

  return (
    <div className="screen">
      <header className="top">
        <div>
          <div className="eyebrow">{fmtFull(planDate(plan, day))}</div>
          <h1>{day === 0 ? 'Today' : fmtDay(planDate(plan, day))}</h1>
        </div>
        <div className="avatar" aria-hidden="true">{user.name[0].toUpperCase()}</div>
      </header>

      <ExpiryAlert items={expiring} onClick={onGoPantry} />

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

      <section className="macros">
        <div className="macros-glow" aria-hidden="true" />
        <div className="macros-top">
          <Ring value={done.kcal} max={goals.kcal}>
            <b><Num value={Math.round(done.kcal)} /></b>
            <small>of {goals.kcal} kcal</small>
          </Ring>
          <div className="macros-side">
            <div className="big"><Num value={Math.round(left)} /></div>
            <div className="side-label">kcal left to eat</div>
            <div className="chips-row">
              <span className="pill-dark">Planned {planned.kcal}</span>
              <span className="pill-dark soft">Week avg {weekAvg}</span>
            </div>
          </div>
        </div>
        <MacroBar label="Protein" eaten={done.protein} planned={planned.protein} goal={goals.protein} color="linear-gradient(90deg,#ff9a6c,#ff5a36)" />
        <MacroBar label="Carbs" eaten={done.carbs} planned={planned.carbs} goal={goals.carbs} color="linear-gradient(90deg,#ffd36e,#f5a524)" />
        <MacroBar label="Fat" eaten={done.fat} planned={planned.fat} goal={goals.fat} color="linear-gradient(90deg,#b8ee7a,#5fc24a)" />
        {usedItems.length > 0 && (
          <p className="adjust-note">
            <span aria-hidden="true">📊</span> Macros adjusted for your scanned {usedItems.join(', ')}.
          </p>
        )}
      </section>

      <div className="section-head">
        <h2>Meals</h2>
        <div className="dots">
          {MEALS.map((s, i) => (
            <button key={s} className={`dot ${i === slotIdx ? 'on' : ''}`} onClick={() => goSlot(i)} aria-label={MEAL_LABEL[s]} />
          ))}
        </div>
      </div>

      <div className="carousel" ref={carousel} onScroll={onScroll} key={day}>
        {MEALS.map((slot, i) => {
          const rec = byId[d[slot]];
          const isEaten = dayEaten[slot];
          return (
            <article key={slot} className={`meal ${i === slotIdx ? 'active' : ''} ${isEaten ? 'eaten' : ''}`}>
              <button className="meal-photo" onClick={() => onOpen(rec.id, day, slot)}>
                <Tile recipe={rec} size="fill" zoom />
                <span className="meal-shade" />
                <span className="meal-tag">{MEAL_LABEL[slot]}</span>
                {isEaten && <span className="eaten-badge"><Icon name="check" size={16} /></span>}
                <span className="meal-over">
                  <span className="meal-title">{rec.name}</span>
                  <span className="meal-macros">
                    <span><Icon name="clock" size={13} /> {rec.mins}m</span>
                    <span><b>{rec.kcal}</b> kcal</span>
                    <span><b>{rec.protein}</b>g P</span>
                    <span><b>{rec.carbs}</b>g C</span>
                    <span><b>{rec.fat}</b>g F</span>
                  </span>
                </span>
              </button>
              <div className="meal-actions">
                <button className={`btn ${isEaten ? 'btn-done' : 'btn-primary'}`} onClick={() => onToggleEaten(day, slot)}>
                  {isEaten ? <><Icon name="check" size={18} /> Eaten</> : 'Mark eaten'}
                </button>
                <button className="btn btn-ghost" onClick={() => onSwap(day, slot)}>
                  <Icon name="swap" size={18} /> Replace
                </button>
              </div>
            </article>
          );
        })}
      </div>
      <p className="hint">Swipe to flip through breakfast, lunch and dinner</p>
      <p className="hint fine-print">Nutrition figures are estimates and not medical advice.</p>
    </div>
  );
}

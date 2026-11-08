import { RECIPE_BY_ID } from '../data/recipes';
import { goalsFor } from '../lib/planner';

export default function Profile({ user, data, onTarget, onRestore, onLogout }) {
  const g = goalsFor(data.target);

  return (
    <div className="screen">
      <header className="top">
        <div>
          <div className="eyebrow">{user.id}</div>
          <h1>Hi, {user.name.split(' ')[0]}</h1>
        </div>
      </header>

      <section className="card">
        <h2>Daily calorie goal</h2>
        <div className="stepper">
          <button className="icon-btn" onClick={() => onTarget(Math.max(1200, data.target - 50))} aria-label="Decrease">−</button>
          <div><b>{data.target}</b><small>kcal / day</small></div>
          <button className="icon-btn" onClick={() => onTarget(Math.min(4500, data.target + 50))} aria-label="Increase">+</button>
        </div>
        <p className="muted">
          Macro goals: {g.protein}g protein · {g.carbs}g carbs · {g.fat}g fat. New weeks are generated to land close to this goal.
        </p>
      </section>

      <section className="card">
        <h2>Hidden recipes</h2>
        {data.dislikes.length === 0 ? (
          <p className="muted">When you replace a meal and choose “never suggest again”, it shows up here.</p>
        ) : (
          data.dislikes.map((id) => (
            <div key={id} className="row plain">
              <div className="row-main"><b>{RECIPE_BY_ID[id]?.name}</b></div>
              <button className="btn btn-ghost btn-sm" onClick={() => onRestore(id)}>Restore</button>
            </div>
          ))
        )}
      </section>

      <button className="btn btn-ghost btn-block" onClick={onLogout}>Log out</button>
    </div>
  );
}

import { useState } from 'react';
import { RECIPE_BY_ID } from '../data/recipes';
import credits from '../data/photoCredits.json';
import { goalsFor } from '../lib/planner';

function Security({ onChangePassword, onDeleteAccount }) {
  const [pw, setPw] = useState({ current: '', next: '' });
  const [msg, setMsg] = useState(null); // { ok, text }
  const [busy, setBusy] = useState(false);
  const [del, setDel] = useState('');
  const [delErr, setDelErr] = useState('');

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    try {
      await onChangePassword(pw.current, pw.next);
      setPw({ current: '', next: '' });
      setMsg({ ok: true, text: 'Password changed. Your other devices were signed out.' });
    } catch (err) {
      setMsg({ ok: false, text: err.message });
    } finally {
      setBusy(false);
    }
  };

  const remove = async (e) => {
    e.preventDefault();
    if (!window.confirm('Delete your account and all of your data? This cannot be undone.')) return;
    setDelErr('');
    try {
      await onDeleteAccount(del);
    } catch (err) {
      setDelErr(err.message);
    }
  };

  return (
    <section className="card security">
      <h2>Security</h2>
      <details>
        <summary>Change password</summary>
        <form onSubmit={submit} className="stack">
          <label>Current password
            <input type="password" autoComplete="current-password" value={pw.current} onChange={(e) => setPw({ ...pw, current: e.target.value })} required />
          </label>
          <label>New password
            <input type="password" autoComplete="new-password" minLength={8} value={pw.next} onChange={(e) => setPw({ ...pw, next: e.target.value })} required />
          </label>
          {msg && <div className={msg.ok ? 'form-ok' : 'form-error'} role="alert">{msg.text}</div>}
          <button className="btn btn-primary btn-block" disabled={busy}>{busy ? 'Saving…' : 'Update password'}</button>
        </form>
      </details>
      <details>
        <summary className="danger">Delete account</summary>
        <form onSubmit={remove} className="stack">
          <p className="muted">This permanently erases your account, meal plans, pantry and favorites.</p>
          <label>Confirm with your password
            <input type="password" autoComplete="current-password" value={del} onChange={(e) => setDel(e.target.value)} required />
          </label>
          {delErr && <div className="form-error" role="alert">{delErr}</div>}
          <button className="btn btn-danger btn-block">Delete my account</button>
        </form>
      </details>
    </section>
  );
}

export default function Profile({ user, data, onTarget, onRestore, onLogout, onChangePassword, onDeleteAccount }) {
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

      <Security onChangePassword={onChangePassword} onDeleteAccount={onDeleteAccount} />

      <section className="card">
        <details className="credits">
          <summary><h2>Photo credits</h2></summary>
          <p className="muted">Food photos are from Wikimedia Commons under free licenses.</p>
          <ul>
            {Object.entries(credits).map(([id, c]) => (
              <li key={id}>
                <b>{RECIPE_BY_ID[id]?.name}</b>
                <small>
                  <a href={c.url} target="_blank" rel="noreferrer">{c.title}</a> · {c.author} · {c.license}
                </small>
              </li>
            ))}
          </ul>
        </details>
      </section>

      <button className="btn btn-ghost btn-block" onClick={onLogout}>Log out</button>
    </div>
  );
}

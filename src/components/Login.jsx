import { useState } from 'react';
import { logIn, signUp } from '../lib/auth';

const ROW_A = ['d-baked-salmon', 'b-banana-pancakes', 'l-tomato-soup-grilled-cheese', 'd-beef-tacos', 'b-avocado-egg-toast', 'd-turkey-chili'];
const ROW_B = ['l-greek-chickpea-salad', 'd-turkey-meatballs', 'b-overnight-oats', 'l-egg-fried-rice', 'd-chicken-fajitas', 'l-bean-quesadilla'];

function Marquee({ ids, reverse }) {
  const list = [...ids, ...ids];
  return (
    <div className={`marquee ${reverse ? 'rev' : ''}`} aria-hidden="true">
      <div className="marquee-track">
        {list.map((id, i) => (
          <img key={i} src={`/food/${id}.jpg`} alt="" loading="eager" />
        ))}
      </div>
    </div>
  );
}

export default function Login({ onAuthed }) {
  const [mode, setMode] = useState('login');
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const user = mode === 'login' ? await logIn(form) : await signUp(form);
      onAuthed(user);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="login">
      <div className="login-hero">
        <div className="marquees">
          <Marquee ids={ROW_A} />
          <Marquee ids={ROW_B} reverse />
        </div>
        <div className="login-fade" />
        <div className="login-title">
          <h1>EmsMeals</h1>
          <p>A week of easy, delicious meals — planned in one tap.</p>
        </div>
      </div>

      <form className="login-card" onSubmit={submit}>
        <div className="seg">
          <button type="button" className={mode === 'login' ? 'on' : ''} onClick={() => setMode('login')}>
            Log in
          </button>
          <button type="button" className={mode === 'signup' ? 'on' : ''} onClick={() => setMode('signup')}>
            Sign up
          </button>
        </div>

        {mode === 'signup' && (
          <label>
            Name
            <input value={form.name} onChange={set('name')} autoComplete="name" placeholder="Your name" required />
          </label>
        )}
        <label>
          Email
          <input
            type="email"
            inputMode="email"
            value={form.email}
            onChange={set('email')}
            autoComplete="email"
            placeholder="you@example.com"
            required
          />
        </label>
        <label>
          Password
          <input
            type="password"
            value={form.password}
            onChange={set('password')}
            autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            placeholder={mode === 'signup' ? 'At least 8 characters' : 'Your password'}
            required
          />
        </label>

        {error && <div className="form-error" role="alert">{error}</div>}

        <button className="btn btn-primary btn-block" disabled={busy}>
          {busy ? 'One moment…' : mode === 'login' ? 'Log in' : 'Create account'}
        </button>
      </form>
    </div>
  );
}

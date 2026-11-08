import { useState } from 'react';
import { logIn, signUp } from '../lib/auth';

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
        <div className="login-logo">🍲</div>
        <h1>MealPrep</h1>
        <p>A week of easy, delicious meals, planned in one tap.</p>
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

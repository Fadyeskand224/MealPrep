import express from 'express';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import fs from 'node:fs';
import path from 'node:path';
import { hashPassword, verifyPassword, dummyVerify, passwordProblem } from './passwords.js';
import { createSessionStore, SESSION_DAYS } from './sessions.js';
import { createAttemptTracker } from './attempts.js';
import { validateEmail, validateName, validateUserData } from './validate.js';

const GENERIC_LOGIN_ERROR = 'Incorrect email or password.';
const LOCKED_ERROR = 'Too many attempts. Please wait a few minutes and try again.';

export function createApp({ db, prod = false, distDir = null, allowedOrigins = [], limits = {} } = {}) {
  const app = express();
  const sessions = createSessionStore(db);
  const loginAttempts = createAttemptTracker(db, { scope: 'login' });
  const passwordAttempts = createAttemptTracker(db, { scope: 'password' });

  const COOKIE = prod ? '__Host-sid' : 'sid'; // __Host- pins the cookie to this exact host over HTTPS
  const cookieOpts = { httpOnly: true, secure: prod, sameSite: 'lax', path: '/' };

  app.disable('x-powered-by');
  app.set('trust proxy', 1); // behind the host's proxy: correct client IP and protocol

  app.use(
    helmet({
      contentSecurityPolicy: {
        useDefaults: false,
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"], // React sets inline style attributes
          imgSrc: ["'self'", 'data:'],
          connectSrc: ["'self'"],
          manifestSrc: ["'self'"],
          workerSrc: ["'self'"],
          objectSrc: ["'none'"],
          baseUri: ["'self'"],
          formAction: ["'self'"],
          frameAncestors: ["'none'"],
        },
      },
      hsts: prod ? { maxAge: 63072000, includeSubDomains: true } : false,
      referrerPolicy: { policy: 'no-referrer' },
      crossOriginResourcePolicy: { policy: 'same-origin' },
    })
  );

  // ───────── /api plumbing ─────────
  const api = express.Router();
  api.use((req, res, next) => {
    res.set('Cache-Control', 'no-store');
    next();
  });
  api.use(express.json({ limit: '128kb' }));

  // CSRF defence in depth (on top of SameSite=Lax): state-changing requests must come from our own origin.
  api.use((req, res, next) => {
    if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
    const origin = req.get('origin');
    const self = `${req.protocol}://${req.get('host')}`;
    if (origin ? origin === self || allowedOrigins.includes(origin) : req.get('sec-fetch-site') === 'same-origin') return next();
    return res.status(403).json({ error: 'Forbidden.' });
  });

  const tooMany = { error: LOCKED_ERROR };
  const limiter = (windowMs, limit) => rateLimit({ windowMs, limit, standardHeaders: true, legacyHeaders: false, message: tooMany });
  const authLimiter = limiter(15 * 60e3, limits.auth ?? 30);
  const signupLimiter = limiter(60 * 60e3, limits.signup ?? 10);
  api.use(limiter(15 * 60e3, limits.general ?? 600));

  const readCookie = (req) => {
    for (const part of (req.get('cookie') || '').split(';')) {
      const i = part.indexOf('=');
      if (i > 0 && part.slice(0, i).trim() === COOKIE) return decodeURIComponent(part.slice(i + 1).trim());
    }
    return null;
  };
  const setSession = async (res, userId) => {
    const token = await sessions.create(userId);
    res.cookie(COOKIE, token, { ...cookieOpts, maxAge: SESSION_DAYS * 86400000 });
  };
  const clearSession = (res) => res.clearCookie(COOKIE, cookieOpts);

  // Express 4 doesn't catch rejected promises, so async handlers are wrapped.
  const h = (fn) => (req, res, next) => fn(req, res, next).catch(next);

  const requireAuth = h(async (req, res, next) => {
    const token = readCookie(req);
    const s = token && (await sessions.get(token));
    if (!s) return res.status(401).json({ error: 'Please log in.' });
    req.user = s.user;
    req.token = token;
    return next();
  });

  const publicUser = (u) => ({ id: u.id, name: u.name, email: u.email });
  const normEmail = (e) => String(e).trim().toLowerCase();
  const asString = (v) => (typeof v === 'string' ? v : '');

  api.get('/health', (req, res) => res.json({ ok: true })); // used by the host's health check

  // ───────── Auth ─────────
  api.post('/auth/signup', signupLimiter, h(async (req, res) => {
    const { name, email, password } = req.body || {};
    if (!validateName(name)) return res.status(400).json({ error: 'Please enter your name.' });
    if (!validateEmail(email)) return res.status(400).json({ error: 'Enter a valid email address.' });
    const id = normEmail(email);
    const problem = passwordProblem(password, { email: id, name });
    if (problem) return res.status(400).json({ error: problem });
    if (await db.get('SELECT 1 AS x FROM users WHERE email = ?', [id])) {
      return res.status(409).json({ error: 'An account with that email already exists.' });
    }
    try {
      const info = await db.run(
        'INSERT INTO users (email, name, password_hash, created_at) VALUES (?, ?, ?, ?)',
        [id, name.trim(), await hashPassword(password), Date.now()]
      );
      await setSession(res, info.lastInsertRowid);
      return res.status(201).json({ user: { id: info.lastInsertRowid, name: name.trim(), email: id } });
    } catch (e) {
      if (String(e.code).startsWith('SQLITE_CONSTRAINT')) return res.status(409).json({ error: 'An account with that email already exists.' });
      throw e;
    }
  }));

  api.post('/auth/login', authLimiter, h(async (req, res) => {
    const { email, password } = req.body || {};
    if (typeof email !== 'string' || typeof password !== 'string' || email.length > 254 || password.length > 128) {
      return res.status(400).json({ error: GENERIC_LOGIN_ERROR });
    }
    const id = normEmail(email);
    if (await loginAttempts.isLocked(id)) return res.status(429).json({ error: LOCKED_ERROR });

    const user = await db.get('SELECT * FROM users WHERE email = ?', [id]);
    const ok = user ? await verifyPassword(password, user.password_hash) : await dummyVerify(password);
    if (!ok) {
      await loginAttempts.fail(id);
      return res.status(401).json({ error: GENERIC_LOGIN_ERROR });
    }
    await loginAttempts.reset(id);
    await setSession(res, user.id); // brand-new token on every login
    return res.json({ user: publicUser(user) });
  }));

  api.post('/auth/logout', h(async (req, res) => {
    const token = readCookie(req);
    if (token) await sessions.destroy(token);
    clearSession(res);
    res.json({ ok: true });
  }));

  api.get('/auth/me', requireAuth, (req, res) => res.json({ user: publicUser(req.user) }));

  api.post('/auth/password', requireAuth, h(async (req, res) => {
    const { currentPassword, newPassword } = req.body || {};
    const key = `pw:${req.user.id}`;
    if (await passwordAttempts.isLocked(key)) return res.status(429).json({ error: LOCKED_ERROR });
    const row = await db.get('SELECT password_hash FROM users WHERE id = ?', [req.user.id]);
    if (typeof currentPassword !== 'string' || !(await verifyPassword(currentPassword, row.password_hash))) {
      await passwordAttempts.fail(key);
      return res.status(401).json({ error: 'Your current password is incorrect.' });
    }
    await passwordAttempts.reset(key);
    const problem = passwordProblem(newPassword, { email: req.user.email, name: req.user.name });
    if (problem) return res.status(400).json({ error: problem });
    await db.run('UPDATE users SET password_hash = ? WHERE id = ?', [await hashPassword(newPassword), req.user.id]);
    await sessions.destroyAllForUser(req.user.id); // signs out every other device
    await setSession(res, req.user.id);
    return res.json({ ok: true });
  }));

  api.delete('/auth/account', requireAuth, h(async (req, res) => {
    const key = `pw:${req.user.id}`;
    if (await passwordAttempts.isLocked(key)) return res.status(429).json({ error: LOCKED_ERROR });
    const row = await db.get('SELECT password_hash FROM users WHERE id = ?', [req.user.id]);
    const password = asString((req.body || {}).password);
    if (!password || !(await verifyPassword(password, row.password_hash))) {
      await passwordAttempts.fail(key);
      return res.status(401).json({ error: 'Your password is incorrect.' });
    }
    // One atomic batch: everything belonging to the user goes together.
    await db.batch([
      ['DELETE FROM sessions WHERE user_id = ?', [req.user.id]],
      ['DELETE FROM user_data WHERE user_id = ?', [req.user.id]],
      ['DELETE FROM users WHERE id = ?', [req.user.id]],
    ]);
    clearSession(res);
    return res.json({ ok: true });
  }));

  // ───────── User data ─────────
  api.get('/data', requireAuth, h(async (req, res) => {
    const row = await db.get('SELECT json, updated_at FROM user_data WHERE user_id = ?', [req.user.id]);
    res.json(row ? { data: JSON.parse(row.json), updatedAt: row.updated_at } : { data: null, updatedAt: null });
  }));

  api.put('/data', requireAuth, h(async (req, res) => {
    const result = validateUserData((req.body || {}).data);
    if (!result.ok) return res.status(400).json({ error: 'Invalid data.' });
    const json = JSON.stringify(result.value);
    if (json.length > 100_000) return res.status(413).json({ error: 'Data too large.' });
    const now = Date.now();
    await db.run(
      `INSERT INTO user_data (user_id, json, updated_at) VALUES (?, ?, ?)
       ON CONFLICT(user_id) DO UPDATE SET json = excluded.json, updated_at = excluded.updated_at`,
      [req.user.id, json, now]
    );
    res.json({ ok: true, updatedAt: now });
  }));

  api.use((req, res) => res.status(404).json({ error: 'Not found.' }));
  app.use('/api', api);

  // ───────── Static app (production) ─────────
  if (distDir && fs.existsSync(path.join(distDir, 'index.html'))) {
    app.use(
      express.static(distDir, {
        index: false,
        setHeaders(res, file) {
          if (/(sw\.js|index\.html|manifest\.webmanifest|workbox-[^/]*\.js|registerSW\.js)$/.test(file)) res.setHeader('Cache-Control', 'no-cache');
          else if (file.includes(`${path.sep}assets${path.sep}`)) res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
          else if (file.includes(`${path.sep}food${path.sep}`)) res.setHeader('Cache-Control', 'public, max-age=604800');
        },
      })
    );
    app.get(/^\/(?!api\/).*/, (req, res) => {
      res.setHeader('Cache-Control', 'no-cache');
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    if (err.type === 'entity.too.large') return res.status(413).json({ error: 'Request too large.' });
    if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'Invalid request.' });
    console.error('Unhandled error:', err.message); // never log request bodies or passwords
    return res.status(500).json({ error: 'Something went wrong.' });
  });

  app.locals.sessions = sessions;
  return app;
}

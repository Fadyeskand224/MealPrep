// Run with: npm test
process.env.SCRYPT_N = '4096'; // fast hashing for tests only; production uses 32768

import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { openDb } from '../db.js';
import { createApp } from '../app.js';

async function boot({ prod = false, limits = { auth: 1000, signup: 1000, general: 100000 }, db: existing } = {}) {
  const db = existing ?? (await openDb({ url: ':memory:' }));
  const app = createApp({ db, prod, limits });
  const server = await new Promise((resolve) => {
    const s = app.listen(0, '127.0.0.1', () => resolve(s));
  });
  const port = server.address().port;
  const base = `http://127.0.0.1:${port}`;

  /** Minimal client. Sends a same-origin Origin header unless told otherwise. */
  function call(method, path, { body, cookie, headers = {}, origin = base, raw } = {}) {
    return new Promise((resolve, reject) => {
      const payload = raw ?? (body === undefined ? undefined : JSON.stringify(body));
      const h = { ...headers };
      if (payload !== undefined) {
        h['content-type'] = h['content-type'] ?? 'application/json';
        h['content-length'] = Buffer.byteLength(payload); // DELETE bodies need explicit framing in Node's client
      }
      if (cookie) h.cookie = cookie;
      if (origin) h.origin = origin;
      const req = http.request({ host: '127.0.0.1', port, method, path, headers: { ...h, connection: 'close' }, agent: false }, (res) => {
        let text = '';
        res.on('data', (c) => (text += c));
        res.on('end', () => {
          let json = null;
          try { json = JSON.parse(text); } catch { /* not json */ }
          const setCookie = res.headers['set-cookie'] || [];
          resolve({ status: res.statusCode, headers: res.headers, json, text, setCookie, cookie: setCookie[0]?.split(';')[0] });
        });
      });
      req.on('error', reject);
      if (payload !== undefined) req.write(payload);
      req.end();
    });
  }
  return { db, server, call, close: () => new Promise((r) => { server.close(r); server.closeAllConnections(); }) };
}

const USER = { name: 'Ada Lovelace', email: 'ada@example.com', password: 'correct-horse-battery' };
const signup = (t, u = USER) => t.call('POST', '/api/auth/signup', { body: { acceptTerms: true, ...u } });
const login = (t, email = USER.email, password = USER.password) => t.call('POST', '/api/auth/login', { body: { email, password } });

const GOOD_DATA = {
  plan: { createdAt: '2026-11-08', days: Array.from({ length: 7 }, () => ({ breakfast: 'b-1', lunch: 'l-1', dinner: 'd-1' })) },
  eaten: { '0:lunch': true }, pantry: ['eggs'], dislikes: [], favorites: ['b-1'], target: 1500, groceryChecked: { eggs: true },
  pantryExpiry: { eggs: '2026-11-20' }, expiryWarnDays: 3,
};

test('passwords are stored as salted scrypt hashes, never plaintext', async () => {
  const t = await boot();
  await signup(t);
  const row = (await t.db.get('SELECT password_hash FROM users'));
  assert.match(row.password_hash, /^scrypt\$\d+\$8\$3\$[A-Za-z0-9+/=]+\$[A-Za-z0-9+/=]+$/);
  assert.ok(!row.password_hash.includes(USER.password));
  // two accounts with the same password must get different hashes (unique salts)
  await signup(t, { name: 'Bob Builder', email: 'bob@example.com', password: USER.password });
  const hashes = (await t.db.all('SELECT password_hash FROM users')).map((r) => r.password_hash);
  assert.notEqual(hashes[0], hashes[1]);
  await t.close();
});

test('session tokens are stored only as hashes', async () => {
  const t = await boot();
  const res = await signup(t);
  const token = decodeURIComponent(res.cookie.split('=')[1]);
  const stored = (await t.db.get('SELECT token_hash FROM sessions')).token_hash;
  assert.notEqual(stored, token);
  assert.match(stored, /^[0-9a-f]{64}$/);
  assert.ok(token.length >= 40);
  await t.close();
});

test('session cookie is HttpOnly + SameSite=Lax, and Secure/__Host- in production', async () => {
  const dev = await boot();
  const r1 = await signup(dev);
  assert.match(r1.setCookie[0], /HttpOnly/i);
  assert.match(r1.setCookie[0], /SameSite=Lax/i);
  await dev.close();

  const prod = await boot({ prod: true });
  const r2 = await signup(prod);
  assert.match(r2.setCookie[0], /^__Host-sid=/);
  assert.match(r2.setCookie[0], /Secure/i);
  assert.match(r2.setCookie[0], /HttpOnly/i);
  assert.match(r2.setCookie[0], /Path=\//);
  assert.ok(!/Domain=/i.test(r2.setCookie[0]));
  assert.match(r2.headers['strict-transport-security'], /max-age=\d+/);
  await prod.close();
});

test('security headers: CSP, no fingerprinting, no caching of API responses', async () => {
  const t = await boot();
  const r = await t.call('GET', '/api/auth/me');
  assert.equal(r.headers['x-powered-by'], undefined);
  assert.equal(r.headers['cache-control'], 'no-store');
  assert.match(r.headers['content-security-policy'], /default-src 'self'/);
  assert.match(r.headers['content-security-policy'], /frame-ancestors 'none'/);
  assert.match(r.headers['content-security-policy'], /script-src 'self'(;|$)/);
  assert.equal(r.headers['x-content-type-options'], 'nosniff');
  assert.equal(r.headers['referrer-policy'], 'no-referrer');
  await t.close();
});

test('login failures are generic and identical for unknown emails and wrong passwords', async () => {
  const t = await boot();
  await signup(t);
  const wrongPw = await login(t, USER.email, 'not-the-password');
  const noUser = await login(t, 'nobody@example.com', 'not-the-password');
  assert.equal(wrongPw.status, 401);
  assert.equal(noUser.status, 401);
  assert.deepEqual(wrongPw.json, noUser.json);
  assert.equal(wrongPw.setCookie.length, 0);
  await t.close();
});

test('account lockout after repeated failures, identically for real and unknown emails', async () => {
  const t = await boot();
  await signup(t);
  for (const email of [USER.email, 'ghost@example.com']) {
    for (let i = 0; i < 5; i++) assert.equal((await login(t, email, 'wrong-wrong-wrong')).status, 401);
  }
  // even the CORRECT password is refused while locked
  const locked = await login(t, USER.email, USER.password);
  assert.equal(locked.status, 429);
  const ghost = await login(t, 'ghost@example.com', 'whatever-123');
  assert.equal(ghost.status, 429);
  assert.deepEqual(locked.json, ghost.json);
  await t.close();
});

test('IP rate limiting on signup and login', async () => {
  const t = await boot({ limits: { auth: 3, signup: 2, general: 100000 } });
  assert.equal((await signup(t, { ...USER, email: 'a1@example.com' })).status, 201);
  assert.equal((await signup(t, { ...USER, email: 'a2@example.com' })).status, 201);
  assert.equal((await signup(t, { ...USER, email: 'a3@example.com' })).status, 429);
  for (let i = 0; i < 3; i++) await login(t, 'a1@example.com', 'wrong-wrong-1');
  assert.equal((await login(t, 'a1@example.com', USER.password)).status, 429);
  await t.close();
});

test('protected routes reject missing, forged and header/query-supplied credentials', async () => {
  const t = await boot();
  const s = await signup(t);
  const token = decodeURIComponent(s.cookie.split('=')[1]);
  assert.equal((await t.call('GET', '/api/auth/me')).status, 401);
  assert.equal((await t.call('GET', '/api/data')).status, 401);
  assert.equal((await t.call('GET', '/api/auth/me', { cookie: 'sid=forged-token-forged-token-forged' })).status, 401);
  assert.equal((await t.call('GET', `/api/auth/me?sid=${token}`)).status, 401);
  assert.equal((await t.call('GET', '/api/auth/me', { headers: { authorization: `Bearer ${token}` } })).status, 401);
  assert.equal((await t.call('GET', '/api/auth/me', { cookie: s.cookie })).status, 200);
  await t.close();
});

test('logout destroys the session server-side (a stolen cookie stops working)', async () => {
  const t = await boot();
  const s = await signup(t);
  assert.equal((await t.call('GET', '/api/auth/me', { cookie: s.cookie })).status, 200);
  await t.call('POST', '/api/auth/logout', { cookie: s.cookie });
  assert.equal((await t.call('GET', '/api/auth/me', { cookie: s.cookie })).status, 401);
  assert.equal((await t.db.get('SELECT COUNT(*) c FROM sessions')).c, 0);
  await t.close();
});

test('expired sessions are rejected', async () => {
  const t = await boot();
  const s = await signup(t);
  await t.db.run('UPDATE sessions SET expires_at = ?', [Date.now() - 1000]);
  assert.equal((await t.call('GET', '/api/auth/me', { cookie: s.cookie })).status, 401);
  await t.close();
});

test('CSRF: cross-origin and origin-less state-changing requests are refused', async () => {
  const t = await boot();
  const s = await signup(t);
  const evil = await t.call('POST', '/api/auth/logout', { cookie: s.cookie, origin: 'https://evil.example' });
  assert.equal(evil.status, 403);
  const none = await t.call('POST', '/api/auth/logout', { cookie: s.cookie, origin: null });
  assert.equal(none.status, 403);
  const evilLogin = await t.call('POST', '/api/auth/login', { body: { email: USER.email, password: USER.password }, origin: 'https://evil.example' });
  assert.equal(evilLogin.status, 403);
  // the session survived the forged logout
  assert.equal((await t.call('GET', '/api/auth/me', { cookie: s.cookie })).status, 200);
  // a form-style (non-JSON) body is not accepted either
  const form = await t.call('POST', '/api/auth/login', { raw: 'email=a&password=b', headers: { 'content-type': 'application/x-www-form-urlencoded' } });
  assert.equal(form.status, 400);
  await t.close();
});

test('input validation and password policy', async () => {
  const t = await boot();
  const bad = async (body) => (await t.call('POST', '/api/auth/signup', { body: { acceptTerms: true, ...body } })).status;
  assert.equal(await bad({ name: '', email: 'x@example.com', password: 'long-enough-pw' }), 400);
  assert.equal(await bad({ name: 'X', email: 'not-an-email', password: 'long-enough-pw' }), 400);
  assert.equal(await bad({ name: 'X', email: 'x@example.com', password: 'short' }), 400);
  assert.equal(await bad({ name: 'X', email: 'x@example.com', password: 'password123' }), 400);
  assert.equal(await bad({ name: 'X', email: 'x@example.com', password: 'a'.repeat(129) }), 400);
  assert.equal(await bad({ name: 'Grace Hopper', email: 'grace.hopper@example.com', password: 'grace.hopper-1' }), 400); // contains email
  assert.equal(await bad({ name: { $ne: 1 }, email: 'x@example.com', password: 'long-enough-pw' }), 400);
  assert.equal(await bad({ name: 'X', email: ['x@example.com'], password: 'long-enough-pw' }), 400);
  assert.equal(await bad({ name: 'X', email: 'x@example.com', password: 12345678 }), 400);
  assert.equal((await t.db.get('SELECT COUNT(*) c FROM users')).c, 0);
  // duplicates (case-insensitive)
  assert.equal(await bad({ ...USER }), 201);
  assert.equal(await bad({ ...USER, email: 'ADA@Example.com' }), 409);
  await t.close();
});

test('SQL injection strings are treated as plain data', async () => {
  const t = await boot();
  await signup(t);
  const r = await login(t, "' OR '1'='1' --", "' OR '1'='1' --");
  assert.equal(r.status, 401);
  const r2 = await login(t, `${USER.email}' --`, 'x');
  assert.equal(r2.status, 401);
  assert.equal((await t.db.get('SELECT COUNT(*) c FROM users')).c, 1);
  await t.close();
});

test('user data: round-trips, is private per user, and rejects hostile payloads', async () => {
  const t = await boot();
  const a = await signup(t);
  const b = await signup(t, { name: 'Bob Builder', email: 'bob@example.com', password: 'another-strong-pw' });

  assert.deepEqual((await t.call('GET', '/api/data', { cookie: a.cookie })).json, { data: null, updatedAt: null });
  assert.equal((await t.call('PUT', '/api/data', { cookie: a.cookie, body: { data: GOOD_DATA } })).status, 200);
  assert.deepEqual((await t.call('GET', '/api/data', { cookie: a.cookie })).json.data, GOOD_DATA);
  // Bob never sees Ada's data
  assert.equal((await t.call('GET', '/api/data', { cookie: b.cookie })).json.data, null);

  const put = async (data) => (await t.call('PUT', '/api/data', { cookie: a.cookie, body: { data } })).status;
  assert.equal(await put({ ...GOOD_DATA, isAdmin: true }), 400);                       // unknown key
  assert.equal(await put({ ...GOOD_DATA, target: 'lots' }), 400);                      // wrong type
  assert.equal(await put({ ...GOOD_DATA, target: 99999 }), 400);                       // out of range
  assert.equal(await put({ ...GOOD_DATA, pantry: Array(500).fill('x') }), 400);        // too many
  assert.equal(await put({ ...GOOD_DATA, pantry: ['a'.repeat(500)] }), 400);           // too long
  assert.equal(await put({ ...GOOD_DATA, plan: { createdAt: 'yesterday', days: [] } }), 400);
  assert.equal(await put({ ...GOOD_DATA, groceryChecked: { x: 'yes' } }), 400);
  assert.equal(await put(null), 400);
  assert.equal(await put([GOOD_DATA]), 400);
  const proto = await t.call('PUT', '/api/data', { cookie: a.cookie, raw: '{"data":{"target":1500,"pantry":[],"dislikes":[],"favorites":[],"groceryChecked":{"__proto__":true},"eaten":{},"plan":null}}' });
  assert.equal(proto.status, 400);
  assert.equal({}.polluted, undefined);
  const huge = await t.call('PUT', '/api/data', { cookie: a.cookie, raw: JSON.stringify({ data: { ...GOOD_DATA, pantry: ['x'.repeat(60)].concat(Array(190).fill('y'.repeat(60))), junk: 'z'.repeat(200000) } }) });
  assert.equal(huge.status, 413);
  // stored data is untouched by the rejected writes
  assert.deepEqual((await t.call('GET', '/api/data', { cookie: a.cookie })).json.data, GOOD_DATA);
  await t.close();
});

test('changing password: needs the current one, signs out other devices, old password dies', async () => {
  const t = await boot();
  const phone = await signup(t);
  const laptop = await login(t);
  assert.equal((await t.call('GET', '/api/auth/me', { cookie: laptop.cookie })).status, 200);

  const wrong = await t.call('POST', '/api/auth/password', { cookie: phone.cookie, body: { currentPassword: 'nope-nope-nope', newPassword: 'brand-new-secret-1' } });
  assert.equal(wrong.status, 401);
  const weak = await t.call('POST', '/api/auth/password', { cookie: phone.cookie, body: { currentPassword: USER.password, newPassword: 'password123' } });
  assert.equal(weak.status, 400);

  const ok = await t.call('POST', '/api/auth/password', { cookie: phone.cookie, body: { currentPassword: USER.password, newPassword: 'brand-new-secret-1' } });
  assert.equal(ok.status, 200);
  assert.ok(ok.cookie && ok.cookie !== phone.cookie, 'session is rotated');
  assert.equal((await t.call('GET', '/api/auth/me', { cookie: laptop.cookie })).status, 401, 'other devices signed out');
  assert.equal((await t.call('GET', '/api/auth/me', { cookie: phone.cookie })).status, 401, 'old session token dead');
  assert.equal((await t.call('GET', '/api/auth/me', { cookie: ok.cookie })).status, 200);
  assert.equal((await login(t, USER.email, USER.password)).status, 401);
  assert.equal((await login(t, USER.email, 'brand-new-secret-1')).status, 200);
  await t.close();
});

test('password-guessing through the change-password endpoint is locked out too', async () => {
  const t = await boot();
  const s = await signup(t);
  for (let i = 0; i < 5; i++) {
    const r = await t.call('POST', '/api/auth/password', { cookie: s.cookie, body: { currentPassword: 'wrong-wrong-1', newPassword: 'brand-new-secret-1' } });
    assert.equal(r.status, 401);
  }
  const r = await t.call('POST', '/api/auth/password', { cookie: s.cookie, body: { currentPassword: USER.password, newPassword: 'brand-new-secret-1' } });
  assert.equal(r.status, 429);
  await t.close();
});

test('deleting an account requires the password and erases all of its data', async () => {
  const t = await boot();
  const s = await signup(t);
  await t.call('PUT', '/api/data', { cookie: s.cookie, body: { data: GOOD_DATA } });
  const wrong = await t.call('DELETE', '/api/auth/account', { cookie: s.cookie, body: { password: 'wrong-wrong-1' } });
  assert.equal(wrong.status, 401);
  assert.equal((await t.db.get('SELECT COUNT(*) c FROM users')).c, 1);

  const ok = await t.call('DELETE', '/api/auth/account', { cookie: s.cookie, body: { password: USER.password } });
  assert.equal(ok.status, 200);
  for (const table of ['users', 'sessions', 'user_data']) assert.equal((await t.db.get(`SELECT COUNT(*) c FROM ${table}`)).c, 0, table);
  assert.equal((await login(t)).status, 401);
  assert.equal((await t.call('GET', '/api/auth/me', { cookie: s.cookie })).status, 401);
  await t.close();
});

test('errors do not leak internals', async () => {
  const t = await boot();
  const bad = await t.call('POST', '/api/auth/login', { raw: '{"email": ', headers: { 'content-type': 'application/json' } });
  assert.equal(bad.status, 400);
  assert.ok(!/at .*\.js|node_modules|SQLITE|stack/i.test(bad.text));
  const nf = await t.call('GET', '/api/does-not-exist');
  assert.equal(nf.status, 404);
  assert.ok(!/express|Cannot GET/i.test(nf.text));
  await t.close();
});

test('lockout state survives a server restart (it lives in the database)', async () => {
  const t = await boot();
  await signup(t);
  for (let i = 0; i < 5; i++) await login(t, USER.email, 'wrong-wrong-wrong');
  // "restart": a brand-new app instance on the same database
  const t2 = await boot({ db: t.db });
  assert.equal((await login(t2, USER.email, USER.password)).status, 429, 'still locked after restart');
  await t2.close();
  await t.close();
});

test('lockout counters never store plaintext emails', async () => {
  const t = await boot();
  await login(t, 'secret.person@example.com', 'wrong-wrong-wrong');
  const rows = await t.db.all('SELECT key FROM attempts');
  assert.equal(rows.length, 1);
  assert.match(rows[0].key, /^[0-9a-f]{64}$/);
  assert.ok(!JSON.stringify(rows).includes('secret.person'));
  await t.close();
});

test('lockout expires after the lock period', async () => {
  const t = await boot();
  await signup(t);
  for (let i = 0; i < 5; i++) await login(t, USER.email, 'wrong-wrong-wrong');
  assert.equal((await login(t, USER.email, USER.password)).status, 429);
  await t.db.run('UPDATE attempts SET locked_until = ?', [Date.now() - 1000]); // time passes
  assert.equal((await login(t, USER.email, USER.password)).status, 200);
  await t.close();
});

test('signup requires explicit acceptance of the Terms and records the consent', async () => {
  const t = await boot();
  for (const acceptTerms of [undefined, false, 'true', 1, null]) {
    const r = await t.call('POST', '/api/auth/signup', { body: { ...USER, acceptTerms } });
    assert.equal(r.status, 400, `acceptTerms=${String(acceptTerms)} must be refused`);
  }
  assert.equal((await t.db.get('SELECT COUNT(*) c FROM users')).c, 0, 'no account without consent');

  const before = Date.now();
  assert.equal((await signup(t)).status, 201);
  const u = await t.db.get('SELECT terms_accepted_at, terms_version FROM users');
  assert.ok(u.terms_accepted_at >= before && u.terms_accepted_at <= Date.now());
  assert.match(u.terms_version, /^\d{4}-\d{2}-\d{2}$/);
  await t.close();
});

test('data export: login required, only your own data, never the password hash', async () => {
  const t = await boot();
  const a = await signup(t);
  const b = await signup(t, { name: 'Bob Builder', email: 'bob@example.com', password: 'another-strong-pw' });
  await t.call('PUT', '/api/data', { cookie: a.cookie, body: { data: GOOD_DATA } });

  assert.equal((await t.call('GET', '/api/auth/export')).status, 401);

  const mine = await t.call('GET', '/api/auth/export', { cookie: a.cookie });
  assert.equal(mine.status, 200);
  assert.match(mine.headers['content-disposition'], /attachment/);
  assert.equal(mine.json.account.email, USER.email);
  assert.deepEqual(mine.json.data, GOOD_DATA);
  assert.ok(mine.json.account.acceptedTermsAt);
  assert.ok(!/scrypt|password_hash|\$/.test(JSON.stringify(mine.json)), 'no password material in the export');

  const bobs = await t.call('GET', '/api/auth/export', { cookie: b.cookie });
  assert.equal(bobs.json.account.email, 'bob@example.com');
  assert.equal(bobs.json.data, null, "Bob never receives Ada's data");
  await t.close();
});

test('existing databases are upgraded in place with the consent columns', async () => {
  const { createClient } = await import('@libsql/client');
  const file = `file:${process.env.TMPDIR || '/tmp'}/emsmeals-migrate-${process.pid}.db`;
  const old = createClient({ url: file });
  await old.execute('CREATE TABLE users (id INTEGER PRIMARY KEY, email TEXT NOT NULL UNIQUE, name TEXT NOT NULL, password_hash TEXT NOT NULL, created_at INTEGER NOT NULL)');
  await old.execute("INSERT INTO users (email, name, password_hash, created_at) VALUES ('old@example.com', 'Old', 'x', 1)");
  old.close();
  const db = await openDb({ url: file });
  const cols = (await db.all('PRAGMA table_info(users)')).map((c) => c.name);
  assert.ok(cols.includes('terms_accepted_at') && cols.includes('terms_version'));
  assert.equal((await db.get('SELECT COUNT(*) c FROM users')).c, 1, 'existing rows survive');
  db.close();
});

test('pantry expiry data: valid dates are stored, bad ones and hostile keys are rejected', async () => {
  const t = await boot();
  const a = await signup(t);
  const put = async (patch) => (await t.call('PUT', '/api/data', { cookie: a.cookie, body: { data: { ...GOOD_DATA, ...patch } } })).status;

  assert.equal(await put({ pantryExpiry: { eggs: '2026-11-20', milk: '2028-02-29' }, expiryWarnDays: 5 }), 200);
  const stored = (await t.call('GET', '/api/data', { cookie: a.cookie })).json.data;
  assert.deepEqual(stored.pantryExpiry, { eggs: '2026-11-20', milk: '2028-02-29' });
  assert.equal(stored.expiryWarnDays, 5);

  for (const bad of ['2026-02-30', '2026-13-01', 'tomorrow', '2026-11-08T10:00:00Z', '11/08/2026', '1999-01-01', '2101-01-01', "'; DROP TABLE users;--", 20261108, null, ['2026-11-08']]) {
    assert.equal(await put({ pantryExpiry: { eggs: bad } }), 400, `${JSON.stringify(bad)} must be rejected`);
  }
  assert.equal(await put({ pantryExpiry: ['2026-11-08'] }), 400);
  assert.equal(await put({ pantryExpiry: 'soon' }), 400);
  assert.equal(await put({ pantryExpiry: null }), 400);
  assert.equal(await put({ pantryExpiry: { ['x'.repeat(100)]: '2026-11-08' } }), 400, 'overlong item name');
  assert.equal(await put({ pantryExpiry: Object.fromEntries(Array.from({ length: 250 }, (_, i) => [`item${i}`, '2026-11-08'])) }), 400, 'too many entries');
  const proto = await t.call('PUT', '/api/data', { cookie: a.cookie, raw: JSON.stringify({ data: { ...GOOD_DATA } }).replace('"pantryExpiry":{', '"pantryExpiry":{"__proto__":"2026-11-08",') });
  assert.equal(proto.status, 400);
  assert.equal({}.polluted, undefined);
  for (const w of [0, 15, 2.5, '3', null]) assert.equal(await put({ expiryWarnDays: w }), 400, `warn days ${JSON.stringify(w)} must be rejected`);

  // rejected writes left the earlier good data untouched
  assert.deepEqual((await t.call('GET', '/api/data', { cookie: a.cookie })).json.data.pantryExpiry, { eggs: '2026-11-20', milk: '2028-02-29' });
  await t.close();
});

test('older clients without the expiry fields still work and get safe defaults', async () => {
  const t = await boot();
  const a = await signup(t);
  const { pantryExpiry, expiryWarnDays, ...legacy } = GOOD_DATA; // what an old app version sends
  assert.equal((await t.call('PUT', '/api/data', { cookie: a.cookie, body: { data: legacy } })).status, 200);
  const stored = (await t.call('GET', '/api/data', { cookie: a.cookie })).json.data;
  assert.deepEqual(stored.pantryExpiry, {});
  assert.equal(stored.expiryWarnDays, 3);
  await t.close();
});

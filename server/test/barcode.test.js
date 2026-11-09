// Barcode lookup endpoint. Run with: npm test
import './env.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { openDb } from '../db.js';
import { createApp } from '../app.js';
import { isValidBarcode, shapeProduct, shapeNutrition } from '../barcode.js';

/** A stand-in for Open Food Facts that records every request. */
function fakeOff(handler) {
  const calls = [];
  const fetchImpl = async (url, opts) => {
    calls.push({ url, opts });
    const r = await handler(url, opts);
    return { status: r.status ?? 200, ok: (r.status ?? 200) < 400, text: async () => (typeof r.body === 'string' ? r.body : JSON.stringify(r.body)) };
  };
  return { fetchImpl, calls };
}
const offHit = (extra = {}) => ({ body: { status: 1, product: { product_name: 'Spaghetti Nº5', generic_name: 'Spaghetti', brands: 'Barilla', categories_tags: ['en:pastas', 'fr:pates'], quantity: '500 g', ...extra } } });
const offMiss = { body: { status: 0, product: {} } };

async function boot({ handler = () => offHit(), limits = { auth: 1000, signup: 1000, general: 100000, barcode: 1000 }, now } = {}) {
  const db = await openDb({ url: ':memory:' });
  const off = fakeOff(handler);
  const app = createApp({ db, limits, fetchImpl: off.fetchImpl });
  const server = await new Promise((r) => { const s = app.listen(0, '127.0.0.1', () => r(s)); });
  const port = server.address().port;
  const base = `http://127.0.0.1:${port}`;
  const call = (method, path, { body, cookie } = {}) =>
    new Promise((resolve, reject) => {
      const payload = body === undefined ? undefined : JSON.stringify(body);
      const headers = { origin: base, connection: 'close' };
      if (payload) Object.assign(headers, { 'content-type': 'application/json', 'content-length': Buffer.byteLength(payload) });
      if (cookie) headers.cookie = cookie;
      const req = http.request({ host: '127.0.0.1', port, method, path, headers, agent: false }, (res) => {
        let text = '';
        res.on('data', (c) => (text += c));
        res.on('end', () => {
          let json = null; try { json = JSON.parse(text); } catch { /* not json */ }
          resolve({ status: res.statusCode, json, text, cookie: (res.headers['set-cookie'] || [])[0]?.split(';')[0] });
        });
      });
      req.on('error', reject);
      if (payload) req.write(payload);
      req.end();
    });
  const signup = await call('POST', '/api/auth/signup', { body: { name: 'Scan Tester', email: 'scan@example.com', password: 'correct-horse-battery', acceptTerms: true } });
  return { db, off, call, cookie: signup.cookie, close: () => new Promise((r) => { server.close(r); server.closeAllConnections(); }) };
}

const GOOD = '3017620422003';

test('barcode check digits: real codes pass, misreads and junk fail', () => {
  for (const ok of ['3017620422003', '8076800195057', '016000275683', '0016000275683', '96385074', '5449000000996']) assert.equal(isValidBarcode(ok), true, ok);
  for (const bad of ['3017620422004', '8076800195058', '016000275684', '96385075', '1234567', '123456789', '12345678901', '123456789012345', 'abcdefghijklm', '30176204220O3', '', null, undefined, 3017620422003, '3017620422003 ', '../../etc/passwd']) {
    assert.equal(isValidBarcode(bad), false, String(bad));
  }
});

test('shapeProduct keeps only bounded plain fields and drops unusable products', () => {
  const p = shapeProduct(GOOD, { product_name: 'Nutella<script>alert(1)</script>\u0000', generic_name: 'x'.repeat(500), brands: 'Ferrero', categories_tags: ['en:spreads', 'fr:pates', 42, null, 'en:sweet-spreads'], quantity: '400 g', evil: 'ignored', __proto__: { x: 1 } });
  assert.ok(!/[<>\u0000]/.test(p.name));
  assert.equal(p.genericName.length, 120);
  assert.deepEqual(p.categories, ['spreads', 'sweet spreads'], 'only English tags, hyphens turned into spaces');
  assert.deepEqual(Object.keys(p).sort(), ['brands', 'categories', 'code', 'genericName', 'name', 'nutrition', 'quantity']);
  assert.equal(shapeProduct(GOOD, { product_name: '', generic_name: '' }), null, 'no usable name means not found');
  assert.equal(shapeProduct(GOOD, null), null);
  assert.equal(shapeProduct(GOOD, 'string'), null);
});

test('lookup requires login, and rejects invalid codes without calling the product database', async () => {
  const t = await boot();
  assert.equal((await t.call('GET', `/api/barcode/${GOOD}`)).status, 401);
  for (const bad of ['3017620422004', '123', 'abcdefghijklm', '..%2F..%2Fetc%2Fpasswd', `${GOOD}%00`, '3017620422003%20', 'x'.repeat(300)]) {
    const r = await t.call('GET', `/api/barcode/${bad}`, { cookie: t.cookie });
    assert.ok([400, 404].includes(r.status), `${bad} -> ${r.status}`);
  }
  assert.equal(t.off.calls.length, 0, 'nothing invalid ever reaches the outside world');
  await t.close();
});

test('a known product is returned in a clean shape, and only our fixed host is contacted', async () => {
  const t = await boot();
  const r = await t.call('GET', `/api/barcode/${GOOD}`, { cookie: t.cookie });
  assert.equal(r.status, 200);
  assert.equal(r.json.found, true);
  assert.deepEqual(r.json.product, { code: GOOD, name: 'Spaghetti Nº5', genericName: 'Spaghetti', brands: 'Barilla', categories: ['pastas'], quantity: '500 g', nutrition: null });
  assert.equal(t.off.calls.length, 1);
  const { url, opts } = t.off.calls[0];
  assert.ok(url.startsWith('https://world.openfoodfacts.org/api/v2/product/3017620422003.json?fields='), url);
  assert.match(opts.headers['User-Agent'], /^EmsMeals\/1\.0 \(\+https:\/\//);
  assert.ok(!JSON.stringify(opts).includes('scan@example.com'), 'no user details are sent upstream');
  assert.ok(!JSON.stringify(opts.headers).toLowerCase().includes('cookie'), 'no cookies are forwarded');
  await t.close();
});

test('results are cached: repeat scans do not call the product database again', async () => {
  const t = await boot();
  await t.call('GET', `/api/barcode/${GOOD}`, { cookie: t.cookie });
  const again = await t.call('GET', `/api/barcode/${GOOD}`, { cookie: t.cookie });
  assert.equal(again.json.found, true);
  assert.equal(t.off.calls.length, 1);
  // a stale entry (older than 30 days) is refreshed
  await t.db.run('UPDATE barcodes SET fetched_at = ?', [Date.now() - 31 * 86400000]);
  await t.call('GET', `/api/barcode/${GOOD}`, { cookie: t.cookie });
  assert.equal(t.off.calls.length, 2);
  await t.close();
});

test('unknown products return found:false, are cached briefly, and are retried after a day', async () => {
  const t = await boot({ handler: () => offMiss });
  const r = await t.call('GET', `/api/barcode/${GOOD}`, { cookie: t.cookie });
  assert.deepEqual(r.json, { found: false });
  await t.call('GET', `/api/barcode/${GOOD}`, { cookie: t.cookie });
  assert.equal(t.off.calls.length, 1, 'negative result cached');
  await t.db.run('UPDATE barcodes SET fetched_at = ?', [Date.now() - 2 * 86400000]);
  await t.call('GET', `/api/barcode/${GOOD}`, { cookie: t.cookie });
  assert.equal(t.off.calls.length, 2, 'retried after the negative cache expires');
  await t.close();
});

test('a 12-digit UPC-A falls back to the 13-digit EAN form used by the database', async () => {
  const t = await boot({ handler: (url) => (url.includes('/0016000275683.json') ? offHit({ product_name: 'Cheerios', generic_name: '' }) : offMiss) });
  const r = await t.call('GET', '/api/barcode/016000275683', { cookie: t.cookie });
  assert.equal(r.json.found, true);
  assert.equal(r.json.product.name, 'Cheerios');
  assert.equal(r.json.product.code, '016000275683', 'the code the user scanned is echoed back');
  assert.deepEqual(t.off.calls.map((c) => c.url.match(/product\/(\d+)\.json/)[1]), ['016000275683', '0016000275683']);
  await t.close();
});

test('when the product database is down: 502, friendly message, nothing cached, no internals leaked', async () => {
  let mode = 'down';
  const t = await boot({ handler: () => (mode === 'down' ? { status: 503, body: 'upstream exploded: secret-stack-trace' } : offHit()) });
  const down = await t.call('GET', `/api/barcode/${GOOD}`, { cookie: t.cookie });
  assert.equal(down.status, 502);
  assert.match(down.json.error, /type the item name/);
  assert.ok(!/exploded|secret|stack/i.test(down.text));
  assert.equal((await t.db.get('SELECT COUNT(*) c FROM barcodes')).c, 0, 'outages are not cached');
  mode = 'up';
  assert.equal((await t.call('GET', `/api/barcode/${GOOD}`, { cookie: t.cookie })).json.found, true, 'recovers on the next scan');
  await t.close();
});

test('garbage, oversized and slow upstream responses become a clean 502', async () => {
  for (const handler of [
    () => ({ body: '<html>not json</html>' }),
    () => ({ body: 'x'.repeat(600_000) }),
    () => { throw new Error('network down'); },
    () => new Promise(() => {}), // never answers
  ]) {
    const db = await openDb({ url: ':memory:' });
    const off = fakeOff(handler);
    const { createBarcodeLookup, UpstreamError } = await import('../barcode.js');
    const lookup = createBarcodeLookup({ db, fetchImpl: off.fetchImpl, timeoutMs: 50 });
    await assert.rejects(lookup.lookup(GOOD), (e) => e instanceof UpstreamError || /timeout/.test(String(e)));
  }
});

test('hostile product data is sanitised before it reaches the client', async () => {
  const t = await boot({ handler: () => offHit({ product_name: '<img src=x onerror=alert(1)> Evil\u0007\nName', brands: '"><script>x</script>', categories_tags: ['en:ok', 'en:<b>bad</b>'] }) });
  const r = await t.call('GET', `/api/barcode/${GOOD}`, { cookie: t.cookie });
  assert.ok(!/[<>]/.test(JSON.stringify(r.json)), 'no angle brackets survive');
  assert.ok(!/[\u0000-\u001f]/.test(r.json.product.name));
  await t.close();
});

test('lookups are rate limited', async () => {
  const t = await boot({ limits: { auth: 1000, signup: 1000, general: 100000, barcode: 3 } });
  const statuses = [];
  for (let i = 0; i < 5; i++) statuses.push((await t.call('GET', `/api/barcode/${GOOD}`, { cookie: t.cookie })).status);
  assert.deepEqual(statuses, [200, 200, 200, 429, 429]);
  await t.close();
});

test('nutrition facts: real products pass through, nonsense is dropped', () => {
  // Barilla spaghetti, exactly as Open Food Facts returned it
  assert.deepEqual(shapeNutrition({ nutriments: { 'energy-kcal_100g': 359, 'energy_100g': 1521, proteins_100g: 13, carbohydrates_100g: 71, fat_100g: 2, fiber_100g: 3 } }), { kcal: 359, protein: 13, carbs: 71, fat: 2 });
  // only kilojoules given: converted
  assert.deepEqual(shapeNutrition({ nutriments: { energy_100g: 1521, proteins_100g: 13, carbohydrates_100g: 71, fat_100g: 2 } }), { kcal: 363.5, protein: 13, carbs: 71, fat: 2 });
  // numbers as strings are accepted
  assert.equal(shapeNutrition({ nutriments: { 'energy-kcal_100g': '42.4', proteins_100g: '0', carbohydrates_100g: '10.6', fat_100g: '0' } }).kcal, 42.4);
  const bad = [
    null, {}, { nutriments: null }, { nutriments: {} },
    { nutriments: { 'energy-kcal_100g': 359, proteins_100g: 13, carbohydrates_100g: 71 } },                       // fat missing
    { nutriments: { 'energy-kcal_100g': 359, proteins_100g: 13, carbohydrates_100g: 71, fat_100g: 'lots' } },    // not a number
    { nutriments: { 'energy-kcal_100g': 5000, proteins_100g: 10, carbohydrates_100g: 10, fat_100g: 10 } },       // impossible calories
    { nutriments: { 'energy-kcal_100g': 359, proteins_100g: 60, carbohydrates_100g: 60, fat_100g: 20 } },        // over 100 g per 100 g
    { nutriments: { 'energy-kcal_100g': 50, proteins_100g: 13, carbohydrates_100g: 71, fat_100g: 2 } },          // calories contradict macros
    { nutriments: { 'energy-kcal_100g': -1, proteins_100g: 1, carbohydrates_100g: 1, fat_100g: 1 } },
    { nutriments: { 'energy-kcal_100g': Infinity, proteins_100g: 1, carbohydrates_100g: 1, fat_100g: 1 } },
  ];
  for (const b of bad) assert.equal(shapeNutrition(b), null, JSON.stringify(b));
});

test('the lookup returns nutrition, and older cached entries without it are refreshed once', async () => {
  const t = await boot({ handler: () => offHit({ nutriments: { 'energy-kcal_100g': 359, proteins_100g: 13, carbohydrates_100g: 71, fat_100g: 2 } }) });
  // an entry cached by the previous version of the app (no nutrition key)
  await t.db.run('INSERT INTO barcodes (code, json, fetched_at) VALUES (?, ?, ?)', [GOOD, JSON.stringify({ code: GOOD, name: 'Spaghetti', genericName: '', brands: '', categories: [], quantity: '' }), Date.now()]);
  const r = await t.call('GET', `/api/barcode/${GOOD}`, { cookie: t.cookie });
  assert.deepEqual(r.json.product.nutrition, { kcal: 359, protein: 13, carbs: 71, fat: 2 });
  assert.equal(t.off.calls.length, 1, 'refreshed because the cached copy had no nutrition');
  await t.call('GET', `/api/barcode/${GOOD}`, { cookie: t.cookie });
  assert.equal(t.off.calls.length, 1, 'and cached again afterwards');
  await t.close();
});

import { LEGAL } from '../src/legal/config.js';
import { isValidBarcode } from '../src/lib/barcodeFormat.js';

// Product lookups go through our server (never straight from the phone) so users' IP addresses
// aren't shared with the product database and we can cache and rate-limit.
// Data: Open Food Facts (https://world.openfoodfacts.org), licensed under the ODbL.
const BASE = 'https://world.openfoodfacts.org/api/v2/product/';
const FIELDS = 'code,product_name,generic_name,brands,categories_tags,quantity,nutriments';
const USER_AGENT = `EmsMeals/1.0 (+${LEGAL.siteUrl})`;

const DAY = 86400000;
const FOUND_TTL = 30 * DAY;
const MISSING_TTL = 1 * DAY; // products get added to the database over time, so retry soon

export class UpstreamError extends Error {}

export { isValidBarcode };

const clean = (v, max) =>
  typeof v === 'string' ? v.replace(/[\u0000-\u001f\u007f<>]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max) : '';

const num = (v) => {
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  if (typeof v === 'string' && v.trim() !== '' && Number.isFinite(Number(v))) return Number(v);
  return null;
};
const round1 = (x) => Math.round(x * 10) / 10;

/**
 * Per-100 g calories, protein, carbs and fat, or null when the data is missing or doesn't add up.
 * The database is crowd-sourced, so numbers that contradict each other are dropped rather than trusted.
 */
export function shapeNutrition(raw) {
  const n = raw && typeof raw === 'object' ? raw.nutriments : null;
  if (!n || typeof n !== 'object') return null;
  let kcal = num(n['energy-kcal_100g']);
  if (kcal === null) {
    const kj = num(n['energy-kj_100g']) ?? num(n.energy_100g);
    if (kj !== null) kcal = kj / 4.184;
  }
  const protein = num(n.proteins_100g);
  const carbs = num(n.carbohydrates_100g);
  const fat = num(n.fat_100g);
  if ([kcal, protein, carbs, fat].some((x) => x === null)) return null;
  if (kcal < 0 || kcal > 900 || protein < 0 || carbs < 0 || fat < 0 || protein > 100 || carbs > 100 || fat > 100 || protein + carbs + fat > 101) return null;
  // Fibre and alcohol make the maths imperfect, so only clear contradictions are rejected.
  if (Math.abs(protein * 4 + carbs * 4 + fat * 9 - kcal) > Math.max(30, kcal * 0.4)) return null;
  return { kcal: round1(kcal), protein: round1(protein), carbs: round1(carbs), fat: round1(fat) };
}

/** Keep only the few fields we need, as plain bounded strings (never trust the upstream shape). */
export function shapeProduct(code, raw) {
  if (!raw || typeof raw !== 'object') return null;
  const name = clean(raw.product_name, 120);
  const genericName = clean(raw.generic_name, 120);
  if (!name && !genericName) return null;
  const categories = (Array.isArray(raw.categories_tags) ? raw.categories_tags : [])
    .filter((c) => typeof c === 'string' && c.startsWith('en:'))
    .slice(0, 12)
    .map((c) => clean(c.slice(3).replace(/-/g, ' '), 60))
    .filter(Boolean);
  return { code, name, genericName, brands: clean(raw.brands, 120), categories, quantity: clean(raw.quantity, 40), nutrition: shapeNutrition(raw) };
}

export function createBarcodeLookup({ db, fetchImpl = globalThis.fetch, now = Date.now, timeoutMs = 6000 } = {}) {
  async function fetchOne(code) {
    const ctrl = new AbortController();
    let timer;
    // A hard deadline that does not depend on the HTTP client honouring the abort signal.
    const deadline = new Promise((_, reject) => {
      timer = setTimeout(() => {
        ctrl.abort();
        reject(new UpstreamError('timeout'));
      }, timeoutMs);
    });
    const work = (async () => {
      try {
        const res = await fetchImpl(`${BASE}${code}.json?fields=${FIELDS}`, {
          headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
          signal: ctrl.signal,
        });
        if (res.status === 404) return null;
        if (!res.ok) throw new UpstreamError(`status ${res.status}`);
        const text = await res.text();
        if (text.length > 500_000) throw new UpstreamError('response too large');
        const body = JSON.parse(text);
        return body && body.status === 1 ? shapeProduct(code, body.product) : null;
      } catch (e) {
        throw e instanceof UpstreamError ? e : new UpstreamError(e.name === 'AbortError' ? 'timeout' : 'request failed');
      }
    })();
    work.catch(() => {}); // if the deadline wins, don't leave an unhandled rejection behind
    try {
      return await Promise.race([work, deadline]);
    } finally {
      clearTimeout(timer);
    }
  }

  return {
    /** Returns { found: true, product } or { found: false }. Throws UpstreamError if the database can't be reached. */
    async lookup(code) {
      const cached = await db.get('SELECT json, fetched_at FROM barcodes WHERE code = ?', [code]);
      if (cached) {
        const ttl = cached.json === 'null' ? MISSING_TTL : FOUND_TTL;
        const product = JSON.parse(cached.json);
        // Entries saved before nutrition was captured have no `nutrition` key; fetch those again once.
        const stale = product && !('nutrition' in product);
        if (!stale && now() - cached.fetched_at < ttl) {
          return product ? { found: true, product } : { found: false };
        }
      }
      // A 12-digit UPC-A is stored as a 13-digit EAN with a leading zero.
      let product = await fetchOne(code);
      if (!product && code.length === 12) product = await fetchOne(`0${code}`);
      await db.run(
        `INSERT INTO barcodes (code, json, fetched_at) VALUES (?, ?, ?)
         ON CONFLICT(code) DO UPDATE SET json = excluded.json, fetched_at = excluded.fetched_at`,
        [code, JSON.stringify(product), now()]
      );
      return product ? { found: true, product: { ...product, code } } : { found: false };
    },
  };
}

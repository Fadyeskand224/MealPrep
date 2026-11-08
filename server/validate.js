// Strict validation for everything the client sends. Unknown keys are rejected, sizes are bounded,
// and a fresh object is built so nothing the client sends is stored as-is.

const FORBIDDEN_KEYS = new Set(['__proto__', 'constructor', 'prototype']);
const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const str = (v, max) => typeof v === 'string' && v.length > 0 && v.length <= max;
const strList = (v, maxItems, maxLen) => Array.isArray(v) && v.length <= maxItems && v.every((x) => str(x, maxLen));

export function validateEmail(email) {
  return typeof email === 'string' && email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email);
}

export function validateName(name) {
  return typeof name === 'string' && name.trim().length >= 1 && name.trim().length <= 60;
}

function validatePlan(plan) {
  if (plan === null) return null;
  if (!isObj(plan) || typeof plan.createdAt !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(plan.createdAt)) throw new Error('plan');
  if (!Array.isArray(plan.days) || plan.days.length !== 7) throw new Error('plan.days');
  const days = plan.days.map((d) => {
    if (!isObj(d) || !str(d.breakfast, 64) || !str(d.lunch, 64) || !str(d.dinner, 64)) throw new Error('plan.day');
    return { breakfast: d.breakfast, lunch: d.lunch, dinner: d.dinner };
  });
  return { createdAt: plan.createdAt, days };
}

/** { "item name": "YYYY-MM-DD" } with real calendar dates only. */
function validateExpiry(obj) {
  if (!isObj(obj)) throw new Error('expiry');
  const keys = Object.keys(obj);
  if (keys.length > 200) throw new Error('expiry size');
  const out = {};
  for (const k of keys) {
    const v = obj[k];
    if (FORBIDDEN_KEYS.has(k) || !str(k, 60) || typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(v)) throw new Error('expiry entry');
    const [y, m, d] = v.split('-').map(Number);
    const date = new Date(Date.UTC(y, m - 1, d));
    if (y < 2000 || y > 2100 || date.getUTCFullYear() !== y || date.getUTCMonth() !== m - 1 || date.getUTCDate() !== d) throw new Error('expiry date');
    out[k] = v;
  }
  return out;
}

function validateFlags(obj, maxKeys, keyPattern) {
  if (!isObj(obj)) throw new Error('flags');
  const keys = Object.keys(obj);
  if (keys.length > maxKeys) throw new Error('flags size');
  const out = {};
  for (const k of keys) {
    if (FORBIDDEN_KEYS.has(k) || k.length > 80 || (keyPattern && !keyPattern.test(k)) || obj[k] !== true) throw new Error('flags key');
    out[k] = true;
  }
  return out;
}

/** Returns { ok: true, value } or { ok: false }. */
export function validateUserData(data) {
  try {
    if (!isObj(data)) throw new Error('shape');
    const allowed = ['plan', 'eaten', 'pantry', 'dislikes', 'favorites', 'target', 'groceryChecked', 'pantryExpiry', 'expiryWarnDays'];
    if (Object.keys(data).some((k) => !allowed.includes(k))) throw new Error('unknown key');
    if (!Number.isInteger(data.target) || data.target < 800 || data.target > 6000) throw new Error('target');
    // Optional so older clients keep working, but if present it must be valid (null is not "absent").
    const warn = 'expiryWarnDays' in data ? data.expiryWarnDays : 3;
    if (!Number.isInteger(warn) || warn < 1 || warn > 14) throw new Error('warn days');
    if (!strList(data.pantry, 200, 60) || !strList(data.dislikes, 300, 64) || !strList(data.favorites, 300, 64)) throw new Error('lists');
    return {
      ok: true,
      value: {
        plan: validatePlan(data.plan ?? null),
        eaten: validateFlags(data.eaten ?? {}, 21, /^[0-6]:(breakfast|lunch|dinner)$/),
        pantry: data.pantry,
        dislikes: data.dislikes,
        favorites: data.favorites,
        target: data.target,
        groceryChecked: validateFlags(data.groceryChecked ?? {}, 400, null),
        pantryExpiry: validateExpiry('pantryExpiry' in data ? data.pantryExpiry : {}),
        expiryWarnDays: warn,
      },
    };
  } catch {
    return { ok: false };
  }
}

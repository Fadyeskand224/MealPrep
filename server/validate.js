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

/** { "item name": whole number 1-999 } */
function validateQty(obj) {
  if (!isObj(obj)) throw new Error('qty');
  const keys = Object.keys(obj);
  if (keys.length > 200) throw new Error('qty size');
  const out = {};
  for (const k of keys) {
    const v = obj[k];
    if (FORBIDDEN_KEYS.has(k) || !str(k, 60) || !Number.isInteger(v) || v < 1 || v > 999) throw new Error('qty entry');
    out[k] = v;
  }
  return out;
}

const inRange = (v, max) => typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= max;

/** { "item name": { kcal, protein, carbs, fat, label? } } per 100 g, taken from scanned products. */
function validateNutrition(obj) {
  if (!isObj(obj)) throw new Error('nutrition');
  const keys = Object.keys(obj);
  if (keys.length > 200) throw new Error('nutrition size');
  const out = {};
  for (const k of keys) {
    const v = obj[k];
    if (FORBIDDEN_KEYS.has(k) || !str(k, 60) || !isObj(v)) throw new Error('nutrition entry');
    if (Object.keys(v).some((x) => !['kcal', 'protein', 'carbs', 'fat', 'label'].includes(x))) throw new Error('nutrition keys');
    if (!inRange(v.kcal, 900) || !inRange(v.protein, 100) || !inRange(v.carbs, 100) || !inRange(v.fat, 100) || v.protein + v.carbs + v.fat > 101) throw new Error('nutrition values');
    if (v.label !== undefined && (typeof v.label !== 'string' || v.label.length > 120)) throw new Error('nutrition label');
    const round = (x) => Math.round(x * 10) / 10;
    out[k] = { kcal: round(v.kcal), protein: round(v.protein), carbs: round(v.carbs), fat: round(v.fat) };
    if (v.label) out[k].label = v.label.replace(/[\u0000-\u001f\u007f<>]/g, ' ').trim();
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
    const allowed = ['plan', 'eaten', 'pantry', 'dislikes', 'favorites', 'target', 'groceryChecked', 'pantryExpiry', 'expiryWarnDays', 'pantryQty', 'pantryNutrition'];
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
        pantryQty: validateQty('pantryQty' in data ? data.pantryQty : {}),
        pantryNutrition: validateNutrition('pantryNutrition' in data ? data.pantryNutrition : {}),
      },
    };
  } catch {
    return { ok: false };
  }
}

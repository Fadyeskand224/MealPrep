// Per-user app data, persisted in localStorage.
export const defaultData = () => ({
  plan: null,      // { createdAt, days: [{breakfast, lunch, dinner}] x7 }
  eaten: {},       // { "dayIndex:slot": true }
  pantry: [],      // ["eggs", "rice", ...]
  dislikes: [],    // recipe ids the user swapped away from
  target: 1500,    // daily calories (3 meals/day; see README for the snacks/portion TODO)
});

const key = (userId) => `mp:data:${userId}`;

export function loadData(userId) {
  try {
    const raw = localStorage.getItem(key(userId));
    return raw ? { ...defaultData(), ...JSON.parse(raw) } : defaultData();
  } catch {
    return defaultData();
  }
}

export const saveData = (userId, data) => localStorage.setItem(key(userId), JSON.stringify(data));

// ───────── Dates ─────────
const DAY_MS = 86400000;
const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

/** Date of plan day `i`, with the plan starting on the day it was created. */
export const planDate = (plan, i) => {
  const [y, m, d] = plan.createdAt.split('-').map(Number);
  return new Date(y, m - 1, d + i);
};

/** Index of today within the plan, clamped to 0..6. */
export const todayIndex = (plan) => {
  const diff = Math.round((startOfDay(new Date()) - startOfDay(planDate(plan, 0))) / DAY_MS);
  return Math.min(6, Math.max(0, diff));
};

export const fmtDay = (date) => date.toLocaleDateString(undefined, { weekday: 'short' });
export const fmtFull = (date) => date.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' });

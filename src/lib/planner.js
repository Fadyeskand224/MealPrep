import { RECIPES, RECIPE_BY_ID, MEALS, STAPLES } from '../data/recipes.js';

const shuffle = (arr) => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

const pool = (meal, dislikes = []) =>
  RECIPES.filter((x) => x.meal === meal && !dislikes.includes(x.id));

/** Macro goals derived from a calorie target (25% protein / 45% carbs / 30% fat). */
export const goalsFor = (kcal) => ({
  kcal,
  protein: Math.round((kcal * 0.25) / 4),
  carbs: Math.round((kcal * 0.45) / 4),
  fat: Math.round((kcal * 0.3) / 9),
});

const emptyTotals = () => ({ kcal: 0, protein: 0, carbs: 0, fat: 0 });

/** Sum macros for the meals of one day. If `eaten` is given, only count eaten ones. */
export const dayTotals = (day, eaten) =>
  MEALS.reduce((t, slot) => {
    const rec = RECIPE_BY_ID[day[slot]];
    if (!rec || (eaten && !eaten[slot])) return t;
    t.kcal += rec.kcal;
    t.protein += rec.protein;
    t.carbs += rec.carbs;
    t.fat += rec.fat;
    return t;
  }, emptyTotals());

/**
 * Build a 7-day plan. Tries many random candidates and keeps the one whose daily
 * calories land closest to the target, with no repeated meals and no back-to-back
 * days of the same main protein in the same slot.
 */
export function generateWeek({ target = 2000, dislikes = [], favorites = [] } = {}) {
  let best = null;
  let bestScore = Infinity;

  for (let attempt = 0; attempt < 60; attempt++) {
    const bags = Object.fromEntries(
      MEALS.map((m) => {
        const bag = shuffle(pool(m, dislikes));
        // Favourites jump the queue most of the time, so they show up in your week.
        const favs = bag.filter((x) => favorites.includes(x.id) && Math.random() < 0.75);
        return [m, [...favs, ...bag.filter((x) => !favs.includes(x))]];
      })
    );
    const days = [];
    let ok = true;

    for (let d = 0; d < 7; d++) {
      const day = {};
      for (const slot of MEALS) {
        const bag = bags[slot];
        const prev = d > 0 ? RECIPE_BY_ID[days[d - 1][slot]] : null;
        let idx = bag.findIndex((x) => !prev || x.main !== prev.main);
        if (idx === -1) idx = 0;
        if (!bag[idx]) { ok = false; break; }
        day[slot] = bag.splice(idx, 1)[0].id;
      }
      if (!ok) break;
      days.push(day);
    }
    if (!ok) continue;

    const score = days.reduce((s, day) => s + Math.abs(dayTotals(day).kcal - target), 0);
    if (score < bestScore) {
      bestScore = score;
      best = days;
    }
  }

  // Fallback if the dislike list left too few recipes: allow repeats.
  if (!best) {
    best = Array.from({ length: 7 }, () =>
      Object.fromEntries(
        MEALS.map((m) => {
          const p = pool(m, dislikes);
          const src = p.length ? p : RECIPES.filter((x) => x.meal === m);
          return [m, src[Math.floor(Math.random() * src.length)].id];
        })
      )
    );
  }

  return { createdAt: new Date().toISOString().slice(0, 10), days: best };
}

/** Recipes that could replace the current one in a slot: same meal type, not already in the week. */
export function swapOptions(plan, slot, dislikes = []) {
  const used = new Set(plan.days.map((d) => d[slot]));
  return pool(slot, dislikes).filter((x) => !used.has(x.id));
}

export const pickRandomSwap = (plan, slot, dislikes) => {
  const opts = swapOptions(plan, slot, dislikes);
  return opts.length ? opts[Math.floor(Math.random() * opts.length)] : null;
};

// ───────── Pantry matching ─────────

const norm = (s) =>
  s
    .toLowerCase()
    .trim()
    .split(/\s+/)
    .map((w) => {
      if (w.length > 4 && w.endsWith('ies')) return `${w.slice(0, -3)}y`; // berries -> berry
      if (w.length > 4 && w.endsWith('oes')) return w.slice(0, -2);        // potatoes -> potato
      return w.length > 3 && w.endsWith('s') && !w.endsWith('ss') ? w.slice(0, -1) : w;
    })
    .join(' ');

// Words that change what an ingredient *is*: "rice" must not satisfy "rice noodles",
// "potato" must not satisfy "sweet potato", "onion" must not satisfy "green onion", and fresh
// "tomato" must not satisfy "canned tomatoes".
const DEFINING = new Set(['noodle', 'sauce', 'powder', 'paste', 'broth', 'butter', 'milk', 'cream', 'dressing', 'bun', 'dough', 'sweet', 'green', 'red', 'canned', 'smoked']);

/**
 * A pantry item matches an ingredient if all of its words appear in the ingredient name
 * ("chicken" covers "chicken breast"), unless the ingredient has a defining word the
 * pantry item lacks.
 */
export const hasIngredient = (pantry, ingredientName) => {
  const ing = norm(ingredientName).split(' ');
  return pantry.some((p) => {
    const words = norm(p).split(' ');
    if (!words.every((w) => ing.includes(w))) return false;
    // A defining word on either side means the two must be the same thing
    // ("butter" is not "peanut butter", "milk" is not "coconut milk").
    if (words.some((w) => DEFINING.has(w)) || ing.some((w) => DEFINING.has(w))) {
      return ing.length === words.length;
    }
    return true;
  });
};

/** Annotate a recipe's ingredients with `have` flags and compute a match score. */
export function analyzeRecipe(recipe, pantry) {
  const ingredients = recipe.ingredients.map((i) => ({
    ...i,
    have: hasIngredient(pantry, i.name),
    staple: STAPLES.has(i.name),
  }));
  const core = ingredients.filter((i) => !i.staple);
  const haveCount = core.filter((i) => i.have).length;
  return {
    ingredients,
    haveCount,
    coreCount: core.length,
    missing: core.filter((i) => !i.have),
    score: core.length ? haveCount / core.length : 0,
  };
}

/** Rank every recipe by how much of it the pantry covers. */
export function recommend(pantry, meal = 'all') {
  if (!pantry.length) return [];
  return RECIPES.filter((x) => meal === 'all' || x.meal === meal)
    .map((recipe) => ({ recipe, ...analyzeRecipe(recipe, pantry) }))
    .filter((x) => x.haveCount > 0)
    .sort((a, b) => b.score - a.score || a.missing.length - b.missing.length || b.haveCount - a.haveCount);
}

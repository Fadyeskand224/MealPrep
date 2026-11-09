// Turns recipe ingredient lines into grams, and uses nutrition facts from products the user has scanned
// to adjust a recipe's macros. Baseline recipe macros are left alone; only the difference between the
// user's actual product and a typical one is added, so nothing changes until a product has been scanned.
import { NUTRITION } from '../data/nutrition.js';
import { parseQty } from './grocery.js';
import { hasIngredient, normalizeName } from './planner.js';

const OZ = 28.35;
const UNIT_ALIASES = { cups: 'cup', slices: 'slice', leaves: 'leaf', cloves: 'clove', spears: 'spear', stalks: 'stalk', tablespoon: 'tbsp', teaspoon: 'tsp' };

/** Grams of an ingredient line like "1/2 cup" for "greek yogurt", or null if we can't tell. 0 for "to taste". */
export function gramsFor(name, qty) {
  const spec = NUTRITION[name];
  if (!spec) return null;
  const { n, unit: raw } = parseQty(qty);
  if (n === null) return 0;
  const unit = UNIT_ALIASES[raw] || raw || 'each';
  const units = spec[4];
  let per = units[unit];
  if (per === undefined && unit === 'oz') per = OZ;
  if (per === undefined && unit === 'tsp' && units.tbsp) per = units.tbsp / 3;
  if (per === undefined && unit === 'tbsp' && units.cup) per = units.cup / 16;
  if (per === undefined && unit === 'tbsp' && units.tsp) per = units.tsp * 3;
  if (per === undefined && unit === 'cup' && units.tbsp) per = units.tbsp * 16;
  if (per === undefined && ['large', 'small', 'medium'].includes(unit)) per = units.each;
  return per === undefined ? null : n * per;
}

/** Baseline macros per 100 g for an ingredient. */
export const baselineOf = (name) => {
  const s = NUTRITION[name];
  return s ? { kcal: s[0], protein: s[1], carbs: s[2], fat: s[3] } : null;
};

/** Adds up a recipe from the baseline table (used to sanity-check the table against the recipe macros). */
export function bottomUpMacros(recipe) {
  const t = { kcal: 0, protein: 0, carbs: 0, fat: 0 };
  let unresolved = 0;
  for (const ing of recipe.ingredients) {
    const g = gramsFor(ing.name, ing.qty);
    const b = baselineOf(ing.name);
    if (g === null || !b) { unresolved += 1; continue; }
    for (const k of Object.keys(t)) t[k] += (g / 100) * b[k];
  }
  return { ...t, unresolved };
}

/**
 * Guard against products that are really a different form of the food (cooked rice pouch vs dry rice,
 * light vs regular coconut milk, a mis-mapped product). Normal brand-to-brand differences sit well inside this.
 */
export function plausibleSubstitute(baseline, product) {
  if (!baseline || !product) return false;
  const nums = [product.kcal, product.protein, product.carbs, product.fat];
  if (!nums.every((x) => Number.isFinite(x) && x >= 0)) return false;
  if (baseline.kcal < 60) return Math.abs(product.kcal - baseline.kcal) <= 70;
  const ratio = product.kcal / baseline.kcal;
  return ratio >= 0.4 && ratio <= 2.2;
}

const round1 = (x) => Math.round(x * 10) / 10;

/**
 * Adjusts one recipe for the products in the user's pantry.
 * nutritionByItem: { pantryItemName: { kcal, protein, carbs, fat, label } } (per 100 g, from scans)
 * Returns the recipe with updated macros and `adjustments` listing what changed and why.
 */
export function personalizeRecipe(recipe, pantry, nutritionByItem) {
  const withData = pantry.filter((p) => nutritionByItem[p]);
  const adjustments = [];
  const delta = { kcal: 0, protein: 0, carbs: 0, fat: 0 };

  if (withData.length) {
    for (const ing of recipe.ingredients) {
      const base = baselineOf(ing.name);
      const grams = gramsFor(ing.name, ing.qty);
      if (!base || !grams) continue;
      // An exact name match wins over "chicken" covering "chicken breast".
      const candidates = withData.filter((p) => hasIngredient([p], ing.name));
      const item = candidates.find((p) => normalizeName(p) === normalizeName(ing.name)) || candidates[0];
      if (!item) continue;
      const product = nutritionByItem[item];
      if (!plausibleSubstitute(base, product)) continue;
      const d = {};
      for (const k of Object.keys(delta)) d[k] = (grams / 100) * (product[k] - base[k]);
      for (const k of Object.keys(delta)) delta[k] += d[k];
      adjustments.push({ ingredient: ing.name, item, label: product.label || item, grams: Math.round(grams), kcal: round1(d.kcal), protein: round1(d.protein), carbs: round1(d.carbs), fat: round1(d.fat) });
    }
  }

  if (!adjustments.length) return { ...recipe, adjustments: [] };
  const out = { ...recipe, adjustments };
  for (const k of Object.keys(delta)) out[k] = Math.max(0, Math.round(recipe[k] + delta[k]));
  return out;
}

/** Personalizes the whole library once; components then read macros from `byId`. */
export function personalizeAll(recipes, pantry, nutritionByItem) {
  const list = recipes.map((r) => personalizeRecipe(r, pantry, nutritionByItem));
  return { list, byId: Object.fromEntries(list.map((r) => [r.id, r])) };
}

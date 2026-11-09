// Ingredient nutrition engine. Run with: npm test
import test from 'node:test';
import assert from 'node:assert/strict';
import { RECIPES } from '../../src/data/recipes.js';
import { NUTRITION } from '../../src/data/nutrition.js';
import { gramsFor, bottomUpMacros, plausibleSubstitute, personalizeRecipe, personalizeAll } from '../../src/lib/nutrition.js';

const byId = Object.fromEntries(RECIPES.map((r) => [r.id, r]));
const SKIP = new Set(['salt', 'black pepper']);
const FIBROUS_SPICES = new Set(['chili powder', 'cinnamon', 'curry powder', 'turmeric']);

test('every ingredient has nutrition data and every recipe line resolves to grams', () => {
  const problems = [];
  for (const r of RECIPES) for (const i of r.ingredients) {
    if (SKIP.has(i.name)) continue;
    if (!NUTRITION[i.name]) problems.push(`${r.id}: no nutrition for "${i.name}"`);
    else if (gramsFor(i.name, i.qty) === null) problems.push(`${r.id}: cannot weigh "${i.qty}" ${i.name}`);
  }
  assert.deepEqual(problems, []);
});

test('each ingredient is internally consistent (calories roughly match protein, carbs and fat)', () => {
  for (const [name, [kcal, p, c, f]] of Object.entries(NUTRITION)) {
    const calc = p * 4 + c * 4 + f * 9;
    // Carbs on labels include fibre, which carries few calories. Fibrous spices (used by the teaspoon) get extra slack.
    const slack = FIBROUS_SPICES.has(name) ? 0.5 : 0.35;
    assert.ok(Math.abs(calc - kcal) <= Math.max(30, kcal * slack), `${name}: ${kcal} kcal vs ${Math.round(calc)} from macros`);
    assert.ok(p + c + f <= 101, `${name}: macros exceed 100 g`);
  }
});

test('adding up each recipe from the table agrees with its stated macros', () => {
  const ratios = [];
  for (const r of RECIPES) {
    const b = bottomUpMacros(r);
    assert.equal(b.unresolved, SKIP.size === 0 ? 0 : b.unresolved); // salt/pepper are expected to be skipped
    const ratio = b.kcal / r.kcal;
    ratios.push(ratio);
    assert.ok(ratio >= 0.6 && ratio <= 1.6, `${r.id}: stated ${r.kcal} kcal but the table gives ${Math.round(b.kcal)} (${ratio.toFixed(2)}x)`);
  }
  const mean = ratios.reduce((s, x) => s + x, 0) / ratios.length;
  assert.ok(mean > 0.9 && mean < 1.1, `average ratio ${mean.toFixed(2)} should be close to 1`);
});

test('gramsFor converts the measures recipes use', () => {
  assert.equal(gramsFor('greek yogurt', '1/2 cup'), 122.5);
  assert.equal(gramsFor('chicken breast', '5 oz'), 141.75);
  assert.equal(gramsFor('whole wheat bread', '2 slices'), 64);
  assert.equal(gramsFor('eggs', '3'), 150);
  assert.equal(gramsFor('honey', '1 tsp'), 7);
  assert.equal(gramsFor('olive oil', '1 tbsp'), 13.5);
  assert.equal(gramsFor('tortillas', '1 large'), 70);
  assert.equal(gramsFor('tortillas', '2 small'), 60);
  assert.equal(gramsFor('curry powder', '1 tsp'), 2, 'teaspoon derived from tablespoon');
  assert.equal(gramsFor('spinach', '1 handful'), 30);
  assert.equal(gramsFor('salt', 'to taste'), null, 'no data for salt');
  assert.equal(gramsFor('eggs', 'to taste'), 0);
  assert.equal(gramsFor('unobtainium', '1 cup'), null);
  assert.equal(gramsFor('eggs', '5 parsecs'), null, 'unknown unit');
});

test('with nothing scanned, macros are exactly the recipe baseline', () => {
  for (const r of RECIPES.slice(0, 12)) {
    const p = personalizeRecipe(r, ['greek yogurt', 'eggs'], {});
    assert.equal(p.kcal, r.kcal); assert.equal(p.protein, r.protein); assert.equal(p.carbs, r.carbs); assert.equal(p.fat, r.fat);
    assert.deepEqual(p.adjustments, []);
  }
});

test('a lower-fat yogurt lowers the calories and fat of a yogurt parfait by the exact difference', () => {
  const parfait = byId['b-yogurt-parfait']; // 1 cup greek yogurt = 245 g
  const mine = { kcal: 55, protein: 10, carbs: 3.6, fat: 0.2, label: 'Fage 0%' };
  const p = personalizeRecipe(parfait, ['greek yogurt'], { 'greek yogurt': mine });
  assert.equal(p.kcal, Math.round(parfait.kcal + 2.45 * (55 - 73)));   // -44
  assert.equal(p.fat, Math.round(parfait.fat + 2.45 * (0.2 - 1.9)));    // about -4
  assert.equal(p.protein, parfait.protein, 'same protein, so unchanged');
  assert.equal(p.adjustments.length, 1);
  assert.equal(p.adjustments[0].ingredient, 'greek yogurt');
  assert.equal(p.adjustments[0].label, 'Fage 0%');
  assert.equal(p.adjustments[0].grams, 245);
  assert.ok(p.adjustments[0].kcal < 0);
  assert.equal(parfait.kcal, 350, 'the original recipe is never mutated');
});

test('a generic pantry name ("yogurt") also personalises "greek yogurt"', () => {
  const p = personalizeRecipe(byId['b-yogurt-parfait'], ['yogurt'], { yogurt: { kcal: 55, protein: 10, carbs: 3.6, fat: 0.2 } });
  assert.ok(p.kcal < byId['b-yogurt-parfait'].kcal);
});

test('an exact name match is preferred over a generic one', () => {
  const r = { id: 'x', ingredients: [{ qty: '1/4 cup', name: 'cheddar cheese' }], kcal: 100, protein: 5, carbs: 1, fat: 8 };
  const nutri = { cheese: { kcal: 300, protein: 20, carbs: 2, fat: 22, label: 'generic' }, 'cheddar cheese': { kcal: 350, protein: 24, carbs: 2, fat: 28, label: 'exact' } };
  assert.equal(personalizeRecipe(r, ['cheese', 'cheddar cheese'], nutri).adjustments[0].label, 'exact');
});

test('products that are really a different form of the food are ignored', () => {
  const rice = byId['l-egg-fried-rice'];
  const cookedPouch = { kcal: 130, protein: 2.7, carbs: 28, fat: 0.3 }; // ready-cooked rice vs dry rice
  const p = personalizeRecipe(rice, ['rice'], { rice: cookedPouch });
  assert.equal(p.kcal, rice.kcal);
  assert.deepEqual(p.adjustments, []);
  assert.equal(plausibleSubstitute({ kcal: 365 }, cookedPouch), false);
  assert.equal(plausibleSubstitute({ kcal: 61 }, { kcal: 34, protein: 3.4, carbs: 5, fat: 0.1 }), true, 'skim milk is a normal substitute for whole milk');
  assert.equal(plausibleSubstitute({ kcal: 403 }, { kcal: 280, protein: 25, carbs: 2, fat: 20 }), true, 'light cheese');
  assert.equal(plausibleSubstitute({ kcal: 20 }, { kcal: 900, protein: 0, carbs: 0, fat: 100 }), false, 'oil for a vegetable');
  assert.equal(plausibleSubstitute({ kcal: 20 }, { kcal: NaN, protein: 0, carbs: 0, fat: 0 }), false);
  assert.equal(plausibleSubstitute(null, { kcal: 1, protein: 1, carbs: 1, fat: 1 }), false);
  assert.equal(plausibleSubstitute({ kcal: 100 }, { kcal: -5, protein: 0, carbs: 0, fat: 0 }), false);
});

test('macros never go negative and nothing changes for items without data', () => {
  const r = { id: 'tiny', ingredients: [{ qty: '1 cup', name: 'heavy cream' }], kcal: 5, protein: 0, carbs: 0, fat: 1 };
  const p = personalizeRecipe(r, ['heavy cream', 'eggs'], { 'heavy cream': { kcal: 150, protein: 2, carbs: 4, fat: 12 } });
  for (const k of ['kcal', 'protein', 'carbs', 'fat']) assert.ok(p[k] >= 0, k);
  const q = personalizeRecipe(byId['b-veg-scramble'], ['eggs', 'spinach'], { milk: { kcal: 61, protein: 3, carbs: 5, fat: 3 } });
  assert.deepEqual(q.adjustments, [], 'data for an item that is not in the pantry list has no effect');
});

test('personalizeAll returns a lookup that matches the list', () => {
  const { list, byId: lookup } = personalizeAll(RECIPES, ['greek yogurt'], { 'greek yogurt': { kcal: 55, protein: 10, carbs: 3.6, fat: 0.2 } });
  assert.equal(list.length, RECIPES.length);
  assert.equal(lookup['b-yogurt-parfait'], list.find((r) => r.id === 'b-yogurt-parfait'));
  const changed = list.filter((r) => r.adjustments.length);
  assert.ok(changed.length >= 3 && changed.length < RECIPES.length, `${changed.length} recipes changed`);
  assert.ok(changed.every((r) => r.ingredients.some((i) => i.name === 'greek yogurt')), 'only recipes that use the product change');
});

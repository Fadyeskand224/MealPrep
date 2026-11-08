// Pantry matching rules. Run with: npm test
import test from 'node:test';
import assert from 'node:assert/strict';
import { hasIngredient } from '../../src/lib/planner.js';

const yes = (pantry, ingredient) => assert.equal(hasIngredient(pantry, ingredient), true, `${JSON.stringify(pantry)} should cover "${ingredient}"`);
const no = (pantry, ingredient) => assert.equal(hasIngredient(pantry, ingredient), false, `${JSON.stringify(pantry)} should NOT cover "${ingredient}"`);

test('a generic pantry item covers more specific ingredients', () => {
  yes(['chicken'], 'chicken breast');
  yes(['cheese'], 'cheddar cheese');
  yes(['beans'], 'black beans');
  yes(['tomato'], 'cherry tomatoes');
  yes(['berries'], 'mixed berries');
  yes(['potato'], 'potatoes');
});

test('specific pantry items do not cover different specifics', () => {
  no(['chicken breast'], 'chicken thighs');
  no(['cheddar cheese'], 'feta cheese');
});

test('defining words keep different foods apart', () => {
  no(['rice'], 'rice noodles');
  no(['eggs'], 'egg noodles');
  no(['butter'], 'peanut butter');
  no(['milk'], 'coconut milk');
  no(['potato'], 'sweet potato');
  no(['onion'], 'green onion');
  no(['onion'], 'red onion');
  no(['chicken'], 'chicken broth');
  no(['tomato'], 'canned tomatoes');
  no(['salmon'], 'smoked salmon');
});

test('exact matches always work, including defining words', () => {
  yes(['rice noodles'], 'rice noodles');
  yes(['peanut butter'], 'peanut butter');
  yes(['coconut milk'], 'coconut milk');
  yes(['sweet potato'], 'sweet potato');
  yes(['green onion'], 'green onion');
  yes(['canned tomatoes'], 'canned tomatoes');
  yes(['smoked salmon'], 'smoked salmon');
  yes(['milk'], 'milk');
  yes(['vegetable broth'], 'vegetable broth');
});

test('empty pantry covers nothing', () => no([], 'eggs'));

// ───────── Expiry and the grocery list ─────────
import { buildGroceryList } from '../../src/lib/grocery.js';
import { usablePantry } from '../../src/lib/expiry.js';

const TODAY = new Date(2026, 10, 8, 12);
const planWith = (id) => ({ createdAt: '2026-11-08', days: Array.from({ length: 7 }, () => ({ breakfast: id, lunch: id, dinner: id })) });
const toBuy = (list) => list.groups.flatMap((g) => g.items.map((i) => i.name));

test('an expired pantry item goes back on the grocery list instead of counting as in stock', () => {
  const plan = planWith('b-veg-scramble'); // eggs, spinach, bread
  const pantry = ['eggs', 'spinach'];

  const fresh = buildGroceryList(plan, usablePantry(pantry, { spinach: '2026-12-01' }, TODAY));
  assert.ok(!toBuy(fresh).includes('spinach'), 'in-date spinach is in stock');
  assert.ok(fresh.have.some((i) => i.name === 'spinach'));

  const expired = buildGroceryList(plan, usablePantry(pantry, { spinach: '2026-11-07' }, TODAY));
  assert.ok(toBuy(expired).includes('spinach'), 'expired spinach must be bought again');
  assert.ok(!expired.have.some((i) => i.name === 'spinach'));
  assert.ok(!toBuy(expired).includes('eggs'), 'other in-date items stay in stock');
});

test('food expiring today or soon is still usable for the grocery list', () => {
  const list = buildGroceryList(planWith('b-veg-scramble'), usablePantry(['spinach'], { spinach: '2026-11-08' }, TODAY));
  assert.ok(list.have.some((i) => i.name === 'spinach'));
});

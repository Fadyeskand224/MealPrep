// Recipe data integrity. Run with: npm test
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { RECIPES, CUISINES, STAPLES } from '../../src/data/recipes.js';
import { BY_CUISINE } from '../../src/data/cuisines.js';
import { hasAisle } from '../../src/lib/grocery.js';
import credits from '../../src/data/photoCredits.json' with { type: 'json' };

test('recipe ids are unique and match their meal type', () => {
  const ids = RECIPES.map((r) => r.id);
  assert.equal(new Set(ids).size, ids.length, 'duplicate recipe id');
  const prefix = { breakfast: 'b-', lunch: 'l-', dinner: 'd-' };
  for (const r of RECIPES) assert.ok(r.id.startsWith(prefix[r.meal]), `${r.id} does not match meal ${r.meal}`);
});

test('every recipe has exactly one valid cuisine', () => {
  const mapped = Object.values(BY_CUISINE).flat();
  assert.equal(new Set(mapped).size, mapped.length, 'a recipe is listed under two cuisines');
  const ids = new Set(RECIPES.map((r) => r.id));
  for (const id of mapped) assert.ok(ids.has(id), `cuisine list names unknown recipe ${id}`);
  for (const r of RECIPES) assert.ok(CUISINES.includes(r.cuisine), `${r.id} has no valid cuisine`);
  for (const c of CUISINES) assert.ok(RECIPES.some((r) => r.cuisine === c), `no recipes for ${c}`);
});

test('every recipe has a photo file and a credit', () => {
  for (const r of RECIPES) {
    assert.ok(fs.existsSync(new URL(`../../public/food/${r.id}.jpg`, import.meta.url)), `missing photo for ${r.id}`);
    const c = credits[r.id];
    assert.ok(c && c.url && c.license, `missing photo credit for ${r.id}`);
  }
});

test('macros are plausible (calories roughly match protein/carbs/fat)', () => {
  for (const r of RECIPES) {
    assert.ok(r.kcal >= 200 && r.kcal <= 900, `${r.id} calories out of range`);
    const fromMacros = r.protein * 4 + r.carbs * 4 + r.fat * 9;
    assert.ok(Math.abs(fromMacros - r.kcal) / r.kcal <= 0.35, `${r.id}: ${r.kcal} kcal vs ${fromMacros} from macros`);
  }
});

test('every recipe has ingredients, steps, and a sensible time', () => {
  for (const r of RECIPES) {
    assert.ok(r.ingredients.length >= 3, `${r.id} has too few ingredients`);
    assert.ok(r.steps.length >= 1, `${r.id} has no steps`);
    assert.ok(r.mins >= 3 && r.mins <= 90, `${r.id} has an odd time`);
  }
});

test('every ingredient has a grocery aisle, so shopping lists are never mis-sorted', () => {
  const missing = new Set();
  for (const r of RECIPES) for (const i of r.ingredients) if (!STAPLES.has(i.name) && !hasAisle(i.name)) missing.add(i.name);
  assert.deepEqual([...missing], []);
});

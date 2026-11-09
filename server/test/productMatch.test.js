// Mapping scanned products to pantry names. Run with: npm test
import test from 'node:test';
import assert from 'node:assert/strict';
import { pantryNameFor } from '../../src/lib/productMatch.js';

const P = (name, brands = '', categories = [], genericName = '') => ({ name, brands, categories, genericName });
const names = (cases) => cases.map(([product, expected]) => ({ got: pantryNameFor(product).name, expected, label: product.name }));

test('real Open Food Facts products map to recipe ingredient names', () => {
  const cases = [
    [P('Spaghetti Nº5', 'Barilla, BARILLA NORGE AS', ['cereal-pastas', 'pastas'], 'Spaghetti'), 'spaghetti'],
    [P('Barilla Penne Rigate', 'Barilla', ['pastas']), 'pasta'],
  ];
  for (const { got, expected, label } of names(cases)) assert.equal(got, expected, label);
});

test('everyday groceries map to the right ingredient', () => {
  const cases = [
    [P('Organic Valley Whole Milk', 'Organic Valley', ['milks']), 'milk'],
    [P('Skippy Creamy Peanut Butter', 'Skippy'), 'peanut butter'],
    [P("Heinz Tomato Ketchup", 'Heinz'), 'ketchup'],
    [P('Kraft Shredded Mild Cheddar Cheese', 'Kraft'), 'cheddar cheese'],
    [P('Goya Black Beans', 'Goya', ['canned-beans', 'black-beans']), 'black beans'],
    [P("Hellmann's Real Mayonnaise", "Hellmann's"), 'mayonnaise'],
    [P('Chicken Breast Boneless Skinless', 'Perdue'), 'chicken breast'],
    [P('Greek Yogurt Plain 0% Fat', 'Fage'), 'greek yogurt'],
    [P('Greek Yogurt Nonfat Plain', 'chobani'), 'greek yogurt'],
    [P('Organic GREEK YOGURT plain', 'KIRKLAND Signature'), 'greek yogurt'],
    [P('Large Eggs', 'Eggland'), 'eggs'],
    [P('Sweet Potatoes', ''), 'sweet potato'],
    [P('Roma Tomatoes', ''), 'tomato'],
    [P('Brown Rice', 'Uncle Ben'), 'rice'],
    [P('Whole Wheat Tortillas', 'Mission'), 'tortillas'],
    [P('Ground Beef 80/20', 'Laura'), 'ground beef'],
    [P('Unsalted Butter', 'Land O Lakes'), 'butter'],
    [P('Tuna in water', 'Bumble Bee', ['canned-tuna', 'tunas']), 'canned tuna'],
    [P('Baby Spinach', 'Dole'), 'spinach'],
    [P('Fresh Basil', ''), 'basil'],
    [P('Rolled Oats', "Quaker", ['oats']), 'rolled oats'],
    [P('Chicken Broth', 'Swanson'), 'chicken broth'],
  ];
  for (const { got, expected, label } of names(cases)) assert.equal(got, expected, label);
});

test('a different product that merely contains an ingredient word is NOT mapped to it', () => {
  const notMapped = [
    P("Campbell's Tomato Soup", "Campbell's"),
    P('Almond Milk', 'Silk'),
    P('Coconut Cream', 'Goya'),
    P('Chicken Noodle Soup', 'Progresso'),
    P('Apple Juice', 'Mott'),
    P('Peanut Butter Cookies', 'Famous Amos'),
    P('Egg Noodles', 'No Yolks'),
    P('Garlic Bread', 'Pepperidge'),
  ];
  for (const product of notMapped) {
    const r = pantryNameFor(product);
    assert.ok(!['tomato', 'milk', 'chicken', 'apple', 'peanut butter', 'eggs', 'butter'].includes(r.name), `${product.name} was wrongly mapped to "${r.name}"`);
  }
  assert.equal(pantryNameFor(P('Almond Milk', 'Silk')).name, 'almond milk');
  assert.equal(pantryNameFor(P("Campbell's Tomato Soup", "Campbell's")).name, "campbell's tomato soup");
});

test('a plant-based look-alike is not mistaken for dairy yogurt', () => {
  const r = pantryNameFor(P('Greek Style Plain', 'alpro', ['plant-based']));
  assert.notEqual(r.name, 'greek yogurt');
  assert.equal(r.matched, false);
});

test('unknown products keep a readable name instead of failing', () => {
  assert.equal(pantryNameFor(P('Nutella', 'Nutella, Ferrero', ['spreads'], 'Hazelnut And Cocoa Spread')).name, 'nutella');
  assert.equal(pantryNameFor(P('Coca-Cola Original', 'COCA-COLA SERVICES SA/NV', ['sodas'])).name, 'coca-cola original');
  assert.equal(pantryNameFor(P('Cocoa puffs')).name, 'cocoa puffs');
  assert.equal(pantryNameFor(P('', '', [], 'Hazelnut spread')).name, 'hazelnut spread');
  assert.equal(pantryNameFor(P('', '', [])).name, '');
  assert.equal(pantryNameFor(P('x'.repeat(200))).name.length, 60, 'names are capped to the pantry limit');
});

test('generic fallback helps recipes when only the head word is known', () => {
  assert.equal(pantryNameFor(P('Sourdough Bread', 'Boudin')).name, 'bread');
  assert.equal(pantryNameFor(P('Swiss Cheese Slices', 'Sargento')).name, 'cheese');
});

test('control characters never survive into a name', () => {
  const r = pantryNameFor(P('Nutella\u0000\u0007 spread\n\tjar'));
  assert.ok(!/[\u0000-\u001f]/.test(r.name));
});

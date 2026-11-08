import { RECIPE_BY_ID, MEALS, STAPLES } from '../data/recipes';
import { hasIngredient } from './planner';

// ───────── Aisles ─────────
export const AISLES = ['Produce', 'Meat & Seafood', 'Dairy & Eggs', 'Bakery', 'Canned & Sauces', 'Pantry & Dry Goods', 'Frozen & Other'];

const AISLE_ITEMS = {
  Produce: ['spinach', 'banana', 'avocado', 'mixed berries', 'bell pepper', 'cucumber', 'cherry tomatoes', 'tomato', 'red onion', 'onion', 'green onion', 'celery',
    'carrots', 'sweet potato', 'potatoes', 'broccoli', 'asparagus', 'green beans', 'lettuce', 'romaine lettuce', 'lemon', 'lime', 'garlic', 'ginger', 'basil',
    'corn', 'peas', 'apple', 'mango', 'cabbage', 'eggplant', 'mushrooms', 'bean sprouts'],
  'Meat & Seafood': ['chicken breast', 'chicken thighs', 'chicken sausage', 'ground turkey', 'ground beef', 'beef sirloin', 'pork chops', 'bacon', 'turkey slices',
    'smoked salmon', 'salmon', 'shrimp', 'cod'],
  'Dairy & Eggs': ['eggs', 'milk', 'greek yogurt', 'cheddar cheese', 'mozzarella', 'feta cheese', 'parmesan', 'cottage cheese', 'ricotta', 'cream cheese', 'butter', 'heavy cream'],
  Bakery: ['whole wheat bread', 'tortillas', 'pita bread', 'flatbread', 'bagel', 'english muffin', 'burger bun', 'pizza dough'],
  'Canned & Sauces': ['canned tomatoes', 'canned tuna', 'black beans', 'kidney beans', 'chickpeas', 'marinara sauce', 'salsa', 'hummus', 'soy sauce', 'teriyaki sauce',
    'caesar dressing', 'mayonnaise', 'ketchup', 'bbq sauce', 'pesto', 'green curry paste', 'coconut milk', 'vegetable broth', 'chicken broth', 'olives'],
  'Pantry & Dry Goods': ['rolled oats', 'granola', 'rice', 'pasta', 'spaghetti', 'fettuccine', 'lasagna noodles', 'egg noodles', 'rice noodles', 'ramen noodles',
    'quinoa', 'lentils', 'chia seeds', 'peanut butter', 'honey', 'almonds', 'peanuts', 'breadcrumbs', 'chili powder', 'cinnamon', 'curry powder', 'turmeric'],
  'Frozen & Other': ['waffles', 'veggie patty', 'falafel', 'tofu'],
};

const AISLE_OF = Object.fromEntries(Object.entries(AISLE_ITEMS).flatMap(([aisle, names]) => names.map((n) => [n, aisle])));
export const aisleOf = (name) => AISLE_OF[name] || 'Frozen & Other';

// ───────── Quantity maths ─────────
const parseNum = (s) => {
  const m = s.match(/^(\d+)(?:\s+(\d+)\/(\d+))?$|^(\d+)\/(\d+)$|^(\d*\.\d+)$/);
  if (!m) return null;
  if (m[6]) return parseFloat(m[6]);
  if (m[4]) return Number(m[4]) / Number(m[5]);
  return Number(m[1]) + (m[2] ? Number(m[2]) / Number(m[3]) : 0);
};

/** "1 1/2 cups" -> { n: 1.5, unit: "cup" }.  "to taste" -> { n: null }. */
export function parseQty(qty) {
  const parts = qty.trim().split(/\s+/);
  for (let take = Math.min(2, parts.length); take >= 1; take--) {
    const n = parseNum(parts.slice(0, take).join(' '));
    if (n !== null) return { n, unit: parts.slice(take).join(' ').toLowerCase() };
  }
  return { n: null, unit: qty.toLowerCase() };
}

const SINGULAR = { slices: 'slice', cups: 'cup', cloves: 'clove', leaves: 'leaf', cans: 'can', fillets: 'fillet', spears: 'spear', stalks: 'stalk', packs: 'pack', handfuls: 'handful' };
const PLURAL = { slice: 'slices', cup: 'cups', clove: 'cloves', leaf: 'leaves', can: 'cans', fillet: 'fillets', spear: 'spears', stalk: 'stalks', pack: 'packs', handful: 'handfuls' };
const singular = (u) => SINGULAR[u] || u;

const FRACTIONS = [[0, ''], [1 / 4, '1/4'], [1 / 3, '1/3'], [1 / 2, '1/2'], [2 / 3, '2/3'], [3 / 4, '3/4'], [1, '']];
export function formatNum(x) {
  const whole = Math.floor(x + 1e-9);
  const frac = x - whole;
  const best = FRACTIONS.reduce((a, b) => (Math.abs(b[0] - frac) < Math.abs(a[0] - frac) ? b : a));
  if (best[0] === 1) return String(whole + 1);
  if (!best[1]) return String(whole || Math.round(x * 10) / 10);
  return whole ? `${whole} ${best[1]}` : best[1];
}

function formatQty(n, unit) {
  if (n === null) return unit;
  const u = n > 1 && PLURAL[unit] ? PLURAL[unit] : unit;
  return `${formatNum(n)}${u ? ` ${u}` : ''}`;
}

// ───────── Build the list ─────────
/**
 * Combine every ingredient across the planned week.
 * `people` scales the amounts (recipes are written for one serving).
 */
export function buildGroceryList(plan, pantry, people = 1) {
  const map = new Map(); // name -> { name, amounts: Map(unit -> n|null), meals: Set }
  let meals = 0;

  for (const day of plan.days) {
    for (const slot of MEALS) {
      const rec = RECIPE_BY_ID[day[slot]];
      if (!rec) continue;
      meals++;
      for (const ing of rec.ingredients) {
        if (STAPLES.has(ing.name)) continue;
        const { n, unit } = parseQty(ing.qty);
        const key = singular(unit);
        const entry = map.get(ing.name) || { name: ing.name, amounts: new Map(), meals: new Set() };
        entry.amounts.set(key, n === null ? null : (entry.amounts.get(key) || 0) + n * people);
        entry.meals.add(rec.name);
        map.set(ing.name, entry);
      }
    }
  }

  const toItem = (e) => ({
    name: e.name,
    qty: [...e.amounts].map(([unit, n]) => formatQty(n, unit)).join(' + '),
    meals: [...e.meals],
    aisle: aisleOf(e.name),
    have: hasIngredient(pantry, e.name),
  });

  const all = [...map.values()].map(toItem).sort((a, b) => a.name.localeCompare(b.name));
  const groups = AISLES.map((aisle) => ({ aisle, items: all.filter((i) => i.aisle === aisle && !i.have) })).filter((g) => g.items.length);
  const have = all.filter((i) => i.have);
  const staples = [...STAPLES].filter((s) => plan.days.some((d) => MEALS.some((m) => RECIPE_BY_ID[d[m]]?.ingredients.some((i) => i.name === s))));

  return { groups, have, staples, meals, toBuy: groups.reduce((s, g) => s + g.items.length, 0) };
}

/** Plain-text checklist that pastes cleanly into Apple Notes. Skips checked and pantry items. */
export function groceryText(list, checked, title) {
  const lines = [title, ''];
  for (const g of list.groups) {
    const items = g.items.filter((i) => !checked[i.name]);
    if (!items.length) continue;
    lines.push(g.aisle.toUpperCase());
    for (const i of items) lines.push(`☐ ${i.name}${i.qty ? ` (${i.qty})` : ''}`);
    lines.push('');
  }
  if (list.staples.length) lines.push('CHECK YOU HAVE', `☐ ${list.staples.join(', ')}`, '');
  return lines.join('\n').trim();
}

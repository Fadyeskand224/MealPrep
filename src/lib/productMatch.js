// Turns a scanned product ("Barilla Spaghetti Nº5") into a pantry name our recipes understand ("spaghetti").
// Pantry matching works on words, so a name from our own ingredient list makes scanned food usable in
// recipes, grocery lists and "use it up" suggestions. If nothing matches we keep a readable product name.
import { ALL_INGREDIENTS } from '../data/recipes.js';
import { normalizeName } from './planner.js';

// Words that trail a product name without changing what it is ("whole milk 2%", "chicken breast boneless").
const TRAILING = new Set([
  'no', 'nr', 'oz', 'g', 'kg', 'ml', 'l', 'lb', 'lbs', 'pack', 'pk', 'ct', 'count', 'size', 'value', 'family',
  'boneless', 'skinless', 'fresh', 'frozen', 'organic', 'natural', 'raw', 'whole', 'sliced', 'shredded', 'diced', 'chopped',
  'unsalted', 'salted', 'low', 'fat', 'free', 'reduced', 'sodium', 'original', 'classic', 'plain', 'large', 'small', 'medium',
  'block', 'slice', 'grated', 'crumbled', 'mild', 'sharp', 'extra', 'real', 'pure', 'rigate', 'lite', 'light', 'unsweetened',
  'nonfat', 'lowfat', 'skim', 'fatfree', 'non', 'style', 'zero', 'percent',
]);

// Words that describe the food rather than turn it into something else ("whole milk" is still milk).
const HARMLESS_MODIFIER = new Set([
  'whole', 'skim', 'skimmed', 'organic', 'fat', 'free', 'low', 'lowfat', 'reduced', 'light', 'lite', 'unsalted', 'salted', 'fresh', 'natural',
  'original', 'classic', 'pure', 'real', 'large', 'extra', 'pasteurized', 'homogenized', 'vitamin', 'd', 'plain', 'raw', 'sweet', 'creamy',
  'mild', 'sharp', 'boneless', 'skinless', 'ground', 'brown', 'white', 'long', 'grain', 'roma', 'cage', 'grade', 'a', 'aa', 'the', 'and', 'of',
]);

// Single words that only mean something with their modifier ("almond milk" is not milk).
const NEEDS_CONTEXT = new Set(['milk', 'butter', 'cream', 'sauce', 'broth', 'paste', 'powder', 'noodle', 'dough', 'bun', 'dressing']);

// Generic foods we can fall back to when only the head word is known ("sourdough bread" -> "bread").
const GENERIC_HEADS = new Set(['bread', 'cheese', 'bean', 'chicken', 'beef', 'pork', 'turkey', 'fish', 'rice', 'pasta', 'pepper', 'onion', 'tomato', 'potato', 'lettuce', 'berry', 'yogurt', 'egg']);

const tokens = (text) =>
  String(text || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean)
    .map((t) => normalizeName(t));

function stripTrailing(toks) {
  const out = [...toks];
  while (out.length > 1 && (/^\d+$/.test(out[out.length - 1]) || out[out.length - 1].length <= 1 || TRAILING.has(out[out.length - 1]))) out.pop();
  return out;
}

const VOCAB = ALL_INGREDIENTS.map((name) => ({ name, toks: tokens(name) })).filter((v) => v.toks.length);

/** Best vocabulary phrase that sits at the END of the (cleaned) token list, or null. */
function bestPhrase(toks) {
  const core = stripTrailing(toks);
  let best = null;
  for (const v of VOCAB) {
    const start = core.length - v.toks.length;
    if (start < 0 || !v.toks.every((t, i) => core[start + i] === t)) continue;
    // "almond milk": a bare "milk" preceded by an unrecognised modifier is a different product.
    if (v.toks.length === 1 && NEEDS_CONTEXT.has(v.toks[0]) && start > 0 && !HARMLESS_MODIFIER.has(core[start - 1])) continue;
    if (!best || v.toks.length > best.toks.length) best = v;
  }
  return best;
}

const clean = (s) => String(s || '').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim();

/**
 * product: { name, genericName, brands, categories: ['pastas', ...] } (as returned by /api/barcode)
 * returns:  { name, matched }  where `matched` means the name comes from our ingredient list.
 */
export function pantryNameFor(product) {
  const brandWords = new Set(tokens(product.brands));
  const stripBrand = (text) => tokens(text).filter((t) => !brandWords.has(t));

  // Most specific source first: the product name, then the generic name, then category tags.
  const sources = [
    stripBrand(product.name),
    stripBrand(product.genericName),
    ...(product.categories || []).map((c) => tokens(c)),
  ];
  for (const toks of sources) {
    const hit = bestPhrase(toks);
    if (hit) return { name: hit.name, matched: true };
  }

  // Not one of our ingredients: keep something readable, using a generic head word when that still helps recipes.
  const readable = clean(product.name || product.genericName).toLowerCase().slice(0, 60);
  const head = stripTrailing(stripBrand(product.name || product.genericName)).slice(-1)[0];
  if (head && GENERIC_HEADS.has(head) && VOCAB.some((v) => v.toks.includes(head))) return { name: head, matched: true };
  return { name: readable, matched: false };
}

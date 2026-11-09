// Lets people type an amount with the item name in the scanner: "12 eggs", "3 x rice", "eggs x2".
// Returns { name, qty }, where qty is null when no amount was typed.

const MAX_QTY = 999;
const looksLikeFood = (s) => /[a-z]{2,}/i.test(s) && !/^\d/.test(s); // needs a real word and must not itself start with a number

export function parseTypedItem(text) {
  const t = String(text ?? '').trim().replace(/\s+/g, ' ');
  const lead = /^(\d{1,3})\s*(?:[x×]\s+|\s+)(.+)$/i.exec(t); // "12 eggs", "3 x rice", "3x rice"
  const trail = /^(.+?)\s+[x×]\s*(\d{1,3})$/i.exec(t);        // "eggs x12", "eggs × 2"
  const found = lead ? { qty: lead[1], name: lead[2] } : trail ? { qty: trail[2], name: trail[1] } : null;
  if (found && looksLikeFood(found.name.trim())) {
    return { name: found.name.trim().toLowerCase().slice(0, 60), qty: Math.min(MAX_QTY, Math.max(1, Number(found.qty))) };
  }
  return { name: t.toLowerCase().slice(0, 60), qty: null };
}

// Pantry expiration logic. Dates are plain "YYYY-MM-DD" strings in the user's local calendar,
// so there are no time-zone surprises. `today` can be passed in to keep tests deterministic.

const DAY = 86400000;

const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

/** Parses "YYYY-MM-DD" to a local-midnight Date, or null if it isn't a real calendar date. */
export function parseDate(str) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(str || ''));
  if (!m) return null;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const date = new Date(y, mo - 1, d);
  return date.getFullYear() === y && date.getMonth() === mo - 1 && date.getDate() === d ? date : null;
}

export const toDateString = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/** Whole days from today until the date (negative = already expired); null if no valid date. */
export function daysUntil(dateStr, today = new Date()) {
  const date = parseDate(dateStr);
  return date ? Math.round((date - startOfDay(today)) / DAY) : null;
}

/** 'expired' | 'soon' | 'ok' | 'none' */
export function statusOf(dateStr, warnDays = 3, today = new Date()) {
  const days = daysUntil(dateStr, today);
  if (days === null) return 'none';
  if (days < 0) return 'expired';
  return days <= warnDays ? 'soon' : 'ok';
}

const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

/** Friendly text: "Expires tomorrow", "Expired 2 days ago", "Expires Dec 4". */
export function labelOf(dateStr, today = new Date()) {
  const days = daysUntil(dateStr, today);
  if (days === null) return 'No date';
  if (days < -1) return `Expired ${plural(-days, 'day')} ago`;
  if (days === -1) return 'Expired yesterday';
  if (days === 0) return 'Expires today';
  if (days === 1) return 'Expires tomorrow';
  if (days <= 14) return `Expires in ${days} days`;
  return `Expires ${parseDate(dateStr).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`;
}

/** Items that need attention (expired or expiring soon), most urgent first. */
export function expiringItems(pantry, expiry = {}, warnDays = 3, today = new Date()) {
  return pantry
    .map((name) => ({ name, date: expiry[name], days: daysUntil(expiry[name], today) }))
    .filter((i) => i.days !== null && i.days <= warnDays)
    .map((i) => ({ ...i, status: i.days < 0 ? 'expired' : 'soon', label: labelOf(i.date, today) }))
    .sort((a, b) => a.days - b.days || a.name.localeCompare(b.name));
}

/** Pantry items sorted by urgency: expired first, then soonest, undated last. */
export function sortByUrgency(pantry, expiry = {}, today = new Date()) {
  const key = (name) => {
    const d = daysUntil(expiry[name], today);
    return d === null ? Infinity : d;
  };
  return [...pantry].sort((a, b) => key(a) - key(b));
}

/** Food that can still be cooked with: everything not already past its date. */
export function usablePantry(pantry, expiry = {}, today = new Date()) {
  return pantry.filter((name) => {
    const d = daysUntil(expiry[name], today);
    return d === null || d >= 0;
  });
}

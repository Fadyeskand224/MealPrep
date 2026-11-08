// Pantry expiration logic. Run with: npm test
import test from 'node:test';
import assert from 'node:assert/strict';
import { parseDate, toDateString, daysUntil, statusOf, labelOf, expiringItems, sortByUrgency, usablePantry } from '../../src/lib/expiry.js';

const TODAY = new Date(2026, 10, 8, 15, 30); // Nov 8, 2026, mid-afternoon (time of day must not matter)

test('parseDate accepts only real calendar dates', () => {
  assert.ok(parseDate('2026-11-08'));
  assert.ok(parseDate('2028-02-29'), 'leap day');
  for (const bad of ['2026-02-30', '2026-13-01', '2026-00-10', '26-11-08', 'tomorrow', '', null, undefined, '2026-11-08T10:00', '2026-1-8']) {
    assert.equal(parseDate(bad), null, `${bad} should be rejected`);
  }
});

test('daysUntil counts whole local days, ignoring the time of day', () => {
  assert.equal(daysUntil('2026-11-08', TODAY), 0);
  assert.equal(daysUntil('2026-11-09', TODAY), 1);
  assert.equal(daysUntil('2026-11-07', TODAY), -1);
  assert.equal(daysUntil('2026-12-08', TODAY), 30);
  assert.equal(daysUntil('2027-01-01', TODAY), 54, 'across a year boundary');
  assert.equal(daysUntil('nonsense', TODAY), null);
  assert.equal(daysUntil('2026-11-09', new Date(2026, 10, 8, 0, 0, 1)), 1);
  assert.equal(daysUntil('2026-11-09', new Date(2026, 10, 8, 23, 59, 59)), 1);
});

test('daysUntil is correct across daylight-saving changes', () => {
  assert.equal(daysUntil('2026-03-09', new Date(2026, 2, 7, 12)), 2, 'US spring-forward weekend');
  assert.equal(daysUntil('2026-11-02', new Date(2026, 9, 31, 12)), 2, 'US fall-back weekend');
});

test('statusOf follows the warning window', () => {
  assert.equal(statusOf(undefined, 3, TODAY), 'none');
  assert.equal(statusOf('2026-11-07', 3, TODAY), 'expired');
  assert.equal(statusOf('2026-11-08', 3, TODAY), 'soon', 'today counts as soon');
  assert.equal(statusOf('2026-11-11', 3, TODAY), 'soon', 'exactly warnDays away');
  assert.equal(statusOf('2026-11-12', 3, TODAY), 'ok');
  assert.equal(statusOf('2026-11-12', 7, TODAY), 'soon', 'a wider window changes the result');
});

test('labels read naturally', () => {
  assert.equal(labelOf('2026-11-08', TODAY), 'Expires today');
  assert.equal(labelOf('2026-11-09', TODAY), 'Expires tomorrow');
  assert.equal(labelOf('2026-11-12', TODAY), 'Expires in 4 days');
  assert.equal(labelOf('2026-11-07', TODAY), 'Expired yesterday');
  assert.equal(labelOf('2026-11-05', TODAY), 'Expired 3 days ago');
  assert.equal(labelOf(undefined, TODAY), 'No date');
  assert.match(labelOf('2027-03-01', TODAY), /^Expires /);
});

test('expiringItems lists only items needing attention, most urgent first', () => {
  const pantry = ['milk', 'eggs', 'spinach', 'rice', 'yogurt'];
  const expiry = { milk: '2026-11-09', eggs: '2026-11-30', spinach: '2026-11-06', yogurt: '2026-11-08', ghost: '2026-11-08' };
  const list = expiringItems(pantry, expiry, 3, TODAY);
  assert.deepEqual(list.map((i) => `${i.name}:${i.status}`), ['spinach:expired', 'yogurt:soon', 'milk:soon']);
  assert.ok(!list.some((i) => i.name === 'ghost'), 'dates for items no longer in the pantry are ignored');
  assert.deepEqual(expiringItems(['rice'], {}, 3, TODAY), []);
});

test('sortByUrgency puts expired first and undated last, without mutating the input', () => {
  const pantry = ['rice', 'eggs', 'milk', 'spinach'];
  const expiry = { eggs: '2026-11-20', milk: '2026-11-09', spinach: '2026-11-01' };
  assert.deepEqual(sortByUrgency(pantry, expiry, TODAY), ['spinach', 'milk', 'eggs', 'rice']);
  assert.deepEqual(pantry, ['rice', 'eggs', 'milk', 'spinach']);
});

test('usablePantry drops expired food but keeps undated and in-date items', () => {
  const pantry = ['rice', 'milk', 'spinach', 'eggs'];
  const expiry = { milk: '2026-11-08', spinach: '2026-11-07', eggs: '2026-12-01' };
  assert.deepEqual(usablePantry(pantry, expiry, TODAY), ['rice', 'milk', 'eggs']);
});

test('toDateString round-trips with parseDate', () => {
  assert.equal(toDateString(new Date(2026, 0, 5)), '2026-01-05');
  assert.equal(toDateString(parseDate('2026-11-08')), '2026-11-08');
});

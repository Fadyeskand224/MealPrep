// Typed quantities in the scanner. Run with: npm test
import test from 'node:test';
import assert from 'node:assert/strict';
import { parseTypedItem as parse } from '../../src/lib/typedItem.js';

test('an amount before or after the name is understood', () => {
  assert.deepEqual(parse('12 eggs'), { name: 'eggs', qty: 12 });
  assert.deepEqual(parse('3 x rice'), { name: 'rice', qty: 3 });
  assert.deepEqual(parse('3x rice'), { name: 'rice', qty: 3 });
  assert.deepEqual(parse('2 × black beans'), { name: 'black beans', qty: 2 });
  assert.deepEqual(parse('eggs x12'), { name: 'eggs', qty: 12 });
  assert.deepEqual(parse('Eggs × 2'), { name: 'eggs', qty: 2 });
  assert.deepEqual(parse('  5   black   beans '), { name: 'black beans', qty: 5 });
  assert.deepEqual(parse('Greek Yogurt x6'), { name: 'greek yogurt', qty: 6 });
});

test('plain names and names that merely contain digits are left alone', () => {
  assert.deepEqual(parse('eggs'), { name: 'eggs', qty: null });
  assert.deepEqual(parse('2% milk'), { name: '2% milk', qty: null });
  assert.deepEqual(parse('7up'), { name: '7up', qty: null });
  assert.deepEqual(parse('1000 eggs'), { name: '1000 eggs', qty: null }, 'more than three digits is not an amount');
  assert.deepEqual(parse('box 12'), { name: 'box 12', qty: null }, 'a word that ends in x is not a multiplier');
  assert.deepEqual(parse('wax5'), { name: 'wax5', qty: null });
});

test('junk never becomes an item with an amount', () => {
  for (const junk of ['x2', '12', '3 x', '3 x 4', '5 7up', '', '   ', null, undefined]) {
    assert.equal(parse(junk).qty, null, JSON.stringify(junk));
  }
  assert.equal(parse('0 eggs').qty, 1, 'zero is raised to the minimum of one');
});

test('names are capped to the pantry limit', () => {
  assert.equal(parse(`3 ${'a'.repeat(100)}`).name.length, 60);
  assert.equal(parse('a'.repeat(100)).name.length, 60);
});

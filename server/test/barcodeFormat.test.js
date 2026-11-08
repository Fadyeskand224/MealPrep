// Barcode format helpers. Run with: npm test
import test from 'node:test';
import assert from 'node:assert/strict';
import { expandUpcE, normalizeScan, isValidBarcode } from '../../src/lib/barcodeFormat.js';

test('UPC-E codes expand to the correct UPC-A (reference examples)', () => {
  assert.equal(expandUpcE('04252614'), '042100005264', 'Wikipedia worked example (last digit 1)');
  assert.equal(expandUpcE('01234565'), '012345000065', 'last digit 5');
  // each expansion rule produces a valid, 12-digit UPC-A
  for (const e of ['04210004', '01240008', '01234132', '01234214', '01234396']) {
    const out = expandUpcE(e);
    if (out) assert.ok(isValidBarcode(out) && out.length === 12, e);
  }
  assert.equal(expandUpcE('04252615'), null, 'bad check digit');
  assert.equal(expandUpcE('24252614'), null, 'only number systems 0 and 1 exist');
  assert.equal(expandUpcE('1234567'), null);
  assert.equal(expandUpcE('abcdefgh'), null);
});

test('normalizeScan accepts good scans and rejects junk', () => {
  assert.equal(normalizeScan('3017620422003'), '3017620422003');
  assert.equal(normalizeScan(' 3017 6204 22003 '), '3017620422003', 'spaces from typing are ignored');
  assert.equal(normalizeScan('016000275683'), '016000275683');
  assert.equal(normalizeScan('96385074'), '96385074', 'valid EAN-8 stays as is');
  assert.equal(normalizeScan('04252614'), '042100005264', 'UPC-E is expanded');
  for (const bad of ['3017620422004', 'hello', '', null, undefined, '12345', '1234567890123456', '30176204220O3', '-3017620422003']) assert.equal(normalizeScan(bad), null, String(bad));
});

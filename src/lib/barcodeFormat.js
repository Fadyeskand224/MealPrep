// Barcode helpers shared by the phone (validate what the camera read) and the server (validate what it is asked).

/** GS1 check digit for EAN-8 / UPC-A / EAN-13 / GTIN-14. Catches camera misreads before any lookup. */
export function isValidBarcode(code) {
  if (typeof code !== 'string' || ![8, 12, 13, 14].includes(code.length) || !/^\d+$/.test(code)) return false;
  const digits = [...code].map(Number);
  const check = digits.pop();
  const sum = digits.reverse().reduce((s, d, i) => s + d * (i % 2 === 0 ? 3 : 1), 0);
  return (10 - (sum % 10)) % 10 === check;
}

/** UPC-E is a compressed 8-digit form of UPC-A used on small packages; expand it to the 12-digit form. */
export function expandUpcE(code) {
  if (!/^[01]\d{7}$/.test(code)) return null;
  const [n, a, b, c, d, e, f, check] = code;
  const last = Number(f);
  let body;
  if (last <= 2) body = `${n}${a}${b}${f}0000${c}${d}${e}`;
  else if (last === 3) body = `${n}${a}${b}${c}00000${d}${e}`;
  else if (last === 4) body = `${n}${a}${b}${c}${d}00000${e}`;
  else body = `${n}${a}${b}${c}${d}${e}0000${f}`;
  const upcA = `${body}${check}`;
  return isValidBarcode(upcA) ? upcA : null;
}

/**
 * Turns whatever a scanner or a person typed into a barcode we can look up, or null.
 * 8-digit codes starting with 0 or 1 that fail as EAN-8 are tried as UPC-E.
 */
export function normalizeScan(raw) {
  const code = String(raw ?? '').replace(/\s+/g, '');
  if (!/^\d+$/.test(code)) return null;
  if (code.length === 8) {
    if (isValidBarcode(code)) return code;
    return expandUpcE(code);
  }
  return isValidBarcode(code) ? code : null;
}

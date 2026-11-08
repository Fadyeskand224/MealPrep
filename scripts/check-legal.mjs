// Fails if the legal pages still contain placeholder details. Run before publishing: npm run check:legal
import { LEGAL } from '../src/legal/config.js';

const bad = Object.entries(LEGAL).filter(([, v]) => /^\[.*\]$/.test(String(v)));
if (bad.length) {
  console.error('Legal details still need filling in (src/legal/config.js):');
  for (const [k, v] of bad) console.error(`  - ${k}: ${v}`);
  process.exit(1);
}
if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(LEGAL.contactEmail)) {
  console.error('contactEmail is not a valid email address.');
  process.exit(1);
}
console.log('Legal details look filled in.');

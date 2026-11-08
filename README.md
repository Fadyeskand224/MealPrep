# MealPrep

A mobile-first PWA (works on iPhone and Android, installable from the browser) that plans a week of
easy meals, tracks macros, and suggests recipes from what's in your fridge.

## Features
- **One-tap weekly plan**: 7 days × breakfast / lunch / dinner, no repeats, varied proteins, tuned to your calorie goal.
- **Replace any meal**: "Surprise me" or pick from alternatives; optionally never suggest a recipe again.
- **Pantry tab**: add what you have; recipes are ranked by how much you already own and ingredients show "✓ You have this".
- **Macro dashboard**: calories, protein, carbs, fat for the day (eaten vs planned), cycle through days and meals.
- **Login**: sign up / log in.

## Run
```bash
npm install
npm run dev      # http://localhost:5173
npm run build
```

## Notes / TODO
- Accounts and data are stored **on-device** (localStorage, PBKDF2-hashed passwords). `src/lib/auth.js` and
  `src/lib/store.js` are the seams to swap for a real backend so data syncs across devices.
- Three meals average ~1,400 kcal, so the default goal is 1,500. Snacks or portion scaling would support higher goals.
- Food imagery uses emoji + gradient tiles (no AI photos). Real photos can replace `Tile` later.

// r(id, name, emoji, meal, minutes, [kcal, protein, carbs, fat], mainProtein, [ "qty|ingredient" ], [steps])
export const r = (id, name, emoji, meal, mins, m, main, ings, steps) => ({
  id,
  name,
  emoji,
  meal,
  mins,
  kcal: m[0],
  protein: m[1],
  carbs: m[2],
  fat: m[3],
  main,
  ingredients: ings.map((s) => {
    const [qty, name] = s.split('|');
    return { qty, name };
  }),
  steps,
});

// Cuisine tag for every recipe. "American" covers classic diner / home cooking and general breakfast fare.
export const BY_CUISINE = {
  Italian: [
    'l-caprese-pasta', 'd-turkey-meatballs', 'd-garlic-shrimp-pasta', 'd-sausage-peppers', 'b-ricotta-toast', 'l-flatbread-pizza',
    'l-pesto-pasta', 'l-minestrone', 'd-chicken-parmesan', 'd-lasagna', 'd-chicken-alfredo', 'd-eggplant-parm', 'd-mushroom-risotto', 'd-veggie-pizza',
  ],
  Mexican: [
    'b-breakfast-burrito', 'l-chicken-burrito-bowl', 'l-bean-quesadilla', 'd-chicken-fajitas', 'd-beef-tacos', 'b-breakfast-quesadilla',
    'b-huevos-rancheros', 'd-fish-tacos',
  ],
  Mediterranean: [
    'l-greek-chickpea-salad', 'l-hummus-wrap', 'd-lemon-chicken-sheet-pan', 'd-lentil-soup', 'b-shakshuka', 'b-spinach-feta-wrap', 'l-falafel-pita',
    'l-med-quinoa-salad', 'l-shawarma-wrap', 'l-greek-salad', 'd-baked-cod',
  ],
  Asian: [
    'l-teriyaki-bowl', 'l-egg-fried-rice', 'd-beef-broccoli', 'd-tofu-stir-fry', 'l-poke-bowl', 'l-pad-thai', 'l-ramen', 'd-shrimp-fried-rice',
    'd-teriyaki-salmon-bowl', 'd-green-curry',
  ],
  Indian: ['d-chicken-curry', 'd-chana-masala'],
  American: [
    'b-veg-scramble', 'b-overnight-oats', 'b-yogurt-parfait', 'b-pb-banana-toast', 'b-avocado-egg-toast', 'b-banana-pancakes', 'b-cottage-bowl',
    'b-berry-smoothie', 'b-egg-muffins', 'l-tuna-sandwich', 'l-chicken-caesar-wrap', 'l-turkey-avocado-sandwich', 'l-tomato-soup-grilled-cheese',
    'l-quinoa-power-bowl', 'd-baked-salmon', 'd-turkey-chili', 'd-stuffed-peppers', 'd-honey-garlic-pork', 'b-french-toast', 'b-chia-pudding',
    'b-veg-omelette', 'b-fruit-bowl', 'b-lox-bagel', 'b-sweet-potato-hash', 'b-apple-oatmeal', 'b-waffles-berries', 'b-egg-sandwich', 'b-mango-bowl',
    'b-tofu-scramble', 'l-chicken-noodle-soup', 'l-cobb-salad', 'l-blt', 'l-club-sandwich', 'l-veggie-burger', 'l-stuffed-sweet-potato',
    'd-steak-potatoes', 'd-meatloaf', 'd-bbq-chicken', 'd-burger',
  ],
};

export const CUISINES = Object.keys(BY_CUISINE);
export const CUISINE_OF = Object.fromEntries(Object.entries(BY_CUISINE).flatMap(([cuisine, ids]) => ids.map((id) => [id, cuisine])));

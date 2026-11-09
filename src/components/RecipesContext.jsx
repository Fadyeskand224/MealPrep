import { createContext, useContext } from 'react';
import { RECIPES, RECIPE_BY_ID } from '../data/recipes';

/**
 * The recipe library with macros adjusted for the products in the user's pantry (see lib/nutrition.js).
 * Screens read macros from here, so a scanned Greek yogurt changes every meal that uses it. Without any
 * scanned products this is just the original library.
 */
const plain = { list: RECIPES.map((r) => ({ ...r, adjustments: [] })), byId: RECIPE_BY_ID };

export const RecipesContext = createContext(plain);
export const useRecipes = () => useContext(RecipesContext);

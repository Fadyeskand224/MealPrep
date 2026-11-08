import { Icon, Sheet, Stat, Tile } from './ui';
import { analyzeRecipe } from '../lib/planner';
import { MEAL_LABEL } from '../data/recipes';

export default function RecipeSheet({ recipe, pantry, favorite, onFavorite, onClose, onSwap, onAdd }) {
  const { ingredients, haveCount, coreCount } = analyzeRecipe(recipe, pantry);

  return (
    <Sheet title={recipe.name} onClose={onClose}>
      <div className="recipe-hero">
        <Tile recipe={recipe} size="fill" zoom />
        <span className="meal-shade" />
        <button
          className={`heart heart-hero ${favorite ? 'on' : ''}`}
          onClick={() => onFavorite(recipe.id)}
          aria-label={favorite ? 'Remove from favorites' : 'Add to favorites'}
          aria-pressed={favorite}
        >
          <Icon name="heart" size={20} fill={favorite} />
        </button>
        <div className="hero-text">
          <div className="eyebrow light">{MEAL_LABEL[recipe.meal]} · {recipe.cuisine} · {recipe.mins} min · Easy</div>
          <h2>{recipe.name}</h2>
        </div>
      </div>
      <div className="sheet-body">
        <div className="stats">
          <Stat k="kcal" v={recipe.kcal} />
          <Stat k="protein" v={`${recipe.protein}g`} />
          <Stat k="carbs" v={`${recipe.carbs}g`} />
          <Stat k="fat" v={`${recipe.fat}g`} />
        </div>

        <h3>
          Ingredients{' '}
          {pantry.length > 0 && (
            <small className="muted">
              you have {haveCount} of {coreCount}
            </small>
          )}
        </h3>
        <ul className="ings">
          {ingredients.map((i) => (
            <li key={i.name} className={i.have ? 'have' : ''}>
              <span className="ing-qty">{i.qty}</span>
              <span className="ing-name">{i.name}</span>
              {i.have && <span className="badge badge-have">✓ You have this</span>}
            </li>
          ))}
        </ul>

        <h3>Method</h3>
        <ol className="steps">
          {recipe.steps.map((s, idx) => (
            <li key={idx}>{s}</li>
          ))}
        </ol>

        <p className="muted fine">
          Nutrition values are estimates for one serving, not medical advice. If you have allergies or dietary needs, check ingredient labels.
        </p>

        {onAdd && (
          <button className="btn btn-primary btn-block" onClick={onAdd}>
            <Icon name="plus" size={18} /> Add to my week
          </button>
        )}
        {onSwap && (
          <button className="btn btn-ghost btn-block" onClick={onSwap}>
            <Icon name="swap" size={18} /> Replace this meal
          </button>
        )}
      </div>
    </Sheet>
  );
}

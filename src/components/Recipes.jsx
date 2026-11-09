import { useMemo, useState } from 'react';
import { Icon, Tile } from './ui';
import { CUISINES, FILTER_TAGS, MEAL_LABEL } from '../data/recipes';
import { useRecipes } from './RecipesContext';

const MEAL_FILTERS = [['all', 'All'], ['breakfast', 'Breakfast'], ['lunch', 'Lunch'], ['dinner', 'Dinner']];

export default function Recipes({ favorites, onFavorite, onOpen }) {
  const { list: RECIPES } = useRecipes(); // macros adjusted for the user's scanned products
  const [query, setQuery] = useState('');
  const [meal, setMeal] = useState('all');
  const [cuisine, setCuisine] = useState('all');
  const [tags, setTags] = useState([]);
  const [onlyFavs, setOnlyFavs] = useState(false);

  const toggleTag = (k) => setTags((t) => (t.includes(k) ? t.filter((x) => x !== k) : [...t, k]));

  // Everything except the cuisine choice, so each cuisine pill can show how many dishes it would give you.
  const beforeCuisine = useMemo(() => {
    const q = query.trim().toLowerCase();
    const active = FILTER_TAGS.filter((t) => tags.includes(t.key));
    return RECIPES.filter(
      (x) =>
        (meal === 'all' || x.meal === meal) &&
        (!onlyFavs || favorites.includes(x.id)) &&
        active.every((t) => t.test(x)) &&
        (!q || x.name.toLowerCase().includes(q) || x.cuisine.toLowerCase().includes(q) || x.ingredients.some((i) => i.name.includes(q)))
    );
  }, [query, meal, tags, onlyFavs, favorites, RECIPES]);

  const counts = useMemo(() => {
    const c = Object.fromEntries(CUISINES.map((k) => [k, 0]));
    for (const x of beforeCuisine) c[x.cuisine] += 1;
    return c;
  }, [beforeCuisine]);

  const list = cuisine === 'all' ? beforeCuisine : beforeCuisine.filter((x) => x.cuisine === cuisine);
  const anyFilter = cuisine !== 'all' || meal !== 'all' || tags.length > 0 || onlyFavs || query.trim() !== '';
  const clearAll = () => { setQuery(''); setMeal('all'); setCuisine('all'); setTags([]); setOnlyFavs(false); };

  return (
    <div className="screen">
      <header className="top">
        <div>
          <div className="eyebrow">{RECIPES.length} recipes</div>
          <h1>Browse food</h1>
        </div>
      </header>

      <label className="searchbar">
        <Icon name="search" size={20} />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search dishes, cuisines or ingredients"
          enterKeyHint="search"
        />
      </label>

      <div className="pills" role="group" aria-label="Meal type">
        {MEAL_FILTERS.map(([k, label]) => (
          <button key={k} className={`pill ${meal === k ? 'on' : ''}`} onClick={() => setMeal(k)}>{label}</button>
        ))}
      </div>

      <div className="pills" role="group" aria-label="Cuisine">
        <button className={`pill pill-cuisine ${cuisine === 'all' ? 'on' : ''}`} onClick={() => setCuisine('all')}>All cuisines</button>
        {CUISINES.map((c) => (
          <button
            key={c}
            className={`pill pill-cuisine ${cuisine === c ? 'on' : ''}`}
            onClick={() => setCuisine(cuisine === c ? 'all' : c)}
            disabled={counts[c] === 0 && cuisine !== c}
            aria-pressed={cuisine === c}
          >
            {c} <span className="pill-count">{counts[c]}</span>
          </button>
        ))}
      </div>

      <div className="pills" role="group" aria-label="Dietary and quick filters">
        <button className={`pill pill-fav ${onlyFavs ? 'on' : ''}`} onClick={() => setOnlyFavs(!onlyFavs)}>
          <Icon name="heart" size={14} fill={onlyFavs} /> Favorites
        </button>
        {FILTER_TAGS.map((t) => (
          <button key={t.key} className={`pill pill-soft ${tags.includes(t.key) ? 'on' : ''}`} onClick={() => toggleTag(t.key)}>
            {t.label}
          </button>
        ))}
      </div>

      {anyFilter && (
        <div className="result-bar">
          <span><b>{list.length}</b> {list.length === 1 ? 'dish' : 'dishes'}{cuisine !== 'all' ? ` · ${cuisine}` : ''}</span>
          <button className="link-btn" onClick={clearAll}>Clear filters</button>
        </div>
      )}

      {list.length === 0 ? (
        <div className="empty">
          <h2>Nothing matches</h2>
          <p>Try removing a filter or searching for something else.</p>
          <button className="btn btn-ghost" onClick={clearAll}>Clear filters</button>
        </div>
      ) : (
        <div className="rgrid">
          {list.map((x) => {
            const fav = favorites.includes(x.id);
            return (
              <article key={x.id} className="rcard">
                <button className="rcard-photo" onClick={() => onOpen(x.id)} aria-label={`Open ${x.name}`}>
                  <Tile recipe={x} size="fill" />
                  <span className="meal-shade" />
                  <span className="rcard-tag">{MEAL_LABEL[x.meal]}</span>
                </button>
                <button
                  className={`heart ${fav ? 'on' : ''}`}
                  onClick={() => onFavorite(x.id)}
                  aria-label={fav ? `Remove ${x.name} from favorites` : `Add ${x.name} to favorites`}
                  aria-pressed={fav}
                >
                  <Icon name="heart" size={18} fill={fav} />
                </button>
                <button className="rcard-body" onClick={() => onOpen(x.id)}>
                  <b>{x.name}</b>
                  <small>{x.cuisine} · {x.mins} min · {x.kcal} kcal</small>
                </button>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}

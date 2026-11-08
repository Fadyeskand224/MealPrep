import { useMemo, useState } from 'react';
import { Icon, Tile } from './ui';
import { FILTER_TAGS, MEAL_LABEL, RECIPES } from '../data/recipes';

const MEAL_FILTERS = [['all', 'All'], ['breakfast', 'Breakfast'], ['lunch', 'Lunch'], ['dinner', 'Dinner']];

export default function Recipes({ favorites, onFavorite, onOpen }) {
  const [query, setQuery] = useState('');
  const [meal, setMeal] = useState('all');
  const [tags, setTags] = useState([]);
  const [onlyFavs, setOnlyFavs] = useState(false);

  const toggleTag = (k) => setTags((t) => (t.includes(k) ? t.filter((x) => x !== k) : [...t, k]));

  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    const active = FILTER_TAGS.filter((t) => tags.includes(t.key));
    return RECIPES.filter(
      (x) =>
        (meal === 'all' || x.meal === meal) &&
        (!onlyFavs || favorites.includes(x.id)) &&
        active.every((t) => t.test(x)) &&
        (!q || x.name.toLowerCase().includes(q) || x.ingredients.some((i) => i.name.includes(q)))
    );
  }, [query, meal, tags, onlyFavs, favorites]);

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
          placeholder="Search dishes or ingredients"
          enterKeyHint="search"
        />
      </label>

      <div className="pills">
        {MEAL_FILTERS.map(([k, label]) => (
          <button key={k} className={`pill ${meal === k ? 'on' : ''}`} onClick={() => setMeal(k)}>{label}</button>
        ))}
      </div>
      <div className="pills">
        <button className={`pill pill-fav ${onlyFavs ? 'on' : ''}`} onClick={() => setOnlyFavs(!onlyFavs)}>
          <Icon name="heart" size={14} fill={onlyFavs} /> Favorites
        </button>
        {FILTER_TAGS.map((t) => (
          <button key={t.key} className={`pill pill-soft ${tags.includes(t.key) ? 'on' : ''}`} onClick={() => toggleTag(t.key)}>
            {t.label}
          </button>
        ))}
      </div>

      {list.length === 0 ? (
        <div className="empty">
          <h2>Nothing matches</h2>
          <p>Try removing a filter or searching for something else.</p>
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
                  <small>{x.mins} min · {x.kcal} kcal · {x.protein}g protein</small>
                </button>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}

import LegalPage from './LegalPage';
import credits from '../data/photoCredits.json';
import { RECIPES } from '../data/recipes';

const NAME = Object.fromEntries(RECIPES.map((r) => [r.id, r.name]));

/** Public attribution page: Creative Commons licenses require crediting the photographer. */
export default function Credits() {
  const rows = Object.entries(credits).sort((a, b) => (NAME[a[0]] || '').localeCompare(NAME[b[0]] || ''));
  return (
    <LegalPage title="Photo credits">
      <p>
        Food photos in EmsMeals come from <a href="https://commons.wikimedia.org" target="_blank" rel="noreferrer">Wikimedia Commons</a> and
        are used under the free licenses shown below (Creative Commons and public domain). Photos were cropped to a 4:3 frame and
        lightly color-adjusted. Each link goes to the original file, its author and its license terms.
      </p>
      <ul className="credit-list">
        {rows.map(([id, c]) => (
          <li key={id}>
            <b>{NAME[id] || id}</b>
            <span>
              <a href={c.url} target="_blank" rel="noreferrer noopener">“{c.title}”</a> by {c.author || 'Unknown'} · {c.license}
            </span>
          </li>
        ))}
      </ul>
    </LegalPage>
  );
}

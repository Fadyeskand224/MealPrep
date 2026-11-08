import { useEffect, useState } from 'react';
import Login from './components/Login';
import Dashboard from './components/Dashboard';
import Plan from './components/Plan';
import Pantry from './components/Pantry';
import Profile from './components/Profile';
import RecipeSheet from './components/RecipeSheet';
import SwapSheet from './components/SwapSheet';
import { Icon } from './components/ui';
import { currentUser, logOut } from './lib/auth';
import { loadData, saveData, todayIndex, fmtFull, planDate } from './lib/store';
import { generateWeek } from './lib/planner';
import { RECIPE_BY_ID } from './data/recipes';

const TABS = [
  ['today', 'today', 'Today'],
  ['week', 'week', 'Week'],
  ['pantry', 'pantry', 'Pantry'],
  ['me', 'me', 'Profile'],
];

export default function App() {
  const [user, setUser] = useState(currentUser);
  if (!user) return <Login onAuthed={setUser} />;
  return <Main key={user.id} user={user} onLogout={() => { logOut(); setUser(null); }} />;
}

function Main({ user, onLogout }) {
  const [data, setData] = useState(() => loadData(user.id));
  const [tab, setTab] = useState('today');
  const [day, setDay] = useState(() => (data.plan ? todayIndex(data.plan) : 0));
  const [recipe, setRecipe] = useState(null); // { id, day?, slot? }
  const [swap, setSwap] = useState(null);     // { day, slot }

  useEffect(() => saveData(user.id, data), [user.id, data]);
  const update = (patch) => setData((d) => ({ ...d, ...patch }));

  const generate = () => {
    if (data.plan && !window.confirm('Replace this week’s plan with a brand new one?')) return;
    const plan = generateWeek({ target: data.target, dislikes: data.dislikes });
    update({ plan, eaten: {} });
    setDay(0);
  };

  const pickSwap = (newId, never) => {
    const { day: d, slot } = swap;
    const oldId = data.plan.days[d][slot];
    const days = data.plan.days.map((x, i) => (i === d ? { ...x, [slot]: newId } : x));
    const eaten = { ...data.eaten };
    delete eaten[`${d}:${slot}`];
    update({
      plan: { ...data.plan, days },
      eaten,
      dislikes: never && !data.dislikes.includes(oldId) ? [...data.dislikes, oldId] : data.dislikes,
    });
    setSwap(null);
    setRecipe(null);
  };

  const toggleEaten = (d, slot) => {
    const k = `${d}:${slot}`;
    const eaten = { ...data.eaten };
    if (eaten[k]) delete eaten[k]; else eaten[k] = true;
    update({ eaten });
  };

  const addPantry = (item) => !data.pantry.includes(item) && update({ pantry: [...data.pantry, item] });
  const removePantry = (item) => update({ pantry: data.pantry.filter((p) => p !== item) });

  const openRecipe = (id, d, slot) => setRecipe({ id, day: d, slot });
  const openSwap = (d, slot) => setSwap({ day: d, slot });

  return (
    <div className="app">
      <main>
        {tab === 'today' && (
          <Dashboard
            user={user} data={data} day={day} setDay={setDay}
            onGenerate={generate} onOpen={openRecipe} onSwap={openSwap} onToggleEaten={toggleEaten}
          />
        )}
        {tab === 'week' && (
          <Plan
            data={data} onGenerate={generate} onOpen={openRecipe} onSwap={openSwap}
            onJumpDay={(i) => { setDay(i); setTab('today'); }}
          />
        )}
        {tab === 'pantry' && (
          <Pantry pantry={data.pantry} onAdd={addPantry} onRemove={removePantry} onOpen={(id) => openRecipe(id)} />
        )}
        {tab === 'me' && (
          <Profile
            user={user} data={data} onLogout={onLogout}
            onTarget={(target) => update({ target })}
            onRestore={(id) => update({ dislikes: data.dislikes.filter((x) => x !== id) })}
          />
        )}
      </main>

      <nav className="tabbar" style={{ '--i': TABS.findIndex(([k]) => k === tab) }}>
        <span className="tab-indicator" aria-hidden="true" />
        {TABS.map(([k, icon, label]) => (
          <button key={k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)} aria-current={tab === k}>
            <Icon name={icon} size={22} />
            {label}
          </button>
        ))}
      </nav>

      {recipe && (
        <RecipeSheet
          recipe={RECIPE_BY_ID[recipe.id]}
          pantry={data.pantry}
          onClose={() => setRecipe(null)}
          onSwap={recipe.slot ? () => openSwap(recipe.day, recipe.slot) : null}
        />
      )}
      {swap && (
        <SwapSheet
          plan={data.plan} dislikes={data.dislikes} day={swap.day} slot={swap.slot}
          dayLabel={fmtFull(planDate(data.plan, swap.day))}
          onPick={pickSwap} onClose={() => setSwap(null)}
        />
      )}
    </div>
  );
}

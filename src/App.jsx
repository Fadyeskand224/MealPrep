import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Login from './components/Login';
import Dashboard from './components/Dashboard';
import Plan from './components/Plan';
import Pantry from './components/Pantry';
import Profile from './components/Profile';
import RecipeSheet from './components/RecipeSheet';
import SwapSheet from './components/SwapSheet';
import AddToPlanSheet from './components/AddToPlanSheet';
import Recipes from './components/Recipes';
import GrocerySheet from './components/GrocerySheet';
import Privacy from './legal/Privacy';
import Terms from './legal/Terms';
import Credits from './legal/Credits';
import { preloadAll } from './lib/imageCache';
import { Icon } from './components/ui';
import { changePassword, deleteAccount, fetchCurrentUser, logOut } from './lib/auth';
import { setUnauthorizedHandler } from './lib/api';
import { loadServerData, removeLegacyAccounts, saveServerData, writeCache } from './lib/sync';
import { todayIndex, fmtFull, planDate, MAX_PANTRY } from './lib/store';
import { expiringItems, usablePantry } from './lib/expiry';
import { generateWeek } from './lib/planner';
import { RECIPES, RECIPE_BY_ID } from './data/recipes';
import { personalizeAll } from './lib/nutrition';
import { RecipesContext } from './components/RecipesContext';

const TABS = [
  ['today', 'today', 'Today'],
  ['week', 'week', 'Week'],
  ['recipes', 'recipes', 'Recipes'],
  ['pantry', 'pantry', 'Pantry'],
  ['me', 'me', 'Profile'],
];

function Splash({ message, onRetry }) {
  return (
    <div className="splash">
      <div className="splash-logo" aria-hidden="true" />
      {message ? (
        <>
          <p>{message}</p>
          <button className="btn btn-primary" onClick={onRetry}>Try again</button>
        </>
      ) : (
        <div className="spinner" role="status" aria-label="Loading" />
      )}
    </div>
  );
}

const PUBLIC_PAGES = { '/privacy': Privacy, '/terms': Terms, '/credits': Credits };

export default function App() {
  const Public = PUBLIC_PAGES[window.location.pathname.replace(/\/+$/, '')];
  if (Public) return <Public />; // legal pages are readable without an account
  return <AppShell />;
}

function AppShell() {
  const [user, setUser] = useState(undefined); // undefined = still checking the session
  const [bootError, setBootError] = useState('');

  const checkSession = useCallback(() => {
    setBootError('');
    fetchCurrentUser().then(setUser).catch((e) => setBootError(e.message));
  }, []);

  useEffect(() => {
    removeLegacyAccounts();
    setUnauthorizedHandler(() => setUser(null)); // session expired or revoked: back to login
    checkSession();
  }, [checkSession]);

  if (bootError) return <Splash message={bootError} onRetry={checkSession} />;
  if (user === undefined) return <Splash />;
  if (!user) return <Login onAuthed={setUser} />;
  return (
    <Boot
      key={user.id}
      user={user}
      onLogout={async () => { await logOut(user); setUser(null); }}
      onDeleted={() => setUser(null)}
    />
  );
}

/** Fetches the user's saved data from the server, then renders the app. */
function Boot({ user, onLogout, onDeleted }) {
  const [initial, setInitial] = useState(null);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let alive = true;
    setError('');
    loadServerData(user)
      .then((d) => alive && setInitial(d))
      .catch((e) => alive && setError(e.message));
    return () => { alive = false; };
  }, [user, attempt]);

  if (error) return <Splash message={error} onRetry={() => setAttempt((n) => n + 1)} />;
  if (!initial) return <Splash />;
  return <Main user={user} initial={initial} onLogout={onLogout} onDeleted={onDeleted} />;
}

function Main({ user, initial, onLogout, onDeleted }) {
  const [data, setData] = useState(initial);
  const [saveError, setSaveError] = useState(false);
  const [tab, setTab] = useState('today');
  const [day, setDay] = useState(() => (data.plan ? todayIndex(data.plan) : 0));
  const [recipe, setRecipe] = useState(null); // { id, day?, slot? }
  const [swap, setSwap] = useState(null);     // { day, slot }
  const [adding, setAdding] = useState(null);  // recipe id being added to the plan
  const [grocery, setGrocery] = useState(false);

  // "Today" can change while the app stays open (overnight, or resumed from the background).
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const tick = () => setNow(new Date());
    document.addEventListener('visibilitychange', tick);
    window.addEventListener('focus', tick);
    const t = setInterval(tick, 30 * 60e3);
    return () => { document.removeEventListener('visibilitychange', tick); window.removeEventListener('focus', tick); clearInterval(t); };
  }, []);
  const expiring = useMemo(() => expiringItems(data.pantry, data.pantryExpiry, data.expiryWarnDays, now), [data.pantry, data.pantryExpiry, data.expiryWarnDays, now]);
  // Expired food is never offered in recipe ideas, "You have this" badges, or the grocery list.
  const usable = useMemo(() => usablePantry(data.pantry, data.pantryExpiry, now), [data.pantry, data.pantryExpiry, now]);
  // Meal macros adjusted for the products scanned into the pantry (expired food is never counted).
  const personal = useMemo(() => personalizeAll(RECIPES, usable, data.pantryNutrition), [usable, data.pantryNutrition]);


  // Save to the server shortly after every change; retry if the network is down.
  const latest = useRef(data);
  const dirty = useRef(false);
  const firstRun = useRef(true);
  const flush = useCallback(async (opts) => {
    if (!dirty.current) return;
    dirty.current = false;
    try {
      await saveServerData(latest.current, opts);
      setSaveError(false);
    } catch (e) {
      if (e.status === 401) return; // logged out elsewhere; the app returns to the login screen
      dirty.current = true;
      setSaveError(true);
    }
  }, []);

  useEffect(() => {
    latest.current = data;
    if (firstRun.current) { firstRun.current = false; return undefined; }
    dirty.current = true;
    writeCache(user.id, data);
    const t = setTimeout(flush, 700);
    return () => clearTimeout(t);
  }, [data, user.id, flush]);

  useEffect(() => {
    if (!saveError) return undefined;
    const t = setInterval(flush, 5000);
    return () => clearInterval(t);
  }, [saveError, flush]);

  useEffect(() => {
    const onHide = () => { if (document.visibilityState === 'hidden') flush({ keepalive: true }); };
    document.addEventListener('visibilitychange', onHide);
    window.addEventListener('pagehide', onHide);
    return () => { document.removeEventListener('visibilitychange', onHide); window.removeEventListener('pagehide', onHide); };
  }, [flush]);

  const logout = async () => { await flush(); await onLogout(); };
  useEffect(() => preloadAll(RECIPES.map((x) => x.id)), []); // warm the photo cache once per session
  const update = (patch) => setData((d) => ({ ...d, ...patch }));

  const generate = () => {
    if (data.plan && !window.confirm('Replace this week’s plan with a brand new one?')) return;
    const plan = generateWeek({ target: data.target, dislikes: data.dislikes, favorites: data.favorites, lookup: personal.byId });
    update({ plan, eaten: {}, groceryChecked: {} });
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

  // Toggles use the functional form of setData so quick successive taps never overwrite each other.
  const toggleFavorite = (id) =>
    setData((d) => ({ ...d, favorites: d.favorites.includes(id) ? d.favorites.filter((x) => x !== id) : [...d.favorites, id] }));

  // Put any recipe into any day/slot, building a week around it if there isn't one yet.
  const placeInPlan = (id, d, slot) => {
    const plan = data.plan || generateWeek({ target: data.target, dislikes: data.dislikes, favorites: data.favorites, lookup: personal.byId });
    const days = plan.days.map((x, i) => (i === d ? { ...x, [slot]: id } : x));
    const eaten = { ...data.eaten };
    delete eaten[`${d}:${slot}`];
    update({ plan: { ...plan, days }, eaten });
    if (!data.plan) setDay(0);
    setAdding(null);
    setRecipe(null);
    setDay(d);
    setTab('today');
  };

  const toggleGrocery = (name) =>
    setData((d) => {
      const groceryChecked = { ...d.groceryChecked };
      if (groceryChecked[name]) delete groceryChecked[name]; else groceryChecked[name] = true;
      return { ...d, groceryChecked };
    });

  const toggleEaten = (day, slot) =>
    setData((d) => {
      const k = `${day}:${slot}`;
      const eaten = { ...d.eaten };
      if (eaten[k]) delete eaten[k]; else eaten[k] = true;
      return { ...d, eaten };
    });

  const clampQty = (n) => Math.max(1, Math.min(999, Math.round(n)));
  // Everything the app remembers about one pantry item lives under its name in a few maps.
  const dropItem = (d, item) => {
    const pantryExpiry = { ...d.pantryExpiry };
    const pantryQty = { ...d.pantryQty };
    const pantryNutrition = { ...d.pantryNutrition };
    delete pantryExpiry[item];
    delete pantryQty[item];
    delete pantryNutrition[item];
    return { ...d, pantry: d.pantry.filter((p) => p !== item), pantryExpiry, pantryQty, pantryNutrition };
  };

  // Adding something that is already there raises its quantity. Nutrition facts from a scan are kept
  // for the item (the first one saved wins, so a later look-alike product never overwrites it).
  const addPantry = (item, { date = null, qty = 1, nutrition = null } = {}) =>
    setData((d) => {
      const exists = d.pantry.includes(item);
      if (!exists && d.pantry.length >= MAX_PANTRY) return d; // the server caps the pantry; never exceed it
      return {
        ...d,
        pantry: exists ? d.pantry : [...d.pantry, item],
        pantryQty: { ...d.pantryQty, [item]: clampQty((exists ? d.pantryQty[item] || 1 : 0) + qty) },
        pantryExpiry: date ? { ...d.pantryExpiry, [item]: date } : d.pantryExpiry,
        pantryNutrition: nutrition && !d.pantryNutrition[item] ? { ...d.pantryNutrition, [item]: nutrition } : d.pantryNutrition,
      };
    });
  const bumpQty = (item, delta) =>
    setData((d) => (d.pantry.includes(item) ? { ...d, pantryQty: { ...d.pantryQty, [item]: clampQty((d.pantryQty[item] || 1) + delta) } } : d));
  // "Undo" for the scanner: take back `amount` (what that scan added), or drop the item if nothing would be left.
  const undoPantry = (item, amount = 1) =>
    setData((d) => {
      const have = d.pantryQty[item] || 1;
      return have > amount ? { ...d, pantryQty: { ...d.pantryQty, [item]: have - amount } } : dropItem(d, item);
    });
  const removePantry = (item) => setData((d) => dropItem(d, item));
  // Fix a name in place (keeps its position, quantity, date and nutrition). Renaming onto an existing item merges them.
  const renamePantry = (from, to) =>
    setData((d) => {
      const name = to.trim().toLowerCase().slice(0, 60);
      if (!name || name === from || !d.pantry.includes(from)) return d;
      const idx = d.pantry.indexOf(from);
      const without = d.pantry.filter((p) => p !== from);
      const merging = without.includes(name);
      const pantry = merging ? without : [...without.slice(0, idx), name, ...without.slice(idx)];
      const pantryExpiry = { ...d.pantryExpiry };
      const pantryQty = { ...d.pantryQty };
      const pantryNutrition = { ...d.pantryNutrition };
      const moved = { date: pantryExpiry[from], qty: pantryQty[from] || 1, nutrition: pantryNutrition[from] };
      delete pantryExpiry[from];
      delete pantryQty[from];
      delete pantryNutrition[from];
      if (moved.date && !pantryExpiry[name]) pantryExpiry[name] = moved.date;
      pantryQty[name] = clampQty((merging ? pantryQty[name] || 1 : 0) + moved.qty);
      if (moved.nutrition && !pantryNutrition[name]) pantryNutrition[name] = moved.nutrition;
      return { ...d, pantry, pantryExpiry, pantryQty, pantryNutrition };
    });
  const setExpiry = (item, date) =>
    setData((d) => {
      const pantryExpiry = { ...d.pantryExpiry };
      if (date) pantryExpiry[item] = date; else delete pantryExpiry[item];
      return { ...d, pantryExpiry };
    });

  const openRecipe = (id, d, slot) => setRecipe({ id, day: d, slot });
  const openSwap = (d, slot) => setSwap({ day: d, slot });

  return (
    <RecipesContext.Provider value={personal}>
    <div className="app">
      {saveError && (
        <div className="save-banner" role="status">
          Can’t reach the server. Your changes will save when you’re back online.
        </div>
      )}
      <main>
        {tab === 'today' && (
          <Dashboard
            user={user} data={data} day={day} setDay={setDay}
            onGenerate={generate} onOpen={openRecipe} onSwap={openSwap} onToggleEaten={toggleEaten}
            expiring={expiring} onGoPantry={() => setTab('pantry')}
          />
        )}
        {tab === 'week' && (
          <Plan
            data={data} onGenerate={generate} onOpen={openRecipe} onSwap={openSwap} onGrocery={() => setGrocery(true)}
            onJumpDay={(i) => { setDay(i); setTab('today'); }}
          />
        )}
        {tab === 'recipes' && (
          <Recipes favorites={data.favorites} onFavorite={toggleFavorite} onOpen={(id) => openRecipe(id)} />
        )}
        {tab === 'pantry' && (
          <Pantry
            pantry={data.pantry} qty={data.pantryQty} nutrition={data.pantryNutrition} expiry={data.pantryExpiry}
            warnDays={data.expiryWarnDays} usable={usable}
            onAdd={addPantry} onRemove={removePantry} onUndo={undoPantry} onRename={renamePantry} onQty={bumpQty} onSetExpiry={setExpiry}
            onWarnDays={(n) => update({ expiryWarnDays: n })} onOpen={(id) => openRecipe(id)}
          />
        )}
        {tab === 'me' && (
          <Profile
            user={user} data={data} onLogout={logout}
            onChangePassword={changePassword}
            onDeleteAccount={async (password) => { await deleteAccount(user, password); onDeleted(); }}
            onTarget={(target) => update({ target })}
            onRestore={(id) => update({ dislikes: data.dislikes.filter((x) => x !== id) })}
          />
        )}
      </main>

      <nav className="tabbar" style={{ '--i': TABS.findIndex(([k]) => k === tab) }}>
        <span className="tab-indicator" aria-hidden="true" />
        {TABS.map(([k, icon, label]) => (
          <button key={k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)} aria-current={tab === k}>
            <span className="tab-ico">
              <Icon name={icon} size={22} />
              {k === 'pantry' && expiring.length > 0 && (
                <i className="tab-dot" aria-label={`${expiring.length} pantry items need attention`}>{expiring.length}</i>
              )}
            </span>
            {label}
          </button>
        ))}
      </nav>

      {recipe && (
        <RecipeSheet
          recipe={personal.byId[recipe.id]}
          pantry={usable}
          favorite={data.favorites.includes(recipe.id)}
          onFavorite={toggleFavorite}
          onClose={() => setRecipe(null)}
          onSwap={recipe.slot ? () => openSwap(recipe.day, recipe.slot) : null}
          onAdd={recipe.slot ? null : () => setAdding(recipe.id)}
        />
      )}
      {grocery && data.plan && (
        <GrocerySheet
          plan={data.plan} pantry={usable} checked={data.groceryChecked}
          onToggle={toggleGrocery} onClearChecked={() => update({ groceryChecked: {} })}
          onClose={() => setGrocery(false)}
        />
      )}
      {adding && (
        <AddToPlanSheet
          recipe={RECIPE_BY_ID[adding]} plan={data.plan}
          onAdd={(d, slot) => placeInPlan(adding, d, slot)} onClose={() => setAdding(null)}
        />
      )}
      {swap && (
        <SwapSheet
          plan={data.plan} dislikes={data.dislikes} favorites={data.favorites} day={swap.day} slot={swap.slot}
          dayLabel={fmtFull(planDate(data.plan, swap.day))}
          onPick={pickSwap} onClose={() => setSwap(null)}
        />
      )}
    </div>
    </RecipesContext.Provider>
  );
}

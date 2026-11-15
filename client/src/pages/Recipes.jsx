import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, inr, amount } from '../api.js';
import { useApp } from '../context.jsx';
import { Img, Spinner, IngredientList } from '../components.jsx';

const MOODS = [['all', '✨ Everything'], ['breakfast', 'Breakfast'], ['dinner', 'Dinner'], ['snack', 'Snacks'], ['beverage', 'Drinks'], ['dessert', 'Dessert'], ['quick', '⚡ Under 15 min']];

const Mosaic = ({ thumbs = [] }) => <div className="mosaic">{[0, 1, 2].map((i) => thumbs[i] ? <Img key={i} src={thumbs[i]} alt="" /> : <div key={i} />)}</div>;

export default function Recipes() {
  const { changeCart, toast } = useApp();
  const [list, setList] = useState([]); const [aiEnabled, setAi] = useState(false); const [tab, setTab] = useState('recipe'); const [mood, setMood] = useState('all');
  const [query, setQuery] = useState(''); const [servings, setServings] = useState(4); const [budget, setBudget] = useState(''); const [pantry, setPantry] = useState(''); const [diet, setDiet] = useState('');
  const [days, setDays] = useState(3); const [people, setPeople] = useState(2); const [mBudget, setMBudget] = useState(700); const [mDiet, setMDiet] = useState('vegetarian');
  const [res, setRes] = useState(null); const [plan, setPlan] = useState(null); const [miss, setMiss] = useState(null); const [busy, setBusy] = useState(false); const [selected, setSelected] = useState(new Set());
  useEffect(() => { api('/ai/recipes').then((r) => { setList(r.recipes); setAi(r.aiEnabled); }); }, []);
  const shown = useMemo(() => list.filter((r) => (mood === 'all' ? true : mood === 'quick' ? r.minutes <= 15 : r.meal === mood)), [list, mood]);
  const pick = (lines) => new Set(lines.filter((l) => l.status === 'matched').map((l) => l.product.id));

  const runRecipe = async (body) => {
    setBusy(true); setPlan(null); setMiss(null);
    try {
      const r = await api('/ai/recipe', { method: 'POST', body: { ...body, servings: +servings, budget: budget ? +budget : null, pantry: pantry.split(',').map((x) => x.trim()).filter(Boolean), diet: diet ? [diet] : undefined } });
      setRes(r); setSelected(pick(r.plan.lines)); setTimeout(() => document.getElementById('result')?.scrollIntoView({ behavior: 'smooth' }), 60);
    } catch (e) { setRes(null); if (e.data?.closest) setMiss({ msg: e.message, closest: e.data.closest, ai: e.data.aiEnabled }); else toast(e.message, 'err'); } finally { setBusy(false); }
  };
  const runPlan = async () => {
    setBusy(true); setRes(null); setMiss(null);
    try { const r = await api('/ai/mealplan', { method: 'POST', body: { days: +days, servings: +people, budget: +mBudget, diet: mDiet ? [mDiet] : [] } }); setPlan(r.plan); setSelected(pick(r.plan.lines)); }
    catch (e) { setPlan(null); toast(e.message, 'err'); } finally { setBusy(false); }
  };
  const addSelected = async (lines) => {
    const changes = lines.filter((l) => l.status === 'matched' && selected.has(l.product.id)).map((l) => ({ productId: l.product.id, qty: l.units, mode: 'add' }));
    if (!changes.length) return toast('Select at least one ingredient', 'err'); await changeCart(changes); toast(`Added ${changes.length} items to your cart`);
  };
  const Add = ({ lines }) => <div className="row between" style={{ marginTop: 14 }}><span className="small muted">{selected.size} item(s) selected</span><div className="row"><button className="btn primary" onClick={() => addSelected(lines)}>Add selected to cart</button><Link className="btn" to="/cart">View cart</Link></div></div>;

  return (
    <div className="stack" style={{ marginTop: 8 }}>
      <section className="mood">
        <h1>What are you in the mood for?</h1>
        <p>{aiEnabled ? 'Type any dish — the AI drafts the recipe and we match ingredients to real products.' : 'Type a dish, or pick one below. Ingredients are matched to real in-stock products.'}</p>
        <form className="bar" onSubmit={(e) => { e.preventDefault(); query.trim().length > 1 && runRecipe({ query }); }}>
          <label className="sr" htmlFor="rq">Dish</label><input id="rq" className="grow" value={query} onChange={(e) => setQuery(e.target.value)} placeholder='e.g. "maggi", "paneer fried rice", "something with potatoes"' />
          <button className="btn primary" disabled={busy || query.trim().length < 2}>{busy ? 'Planning…' : '🍳 Plan it'}</button>
        </form>
        <div className="opts">
          <div><label htmlFor="sv">Servings</label><input id="sv" type="number" min="1" max="20" value={servings} onChange={(e) => setServings(e.target.value)} /></div>
          <div><label htmlFor="bg">Max budget (₹)</label><input id="bg" type="number" min="0" value={budget} placeholder="optional" onChange={(e) => setBudget(e.target.value)} /></div>
          <div><label htmlFor="dt">Diet</label><select id="dt" value={diet} onChange={(e) => setDiet(e.target.value)}><option value="">Any</option><option>vegetarian</option><option>vegan</option></select></div>
          <div><label htmlFor="pt">I already have</label><input id="pt" value={pantry} placeholder="oil, salt" onChange={(e) => setPantry(e.target.value)} /></div>
        </div>
      </section>

      <div className="row between"><div className="pills">{[['recipe', '🍳 Recipes'], ['plan', '📅 Budget meal plan']].map(([k, l]) => <button key={k} className={`pill ${tab === k ? 'on' : ''}`} onClick={() => setTab(k)}>{l}</button>)}</div>
        {!aiEnabled && <span className="badge amber" title="Add an API key in server/.env to plan any dish">AI recipes off · {list.length} recipes available</span>}</div>

      {tab === 'plan' && <div className="card stack"><h3>Plan breakfast + dinner within a budget</h3><div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))' }}>
        <div><label htmlFor="d">Days</label><input id="d" type="number" min="1" max="14" value={days} onChange={(e) => setDays(e.target.value)} /></div>
        <div><label htmlFor="pp">People</label><input id="pp" type="number" min="1" max="12" value={people} onChange={(e) => setPeople(e.target.value)} /></div>
        <div><label htmlFor="mb">Budget (₹)</label><input id="mb" type="number" min="0" value={mBudget} onChange={(e) => setMBudget(e.target.value)} /></div>
        <div><label htmlFor="md">Diet</label><select id="md" value={mDiet} onChange={(e) => setMDiet(e.target.value)}><option value="">Any</option><option>vegetarian</option><option>vegan</option></select></div></div>
        <div><button className="btn primary" disabled={busy} onClick={runPlan}>Build my plan</button></div></div>}

      {busy && <Spinner />}
      {miss && <div className="card stack"><b>🤔 {miss.msg}</b>
        {miss.closest.length > 0 && <><span className="muted">Closest matches — tap to plan:</span><div className="rgrid">{miss.closest.map((r) => <button key={r.slug} className="rc" onClick={() => { setQuery(r.name); runRecipe({ slug: r.slug }); }}><Mosaic thumbs={r.thumbs} /><div className="info"><h3>{r.name}</h3><span className="badge">{r.meal}</span> <span className="muted small">{r.minutes} min</span></div></button>)}</div></>}
        <div><Link className="btn" to={`/shop?q=${encodeURIComponent(query.split(' ').slice(-1)[0] || '')}`}>🔎 Search products instead</Link></div></div>}

      {res && <section id="result" className="card"><div className="row between"><h2 style={{ margin: 0 }}>{res.plan.recipe.name}</h2><span className={`badge ${res.plan.recipe.source.includes('unverified') ? 'amber' : 'green'}`}>{res.plan.recipe.source}</span></div>
        <p className="muted small">{res.plan.servings} servings{res.plan.recipe.minutes ? ` · ${res.plan.recipe.minutes} min` : ''} {res.plan.recipe.source.includes('unverified') && '· AI-drafted: please sanity-check quantities'}</p>
        {res.plan.dietWarning && <div className="banner">{res.plan.dietWarning}</div>}
        <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(170px,1fr))', margin: '12px 0' }}>
          <div className="kpi"><div className="muted small">Cart cost (whole packs)</div><div className="stat">{inr(res.plan.cost.buyCost)}</div></div>
          <div className="kpi"><div className="muted small">Portions actually used</div><div className="stat">{inr(res.plan.cost.usedCostEstimate)}</div></div>
          {res.plan.budget && <div className="kpi"><div className="muted small">Budget {inr(res.plan.budget.limit)}</div><b style={{ color: res.plan.budget.fitsBuyCost ? 'var(--ok)' : 'var(--danger)' }}>{res.plan.budget.fitsBuyCost ? 'Cart fits ✓' : `Cart ${inr(res.plan.budget.buyOverBy)} over`}</b><div className="small muted">{res.plan.budget.fitsUsedCost ? 'Portions used fit' : 'Portions used exceed too'}</div></div>}
        </div>
        <IngredientList lines={res.plan.lines} selected={selected} setSelected={setSelected} /><Add lines={res.plan.lines} />
        {res.plan.recipe.steps?.length > 0 && <><h3 style={{ marginTop: 20 }}>Method</h3><ol className="steps">{res.plan.recipe.steps.map((s) => <li key={s}><span>{s}</span></li>)}</ol></>}
        <p className="small muted">{res.plan.disclaimer}</p></section>}

      {plan && <section className="card"><h2>{plan.days}-day plan for {plan.servings}</h2><p><b>{plan.note}</b></p><div className="pills" style={{ marginBottom: 8 }}>{plan.meals.map((m) => <span key={m.slug} className="pill on">{m.name} ×{m.times}</span>)}</div>
        <IngredientList lines={plan.lines} selected={selected} setSelected={setSelected} /><Add lines={plan.lines} /><p className="small muted">{plan.disclaimer}</p></section>}

      {tab === 'recipe' && <>
        <div className="section-title"><h2>Browse recipes</h2><div className="pills">{MOODS.map(([k, l]) => <button key={k} className={`pill ${mood === k ? 'on' : ''}`} onClick={() => setMood(k)}>{l}</button>)}</div></div>
        <div className="rgrid">{shown.map((r) => (
          <button key={r.slug} className="rc" onClick={() => { setQuery(r.name); setServings(r.servings); runRecipe({ slug: r.slug }); }} aria-label={`Plan ${r.name}`}>
            <Mosaic thumbs={r.thumbs} />
            <div className="info"><h3>{r.name}</h3><div className="row"><span className="badge">{r.meal}</span><span className="muted small">⏱ {r.minutes} min · serves {r.servings}</span></div><div className="row" style={{ marginTop: 6 }}>{r.dietary.map((d) => <span key={d} className="badge green">{d}</span>)}</div></div>
          </button>))}</div>
      </>}
    </div>
  );
}

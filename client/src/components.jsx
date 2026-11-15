import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useApp } from './context.jsx';
import { inr, amount } from './api.js';

export const Img = ({ src, alt, ...r }) => <img src={src || '/images/products/_fallback.svg'} alt={alt} loading="lazy" onError={(e) => { e.currentTarget.onerror = null; e.currentTarget.src = '/images/products/_fallback.svg'; }} {...r} />;
export const Spinner = () => <div className="spin" role="status" aria-label="Loading" />;
export const Empty = ({ icon = '🧺', title, children }) => <div className="empty"><div className="big" aria-hidden>{icon}</div><h3>{title}</h3><div>{children}</div></div>;
export const Stars = ({ r, n }) => <span title={`${r} out of 5`}>★ {r}{n ? <span className="muted small"> ({n})</span> : null}</span>;
export const ErrorBox = ({ error, retry }) => <div className="card" role="alert"><b>Something went wrong.</b> <span className="muted">{error}</span> {retry && <button className="btn sm" onClick={retry}>Retry</button>}</div>;

export function ProductCard({ p, reasons, badge }) {
  const { addToCart, toggleWish, wish } = useApp();
  const out = p.stock <= 0;
  return (
    <article className="pc">
      <div className="img">
        <Link to={`/product/${p.slug}`} aria-label={`View ${p.name}`}><Img src={p.imageUrl} alt={p.name} /></Link>
        {p.discountPercent > 0 && <span className="tag badge amber">{p.discountPercent}% OFF</span>}
        <button className="heart" onClick={() => toggleWish(p)} aria-pressed={wish.has(p.id)} aria-label={wish.has(p.id) ? 'Remove from wishlist' : 'Add to wishlist'}>{wish.has(p.id) ? '❤️' : '🤍'}</button>
      </div>
      <div className="body">
        <span className="muted small">{p.brand} · {amount(p)}</span>
        <Link to={`/product/${p.slug}`} className="name">{p.name}</Link>
        <div className="row small muted"><Stars r={p.rating} n={p.ratingCount} />{p.unitPrice != null && <span>· {inr(p.unitPrice)}/{p.unit === 'pc' ? 'pc' : `100${p.unit}`}</span>}</div>
        <div><span className="price">{inr(p.price)}</span>{p.mrp > p.price && <span className="mrp">{inr(p.mrp)}</span>}</div>
        {badge}
        {reasons?.length > 0 && <div className="why"><b>Why this?</b><ul style={{ margin: '4px 0 0', padding: 0 }}>{reasons.map((r) => <li key={r}>{r}</li>)}</ul></div>}
        <div className="grow" />
        {out ? <button className="btn" disabled>Out of stock</button> : <button className="btn primary" onClick={() => addToCart(p)}>Add to cart</button>}
      </div>
    </article>
  );
}

export const FILTER_KEYS = ['q', 'minPrice', 'maxPrice', 'categories', 'brands', 'diet', 'excludeAllergens', 'inStock', 'maxDeliveryMins', 'minDiscount', 'minRating', 'minShelfLifeDays', 'minProtein', 'maxSugar', 'maxUnitPrice', 'sort'];
const LABEL = { q: 'Search', minPrice: 'Min ₹', maxPrice: 'Max ₹', categories: 'Category', brands: 'Brand', diet: 'Diet', excludeAllergens: 'No', inStock: 'In stock', maxDeliveryMins: 'Delivery ≤ min', minDiscount: 'Discount ≥ %', minRating: 'Rating ≥', minShelfLifeDays: 'Shelf life ≥ days', minProtein: 'Protein ≥ g/100g', maxSugar: 'Sugar ≤ g/100g', maxUnitPrice: 'Unit price ≤' };
export const chipText = (k, v) => (k === 'inStock' ? 'In stock only' : `${LABEL[k]}: ${v}`);

const csvToggle = (cur, val) => { const s = new Set((cur || '').split(',').filter(Boolean)); s.has(val) ? s.delete(val) : s.add(val); return [...s].join(','); };
export function FilterPanel({ f, set, clear, categories, brands }) {
  const has = (k, v) => (f[k] || '').split(',').includes(v);
  const Group = ({ title, children }) => <fieldset style={{ border: 0, padding: 0, margin: '0 0 14px' }}><legend style={{ fontWeight: 700, marginBottom: 6 }}>{title}</legend>{children}</fieldset>;
  const Opt = ({ k, v, label }) => <label className="check"><input type="checkbox" checked={has(k, v)} onChange={() => set({ [k]: csvToggle(f[k], v) })} />{label || v}</label>;
  const Sel = ({ k, opts, unit }) => <select aria-label={k} value={f[k] || ''} onChange={(e) => set({ [k]: e.target.value })}><option value="">Any</option>{opts.map((o) => <option key={o} value={o}>{unit ? `${o} ${unit}` : o}</option>)}</select>;
  return (
    <div className="stack">
      <div className="row between"><h3>Smart Filters</h3><button className="btn sm" onClick={clear}>Clear all</button></div>
      <Group title="Price (₹)"><div className="row"><input aria-label="Minimum price" type="number" min="0" placeholder="Min" value={f.minPrice || ''} onChange={(e) => set({ minPrice: e.target.value })} style={{ width: '48%' }} /><input aria-label="Maximum price" type="number" min="0" placeholder="Max" value={f.maxPrice || ''} onChange={(e) => set({ maxPrice: e.target.value })} style={{ width: '48%' }} /></div></Group>
      <Group title="Category">{categories.map((c) => <Opt key={c.slug} k="categories" v={c.slug} label={`${c.emoji} ${c.name}`} />)}</Group>
      <Group title="Diet">{['vegetarian', 'vegan', 'gluten-free', 'eggetarian'].map((d) => <Opt key={d} k="diet" v={d} />)}</Group>
      <Group title="Avoid allergens">{['peanut', 'nuts', 'milk', 'gluten', 'soy', 'egg'].map((d) => <Opt key={d} k="excludeAllergens" v={d} />)}</Group>
      <Group title="Brand"><div style={{ maxHeight: 150, overflow: 'auto' }}>{brands.map((b) => <Opt key={b} k="brands" v={b} />)}</div></Group>
      <Group title="Availability"><label className="check"><input type="checkbox" checked={f.inStock === 'true'} onChange={(e) => set({ inStock: e.target.checked ? 'true' : '' })} />In stock only</label><label>Delivery within</label><Sel k="maxDeliveryMins" opts={[15, 20, 25]} unit="min" /></Group>
      <Group title="Deals & quality"><label>Min discount</label><Sel k="minDiscount" opts={[5, 10, 15, 20]} unit="%" /><label style={{ marginTop: 8 }}>Min rating</label><Sel k="minRating" opts={[4, 4.3, 4.5]} unit="★" /></Group>
      <Group title="Nutrition (only items with data)"><label className="check"><input type="checkbox" checked={f.minProtein === '10'} onChange={(e) => set({ minProtein: e.target.checked ? '10' : '' })} />High protein (≥10 g/100 g)</label><label className="check"><input type="checkbox" checked={f.maxSugar === '5'} onChange={(e) => set({ maxSugar: e.target.checked ? '5' : '' })} />Low sugar (≤5 g/100 g)</label></Group>
      <Group title="Freshness"><label>Shelf life at least</label><Sel k="minShelfLifeDays" opts={[7, 30, 90]} unit="days" /></Group>
    </div>
  );
}

// One ingredient per row: photo, what is needed, matched product, price and its own Add button.
export function IngredientList({ lines, selected, setSelected }) {
  const { changeCart, toast, cart } = useApp();
  const qtyInCart = (id) => cart.items.find((i) => i.product.id === id)?.qty || 0;
  const addOne = async (l) => { await changeCart([{ productId: l.product.id, qty: Math.max(l.units, qtyInCart(l.product.id)), mode: 'set' }]); toast(`Added ${l.product.name}`); };
  return lines.map((l) => (
    <div key={l.label} className="ing">
      {l.status === 'matched' ? <input type="checkbox" aria-label={`Select ${l.label}`} checked={selected.has(l.product.id)} onChange={() => setSelected((s) => { const n = new Set(s); n.has(l.product.id) ? n.delete(l.product.id) : n.add(l.product.id); return n; })} /> : <span />}
      {l.status === 'matched' ? <Img src={l.product.imageUrl} alt="" /> : <div className="ph" aria-hidden>{l.status === 'have-it' ? '✓' : '—'}</div>}
      <div><b>{l.label}</b> <span className="muted small">need {l.needed.qty} {l.needed.unit}</span>
        <div className="small muted">{l.status === 'matched' ? <>{l.product.name} · {amount(l.product)} · buy {l.units}</> : l.status === 'have-it' ? <span className="badge green">You have it</span> : <><span className="badge red">Not sold here</span> {l.reason}</>}</div></div>
      <b>{l.status === 'matched' ? inr(l.buyCost) : ''}</b>
      {l.status === 'matched' ? (qtyInCart(l.product.id) >= l.units ? <span className="badge green">In cart ✓</span> : <button className="btn sm primary" onClick={() => addOne(l)}>+ Add</button>) : <span />}
    </div>
  ));
}

// Shopping list card used by the Copilot: pick items, see the live total, add one / selected / all to the cart.
export function PlanCard({ title, badge, lines, cost, budget, steps, disclaimer }) {
  const { changeCart, toast, cart } = useApp();
  const matched = lines.filter((l) => l.status === 'matched');
  const [selected, setSelected] = useState(() => new Set(matched.map((l) => l.product.id)));
  const chosen = matched.filter((l) => selected.has(l.product.id));
  const total = chosen.reduce((t, l) => t + l.buyCost, 0);
  const addSelected = async () => {
    if (!chosen.length) return toast('Tick at least one item', 'err');
    const have = (id) => cart.items.find((i) => i.product.id === id)?.qty || 0;
    await changeCart(chosen.map((l) => ({ productId: l.product.id, qty: Math.max(l.units, have(l.product.id)), mode: 'set' }))); toast(`Added ${chosen.length} item${chosen.length > 1 ? 's' : ''} to your cart`);
  };
  return (
    <div className="card" style={{ marginTop: 8 }}>
      <div className="row between"><h3 style={{ margin: 0 }}>{title}</h3>{badge && <span className={`badge ${String(badge).includes('unverified') ? 'amber' : 'green'}`}>{badge}</span>}</div>
      {budget && <p className="small" style={{ margin: '6px 0 0', color: budget.fitsBuyCost ? 'var(--ok)' : 'var(--danger)' }}>{budget.fitsBuyCost ? `Fits your ${inr(budget.limit)} budget ✓` : `${inr(budget.buyOverBy)} over your ${inr(budget.limit)} budget (portions actually used: ${budget.fitsUsedCost ? 'fit' : 'also exceed'})`}</p>}
      <div style={{ marginTop: 6 }}><IngredientList lines={lines} selected={selected} setSelected={setSelected} /></div>
      <div className="row between" style={{ marginTop: 12 }}>
        <div><div className="small muted">{chosen.length} of {matched.length} selected</div><b style={{ fontSize: '1.2rem' }}>{inr(total)}</b>{cost?.usedCostEstimate != null && <span className="small muted"> · portions used ≈ {inr(cost.usedCostEstimate)}</span>}</div>
        <div className="row"><button className="btn primary" onClick={addSelected}>Add selected to cart</button><Link className="btn" to="/cart">View cart</Link></div>
      </div>
      {steps?.length > 0 && <><h4 style={{ margin: '16px 0 4px' }}>Method</h4><ol className="steps">{steps.map((st) => <li key={st}><span>{st}</span></li>)}</ol></>}
      {disclaimer && <p className="small muted" style={{ marginBottom: 0 }}>{disclaimer}</p>}
    </div>
  );
}

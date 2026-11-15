import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api, inr, amount, recent } from '../api.js';
import { useApp } from '../context.jsx';
import { Img, Spinner, ErrorBox, Stars, ProductCard } from '../components.jsx';

export default function Product() {
  const { slug } = useParams(); const { addToCart, toggleWish, wish } = useApp();
  const [d, setD] = useState(null); const [err, setErr] = useState(''); const [qty, setQty] = useState(1);
  useEffect(() => { setD(null); setErr(''); api(`/products/${slug}`).then((r) => { setD(r); recent.add(r.product.id); }).catch((e) => setErr(e.message)); window.scrollTo(0, 0); }, [slug]);
  if (err) return <ErrorBox error={err} />; if (!d) return <Spinner />;
  const p = d.product, n = p.nutrition, out = p.stock <= 0;
  return (
    <div style={{ marginTop: 16 }}>
      <p className="small muted"><Link to="/shop">Shop</Link> / <Link to={`/shop?categories=${p.category}`}>{p.category}</Link> / {p.name}</p>
      <div className="two">
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}><Img src={p.imageUrl} alt={p.name} style={{ width: '100%', aspectRatio: '4/3', objectFit: 'cover' }} /></div>
        <div className="stack">
          <h1 style={{ fontSize: '2rem' }}>{p.name}</h1>
          <div className="row"><span className="muted">{p.brand} · {amount(p)}</span><Stars r={p.rating} n={p.ratingCount} />{p.dietaryLabels.map((l) => <span key={l} className="badge green">{l}</span>)}</div>
          <div><span className="price" style={{ fontSize: '1.8rem' }}>{inr(p.price)}</span>{p.mrp > p.price && <><span className="mrp">{inr(p.mrp)}</span> <span className="badge amber">{p.discountPercent}% off</span></>}</div>
          <div className="muted small">{inr(p.unitPrice)} {p.unit === 'pc' ? 'per piece' : `per 100 ${p.unit}`} · {out ? 'Out of stock' : p.stock < 20 ? `Only ${p.stock} left` : 'In stock'}{p.deliveryMinutes ? ` · ~${p.deliveryMinutes} min delivery (stored estimate)` : ''}</div>
          <div className="row"><input type="number" min="1" max={Math.max(1, p.stock)} value={qty} onChange={(e) => setQty(Math.max(1, +e.target.value || 1))} aria-label="Quantity" style={{ width: 80 }} /><button className="btn primary" disabled={out} onClick={() => addToCart(p, qty)}>Add to cart</button><button className="btn" onClick={() => toggleWish(p)}>{wish.has(p.id) ? '❤️ Saved' : '🤍 Save'}</button></div>
          {p.description && <p>{p.description}</p>}
          {p.ingredients && <p><b>Ingredients:</b> {p.ingredients}</p>}
          {p.allergens.length > 0 && <p><b>Declared allergens:</b> {p.allergens.join(', ')}</p>}
          {p.expiryDate && <p className="small muted">Best before ~{new Date(p.expiryDate).toLocaleDateString()}</p>}
          {n ? <div className="card"><b>Nutrition per {n.per} {n.perUnit}</b><div className="row small" style={{ marginTop: 6 }}><span>{n.calories} kcal</span><span>Protein {n.protein} g</span><span>Sugar {n.sugar} g</span><span>Fat {n.fat} g</span></div><div className="small muted">Source: {n.source}</div></div> : <p className="small muted">No nutrition data is stored for this product.</p>}
        </div>
      </div>
      <h2 style={{ marginTop: 30 }}>Smart substitutes</h2>
      {d.substitutes.length === 0 ? <p className="muted">No in-stock product with matching dietary labels and purpose was found, so none are suggested.</p> :
        <div className="grid">{d.substitutes.map((s) => <ProductCard key={s.product.id} p={s.product} reasons={[...s.reasons, `${s.differences.priceDiff >= 0 ? '+' : '−'}${inr(Math.abs(s.differences.priceDiff))} vs this item · ${s.differences.packSize}`, s.nutrition.available ? `Protein ${s.nutrition.proteinDiffPer100 >= 0 ? '+' : ''}${s.nutrition.proteinDiffPer100} g, sugar ${s.nutrition.sugarDiffPer100 >= 0 ? '+' : ''}${s.nutrition.sugarDiffPer100} g per 100` : s.nutrition.note]} />)}</div>}
    </div>
  );
}

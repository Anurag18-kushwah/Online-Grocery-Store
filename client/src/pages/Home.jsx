import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api, recent } from '../api.js';
import { useApp } from '../context.jsx';
import { ProductCard, Spinner, ErrorBox, Img } from '../components.jsx';

const CAT_PHOTO = { fruits: 'royal-gala-apples', vegetables: 'carrots', dairy: 'toned-milk-1-l', snacks: 'roasted-chana', beverages: 'orange-juice-1-l', staples: 'basmati-rice-1-kg', 'personal-care': 'herbal-shampoo', household: 'dishwash-liquid-750-ml' };
const COLLAGE = ['carrots', 'toned-milk-1-l', 'fresh-tomatoes', 'royal-gala-apples'];

export default function Home() {
  const { user, cart } = useApp(); const nav = useNavigate();
  const [cats, setCats] = useState([]); const [rec, setRec] = useState(null); const [deals, setDeals] = useState([]); const [err, setErr] = useState(''); const [text, setText] = useState('');
  useEffect(() => { (async () => {
    try {
      const [c, d, r] = await Promise.all([api('/categories'), api('/products', { query: { sort: 'discount', inStock: 'true', minDiscount: 10 } }), api('/ai/recommend', { method: 'POST', body: { viewed: recent.get(), limit: 8 } })]);
      setCats(c.categories); setDeals(d.products.slice(0, 4)); setRec(r);
    } catch (e) { setErr(e.message); }
  })(); }, [user, cart.count]);
  const ask = (e) => { e.preventDefault(); if (text.trim()) nav(`/shop?nl=${encodeURIComponent(text.trim())}`); };
  return (
    <>
      <section className="hero">
        <div className="hero-copy">
        <span className="badge" style={{ background: 'rgba(255,255,255,.2)', color: '#fff' }}>✨ Explainable grocery intelligence</span>
        <h1 style={{ marginTop: 12 }}>Smarter Choices.<br />Fresher Living.</h1>
        <p>Tell GrocerAI what you need — a budget, a diet, a dish. Every recommendation comes with the reason behind it.</p>
        <form className="nl" onSubmit={ask} role="search"><label className="sr" htmlFor="nl">Describe what you want</label><input id="nl" value={text} onChange={(e) => setText(e.target.value)} placeholder='Try: "vegetarian snacks under ₹200"' /><button className="btn primary">Ask</button></form>
        <div className="row" style={{ marginTop: 14 }}><Link className="btn" to="/optimizer">⚖️ Optimize my basket</Link><Link className="btn" to="/recipes">🍳 Recipe to cart</Link><Link className="btn" to="/copilot">💬 AI Copilot</Link></div>
        </div>
        <div className="collage" aria-hidden>{COLLAGE.map((s) => <figure key={s}><Img src={`/images/products/${s}.svg`} alt="" /></figure>)}</div>
      </section>
      {err && <ErrorBox error={err} />}
      <h2>Shop by category</h2>
      <div className="cats">{cats.map((c) => <Link key={c.slug} className="cat photo" to={`/shop?categories=${c.slug}`}><Img src={`/images/products/${CAT_PHOTO[c.slug] || '_fallback'}.svg`} alt="" /><b>{c.name}</b></Link>)}</div>
      <div className="row between" style={{ margin: '28px 0 10px' }}><div><h2 style={{ margin: 0 }}>{rec?.strategy === 'personalised' ? 'Picked for you' : rec?.strategy === 'session' ? 'Based on your cart & browsing' : 'Popular right now'}</h2><span className="muted small">{rec ? rec.method : ''}</span></div></div>
      {!rec && !err ? <Spinner /> : <div className="grid">{rec?.recommendations.map((r) => <ProductCard key={r.product.id} p={r.product} reasons={r.reasons} />)}</div>}
      {deals.length > 0 && <><h2 style={{ marginTop: 30 }}>Best discounts today</h2><div className="grid">{deals.map((p) => <ProductCard key={p.id} p={p} />)}</div></>}
    </>
  );
}

import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '../api.js';
import { useApp } from '../context.jsx';
import { ProductCard, Spinner, Empty, ErrorBox, FilterPanel, FILTER_KEYS, chipText } from '../components.jsx';

export default function Shop() {
  const { toast } = useApp();
  const [params, setParams] = useSearchParams();
  const f = useMemo(() => Object.fromEntries(FILTER_KEYS.map((k) => [k, params.get(k)]).filter(([, v]) => v)), [params]);
  const [data, setData] = useState(null); const [err, setErr] = useState(''); const [cats, setCats] = useState([]); const [brands, setBrands] = useState([]);
  const [nl, setNl] = useState(params.get('nl') || ''); const [parsed, setParsed] = useState(null); const [drawer, setDrawer] = useState(false);

  const set = (patch) => { const p = new URLSearchParams(params); p.delete('nl'); for (const [k, v] of Object.entries(patch)) v ? p.set(k, v) : p.delete(k); setParams(p, { replace: true }); };
  const clear = () => { setParsed(null); setParams({}, { replace: true }); };

  useEffect(() => { api('/categories').then((c) => setCats(c.categories)); api('/products').then((r) => setBrands([...new Set(r.products.map((p) => p.brand))].sort())); }, []);
  useEffect(() => { setData(null); setErr(''); api('/products', { query: f }).then(setData).catch((e) => setErr(e.message)); }, [params]); // eslint-disable-line

  const runNl = async (text) => {
    try {
      const r = await api('/ai/parse-filter', { method: 'POST', body: { text } }); setParsed(r);
      if (r.intent === 'basket') return toast('That sounds like a basket question: try the Basket Optimizer', 'ok');
      const p = new URLSearchParams(); for (const [k, v] of Object.entries(r.filters)) p.set(k, Array.isArray(v) ? v.join(',') : String(v)); setParams(p, { replace: true });
    } catch (e) { toast(e.message, 'err'); }
  };
  useEffect(() => { const t = params.get('nl'); if (t) runNl(t); }, []); // eslint-disable-line

  const chips = Object.entries(f).filter(([k]) => k !== 'sort');
  const suggestions = data && data.total === 0 && chips.length ? chips.slice(0, 3) : [];
  return (
    <div className="layout" style={{ marginTop: 16 }}>
      <aside className={`side card ${drawer ? 'open' : ''}`} aria-label="Filters">
        <button className="btn sm filter-btn" onClick={() => setDrawer(false)} style={{ marginBottom: 10 }}>✕ Close</button>
        <FilterPanel f={f} set={set} clear={clear} categories={cats} brands={brands} />
        <button className="btn primary filter-btn" style={{ width: '100%', marginTop: 12 }} onClick={() => setDrawer(false)}>Show {data?.total ?? ''} results</button>
      </aside>
      <section>
        <form className="row" onSubmit={(e) => { e.preventDefault(); nl.trim() && runNl(nl.trim()); }}>
          <label className="sr" htmlFor="nlq">Natural language filter</label>
          <input id="nlq" className="grow" value={nl} onChange={(e) => setNl(e.target.value)} placeholder='Ask in plain English: "peanut-free low sugar snacks under ₹150"' />
          <button className="btn primary">✨ Apply</button>
          <button type="button" className="btn filter-btn" onClick={() => setDrawer(true)}>Filters</button>
        </form>
        {parsed && <p className="small muted">Understood as <b>{parsed.source}</b>: {parsed.chips.join(' · ') || 'no filters found'}{parsed.note ? ` — ${parsed.note}` : ''}</p>}
        <div className="row between" style={{ margin: '12px 0' }}>
          <div className="row">{chips.map(([k, v]) => <span key={k} className="chip">{chipText(k, v)}<button aria-label={`Remove ${k}`} onClick={() => set({ [k]: '' })}>×</button></span>)}{chips.length > 0 && <button className="btn sm" onClick={clear}>Clear all</button>}</div>
          <div className="row"><span className="muted" aria-live="polite">{data ? `${data.total} product${data.total === 1 ? '' : 's'}` : ''}</span>
            <label className="sr" htmlFor="sort">Sort</label>
            <select id="sort" style={{ width: 'auto' }} value={f.sort || 'popular'} onChange={(e) => set({ sort: e.target.value })}>
              <option value="popular">Most popular</option><option value="price-asc">Price: low to high</option><option value="price-desc">Price: high to low</option><option value="discount">Biggest discount</option><option value="rating">Top rated</option><option value="value">Best value for money</option>
            </select></div>
        </div>
        {data?.excludedForMissingData > 0 && <p className="banner small">{data.excludedForMissingData} product(s) were left out because they have no nutrition/expiry data for the filter you chose.</p>}
        {err ? <ErrorBox error={err} /> : !data ? <Spinner /> : data.total === 0 ? (
          <Empty icon="🔍" title="No products match these filters">
            <p>Try loosening one of them:</p><div className="row" style={{ justifyContent: 'center' }}>{suggestions.map(([k, v]) => <button key={k} className="btn sm" onClick={() => set({ [k]: '' })}>Remove “{chipText(k, v)}”</button>)}<button className="btn sm" onClick={clear}>Clear all</button></div>
          </Empty>
        ) : <div className="grid">{data.products.map((p) => <ProductCard key={p.id} p={p} />)}</div>}
      </section>
    </div>
  );
}

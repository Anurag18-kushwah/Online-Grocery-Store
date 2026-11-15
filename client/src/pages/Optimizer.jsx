import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api, inr } from '../api.js';
import { useApp } from '../context.jsx';
import { Img, Empty, Spinner } from '../components.jsx';

const GOALS = [['minimizeSpend', 'Minimize total spending'], ['maximizeValue', 'Maximize value per unit'], ['healthier', 'Prefer lower sugar (only where data exists)'], ['frequent', 'Prefer products I buy often'], ['minimizeSubstitutions', 'Minimize substitutions (same-brand pack swaps only)']];

export default function Optimizer() {
  const { cart, changeCart, toast } = useApp();
  const [budget, setBudget] = useState(''); const [goals, setGoals] = useState({ minimizeSpend: true }); const [avoid, setAvoid] = useState(''); const [res, setRes] = useState(null); const [busy, setBusy] = useState(false); const [applied, setApplied] = useState(new Set());
  const run = async () => {
    setBusy(true); setApplied(new Set());
    try { setRes(await api('/ai/optimize', { method: 'POST', body: { budget: budget ? +budget : null, goals: { ...goals, avoid: avoid.split(',').map((x) => x.trim().toLowerCase()).filter(Boolean) } } })); }
    catch (e) { toast(e.message, 'err'); } finally { setBusy(false); }
  };
  const approve = async (s) => {
    await changeCart([{ productId: s.fromProductId, qty: 0 }, { productId: s.toProduct.id, qty: s.toQty, mode: 'add' }]);
    setApplied((a) => new Set(a).add(s.id)); toast(`Swapped to ${s.toProduct.name}`);
  };
  if (!cart.items.length && !res) return <Empty icon="⚖️" title="Add items to analyse your basket"><Link className="btn primary" to="/shop">Browse products</Link></Empty>;
  return (
    <div style={{ marginTop: 16 }} className="stack">
      <h1>Basket Optimizer</h1>
      <p className="muted">A transparent, rule-based analysis of your real cart. Nothing changes until you approve a suggestion.</p>
      <div className="card two">
        <div className="stack"><div><label htmlFor="b">Budget (₹)</label><input id="b" type="number" min="0" value={budget} onChange={(e) => setBudget(e.target.value)} placeholder="e.g. 500" /></div>
          <div><label htmlFor="av">Avoid (allergens / declared ingredients, comma-separated)</label><input id="av" value={avoid} onChange={(e) => setAvoid(e.target.value)} placeholder="peanut, soy" /></div></div>
        <fieldset style={{ border: 0, padding: 0 }}><legend style={{ fontWeight: 700 }}>Goals</legend>{GOALS.map(([k, l]) => <label key={k} className="check"><input type="checkbox" checked={!!goals[k]} onChange={(e) => setGoals({ ...goals, [k]: e.target.checked })} />{l}</label>)}</fieldset>
        <div><button className="btn primary" onClick={run} disabled={busy || !cart.items.length}>{busy ? 'Analysing…' : 'Analyse my basket'}</button></div>
      </div>
      {busy && <Spinner />}
      {res && (<>
        <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))' }}>
          <div className="card"><div className="muted small">Current total</div><div className="stat">{inr(res.total)}</div></div>
          {res.budget != null && <div className="card"><div className="muted small">{res.overBudget ? 'Over budget by' : 'Budget remaining'}</div><div className="stat" style={{ color: res.overBudget ? 'var(--danger)' : 'var(--ok)' }}>{inr(Math.abs(res.remaining))}</div></div>}
          <div className="card"><div className="muted small">Possible savings</div><div className="stat">{inr(res.potentialSavings)}</div><div className="small muted">→ {inr(res.projectedTotal)} if all applied</div></div>
        </div>
        {res.pathToBudget && <div className="banner">{res.pathToBudget.reachesBudget ? `Applying ${res.pathToBudget.suggestionIds.length} suggestion(s) would bring you within budget (${inr(res.pathToBudget.projectedTotal)}).` : `Even with every suggestion you'd still be ${inr(res.pathToBudget.shortfall)} over budget. Consider removing items.`}</div>}
        {res.duplicates.map((d) => <div key={d.names.join()} className="banner">🔁 {d.message}</div>)}
        {res.conflicts.map((c) => <div key={c.productId} className="banner" style={{ borderColor: 'var(--danger)' }}>⚠️ {c.message}</div>)}
        <h2>Most expensive items</h2><div className="row">{res.expensive.map((e) => <span key={e.productId} className="badge">{e.name}: {inr(e.lineTotal)} ({Math.round(e.share * 100)}%)</span>)}</div>
        <h2>Suggestions <span className="muted small">({res.suggestions.length})</span></h2>
        {res.suggestions.length === 0 && <p className="muted">No like-for-like alternatives would save money for these items.</p>}
        {res.suggestions.map((s) => (
          <div key={s.id} className="card row" style={{ alignItems: 'flex-start' }}>
            <Img src={s.toProduct.imageUrl} alt="" style={{ width: 80, height: 80, borderRadius: 12, objectFit: 'cover' }} />
            <div className="grow stack">
              <div><span className="badge green">{s.type.replace('-', ' ')}</span> <b>{s.fromName}</b> → <b>{s.toQty} × {s.toProduct.name}</b></div>
              <div>{s.saving > 0 ? <b style={{ color: 'var(--ok)' }}>Save {inr(s.saving)} ({s.savingPct}%)</b> : <b>Costs {inr(-s.saving)} more</b>} · new line total {inr(s.newLineTotal)}</div>
              <ul className="small muted" style={{ margin: 0, paddingLeft: 18 }}>{s.tradeoffs.map((t) => <li key={t}>{t}</li>)}</ul>
            </div>
            <button className="btn primary" disabled={applied.has(s.id)} onClick={() => approve(s)}>{applied.has(s.id) ? 'Applied ✓' : 'Approve swap'}</button>
          </div>))}
        <details className="card"><summary><b>How this works & limitations</b></summary><p className="small muted">{res.method}</p><ul className="small muted">{res.limitations.map((l) => <li key={l}>{l}</li>)}</ul></details>
      </>)}
    </div>
  );
}

import { useEffect, useRef, useState } from 'react';
import { api, inr } from '../api.js';
import { useApp } from '../context.jsx';
import { ProductCard, PlanCard } from '../components.jsx';

const IDEAS = ['i want to cook paneer rice', 'how do I cook maggi?', 'Find vegetarian snacks under ₹200', 'Show high-protein breakfast products', 'Plan vegetarian paneer fried rice for four people under ₹300', 'I have ₹700 for breakfast and dinner groceries for three days. Suggest a vegetarian shopping list.', 'Find cheaper alternatives to my current basket', 'Compare rolled oats and corn flakes', 'Substitute for Fresh Paneer'];

// Minimal safe markdown: **bold**, "- " bullets, line breaks (rendered as React nodes, never raw HTML).
function Md({ text }) {
  const inline = (t) => t.split(/(\*\*[^*]+\*\*)/g).map((x, i) => (x.startsWith('**') && x.endsWith('**') ? <b key={i}>{x.slice(2, -2)}</b> : x));
  const blocks = []; let list = [];
  const flush = () => { if (list.length) { blocks.push(<ul key={blocks.length} style={{ margin: '6px 0', paddingLeft: 20 }}>{list.map((l, i) => <li key={i}>{inline(l)}</li>)}</ul>); list = []; } };
  String(text).split('\n').forEach((line) => { const m = line.match(/^\s*(?:[-*•]|\d+\.)\s+(.*)/); if (m) list.push(m[1]); else { flush(); if (line.trim()) blocks.push(<p key={blocks.length} style={{ margin: '4px 0' }}>{inline(line)}</p>); } });
  flush(); return <>{blocks}</>;
}

function Cards({ c, send }) {
  c = { ...c, send };
  const { changeCart, toast } = useApp();
  if (c.products) return <div className="grid" style={{ marginTop: 8 }}>{c.products.slice(0, 4).map((p) => <ProductCard key={p.id} p={p} />)}</div>;
  if (c.ideas) return <div className="row" style={{ marginTop: 8 }}>{c.ideas.map((r) => <button key={r.slug} className="pill" onClick={() => c.send(`plan ${r.name}`)}>{r.name} · {r.minutes} min</button>)}</div>;
  if (c.compare) return <div className="scroll"><table className="table"><thead><tr><th></th>{c.compare.map((p) => <th key={p.id}>{p.name}</th>)}</tr></thead><tbody>
    {[['Price', (p) => inr(p.price)], ['Unit price', (p) => `${inr(p.unitPrice)} ${p.unitLabel}`], ['Rating', (p) => `★ ${p.rating}`], ['Protein /100', (p) => p.nutrition ? `${p.nutrition.protein} g` : 'no data'], ['Sugar /100', (p) => p.nutrition ? `${p.nutrition.sugar} g` : 'no data']].map(([l, f]) => <tr key={l}><th>{l}</th>{c.compare.map((p) => <td key={p.id}>{f(p)}</td>)}</tr>)}</tbody></table></div>;
  if (c.substitutes) return <div className="grid" style={{ marginTop: 8 }}>{c.substitutes.substitutes.map((s) => <ProductCard key={s.product.id} p={s.product} reasons={s.reasons} />)}</div>;
  if (c.recipe) return <PlanCard title={`${c.recipe.recipe.name} · ${c.recipe.servings} servings`} badge={c.recipe.recipe.source} lines={c.recipe.lines} cost={c.recipe.cost} budget={c.recipe.budget} steps={c.recipe.recipe.steps} disclaimer={c.recipe.disclaimer} />;
  if (c.mealplan) return <PlanCard title={`${c.mealplan.days}-day plan for ${c.mealplan.servings}`} lines={c.mealplan.lines} cost={{ usedCostEstimate: null }} budget={c.mealplan.budget != null ? { limit: c.mealplan.budget, fitsBuyCost: c.mealplan.fitsBudget, buyOverBy: Math.max(0, c.mealplan.buyCost - c.mealplan.budget), fitsUsedCost: false } : null} disclaimer={c.mealplan.disclaimer} />;
  if (c.optimizer) return <p className="small">{c.optimizer.suggestions.map((s) => <span key={s.id} className="badge green" style={{ marginRight: 6 }}>{s.fromName} → {s.toProduct.name}: save {inr(s.saving)}</span>)} <a href="/optimizer">Review & approve in the Optimizer →</a></p>;
  return null;
}

export default function Copilot() {
  const [msgs, setMsgs] = useState([{ role: 'bot', text: "Hi! I'm your GrocerAI copilot. I search the real catalogue, plan recipes, compare prices and find savings in your cart." }]);
  const [text, setText] = useState(''); const [busy, setBusy] = useState(false); const [status, setStatus] = useState(null); const end = useRef();
  useEffect(() => { api('/ai/status').then(setStatus).catch(() => {}); }, []);
  useEffect(() => { end.current?.scrollIntoView({ behavior: 'smooth' }); }, [msgs, busy]);
  const send = async (m) => {
    if (!m.trim() || busy) return; setMsgs((x) => [...x, { role: 'user', text: m }]); setText(''); setBusy(true);
    try { const history = msgs.filter((x) => x.text).slice(-6).map((x) => ({ role: x.role, text: String(x.text).slice(0, 500) })); const r = await api('/ai/chat', { method: 'POST', body: { message: m, history } }); setMsgs((x) => [...x, { role: 'bot', ...r, text: r.reply }]); }
    catch (e) { setMsgs((x) => [...x, { role: 'bot', text: `Sorry, that failed: ${e.message}` }]); } finally { setBusy(false); }
  };
  return (
    <div style={{ marginTop: 16 }}>
      <div className="row between"><h1>AI Shopping Copilot</h1><button className="btn sm" onClick={() => setMsgs(msgs.slice(0, 1))}>New chat</button>{status && <span className={`badge ${status.llm ? 'green' : 'amber'}`} title={status.note}>{status.llm ? `LLM: ${status.llm}` : 'Fallback mode (no LLM configured)'}</span>}</div>
      {status && !status.llm && <div className="banner small" style={{ margin: '8px 0' }}>💡 Real-time AI is <b>off</b>: I answer from built-in logic and 40+ recipes. To chat about <b>anything</b> and plan <b>any dish</b>, connect a model: stop the app and run <code>npm run setup</code> (2 minutes, free).</div>}
      <div className="card chat">
        <div className="msgs" aria-live="polite">
          {msgs.map((m, i) => (
            <div key={i}><div className={`msg ${m.role}`}>{m.role === 'bot' && <span className="avatar" aria-hidden>🥬</span>}<div className="bubble"><Md text={m.text} /></div></div>
              {m.role === 'bot' && m.cards && <Cards c={m.cards} send={send} />}
              {m.role === 'bot' && m.tools?.length > 0 && <details className="small muted" style={{ marginLeft: 6 }}><summary>Tools used · {m.source}</summary>{m.tools.map((t) => <div key={t.name}>🔧 {t.name} → {t.result}</div>)}{m.assumptions?.map((a) => <div key={a}>ℹ️ {a}</div>)}{m.note && <div>⚠️ {m.note}</div>}<div>{m.limits}</div></details>}
            </div>))}
          {busy && <div className="msg bot"><span className="avatar" aria-hidden>🥬</span><div className="bubble"><span className="dots"><i /><i /><i /></span></div></div>}<div ref={end} />
        </div>
        <div className="row" style={{ margin: '8px 0' }}>{IDEAS.slice(0, 5).map((s) => <button key={s} className="btn sm" onClick={() => send(s)}>{s.length > 42 ? s.slice(0, 40) + '…' : s}</button>)}</div>
        <form className="row" onSubmit={(e) => { e.preventDefault(); send(text); }}><label className="sr" htmlFor="cq">Message</label><input id="cq" className="grow" maxLength={500} value={text} onChange={(e) => setText(e.target.value)} placeholder="Ask about products, recipes, budgets…" /><button className="btn primary" disabled={busy}>Send</button></form>
      </div>
    </div>
  );
}

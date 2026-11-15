import { useEffect, useRef, useState } from 'react';
import { api, inr } from '../api.js';
import { useApp } from '../context.jsx';
import { Spinner } from '../components.jsx';

const blank = { name: '', category: 'snacks', brand: '', mrp: '', discountPercent: 0, stock: 0, unit: 'g', packSize: '' };

export default function Admin() {
  const { toast } = useApp();
  const [tab, setTab] = useState('overview');
  const [stats, setStats] = useState(null);
  const [products, setProducts] = useState([]);
  const [orders, setOrders] = useState([]);
  const [cats, setCats] = useState([]);
  const [form, setForm] = useState(blank);
  const [edits, setEdits] = useState({});
  const [editingProduct, setEditingProduct] = useState(null);
  const [soundEnabled, setSoundEnabled] = useState(false);
  const [notificationStatus, setNotificationStatus] = useState(null);

  const seenOrderIds = useRef(null);
  const soundEnabledRef = useRef(false);
  const audioContextRef = useRef(null);
  soundEnabledRef.current = soundEnabled;

  const playOrderSound = () => {
    try {
      const ctx = audioContextRef.current;
      if (!ctx || ctx.state !== 'running') return;
      const oscillator = ctx.createOscillator();
      const gain = ctx.createGain();
      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(880, ctx.currentTime);
      oscillator.frequency.setValueAtTime(1174, ctx.currentTime + 0.14);
      gain.gain.setValueAtTime(0.0001, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.18, ctx.currentTime + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.42);
      oscillator.connect(gain);
      gain.connect(ctx.destination);
      oscillator.start();
      oscillator.stop(ctx.currentTime + 0.44);
    } catch (e) {
      console.warn('Order alert sound unavailable:', e);
    }
  };

  const toggleSound = async () => {
    if (soundEnabled) {
      setSoundEnabled(false);
      return;
    }
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) {
        toast('This browser does not support sound alerts', 'err');
        return;
      }
      if (!audioContextRef.current) audioContextRef.current = new AudioCtx();
      await audioContextRef.current.resume();
      setSoundEnabled(true);
      playOrderSound();
    } catch {
      toast('Could not enable sound. Check browser permissions.', 'err');
    }
  };

  const load = async ({ notifyNew = false } = {}) => {
    const [s, p, o, c, n] = await Promise.all([
      api('/admin/stats'),
      api('/products'),
      api('/admin/orders'),
      api('/categories'),
      api('/admin/notifications/status')
    ]);
    const incomingIds = new Set(o.orders.map((order) => order.id));
    if (notifyNew && seenOrderIds.current) {
      const fresh = o.orders.filter((order) => !seenOrderIds.current.has(order.id));
      if (fresh.length) {
        toast(`${fresh.length} new order${fresh.length > 1 ? 's' : ''} received!`, 'ok');
        if (soundEnabledRef.current) playOrderSound();
      }
    }
    seenOrderIds.current = incomingIds;
    setStats(s);
    setProducts(p.products);
    setOrders(o.orders);
    setCats(c.categories);
    setNotificationStatus(n);
  };

  useEffect(() => {
    let active = true;
    load().catch((e) => toast(e.message, 'err'));
    const timer = setInterval(() => {
      if (active) load({ notifyNew: true }).catch((e) => console.warn('Order refresh failed:', e));
    }, 10000);
    return () => {
      active = false;
      clearInterval(timer);
      audioContextRef.current?.close().catch(() => {});
      audioContextRef.current = null;
    };
  }, []); // eslint-disable-line

  const act = async (fn, ok) => {
    try {
      await fn();
      toast(ok);
      await load();
    } catch (e) {
      toast(e.message, 'err');
    }
  };

  if (!stats) return <Spinner />;

  const resetProductForm = () => {
    setForm(blank);
    setEditingProduct(null);
  };

  const submitProduct = (e) => {
    e.preventDefault();

    const payload = {
      ...(editingProduct || {}),
      ...form,
      mrp: Number(form.mrp),
      discountPercent: Number(form.discountPercent),
      stock: Number(form.stock),
      packSize: Number(form.packSize)
    };

    if (editingProduct) {
      act(
        () => api(`/admin/products/${editingProduct.id}`, { method: 'PUT', body: payload })
          .then(() => resetProductForm()),
        'Product updated'
      );
    } else {
      act(
        () => api('/admin/products', { method: 'POST', body: payload })
          .then(() => setForm(blank)),
        'Product added'
      );
    }
  };

  const startEdit = (p) => {
    setEditingProduct(p);
    setForm({
      name: p.name || '',
      category: p.category || 'snacks',
      brand: p.brand || '',
      mrp: String(p.mrp ?? p.price ?? ''),
      discountPercent: String(p.discountPercent ?? 0),
      stock: String(p.stock ?? 0),
      unit: p.unit || 'g',
      packSize: String(p.packSize ?? '')
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="stack" style={{ marginTop: 16 }}>
      <h1>Admin dashboard</h1>
      <div className="row between" style={{ flexWrap: 'wrap' }}>
        <div className="row">
          {['overview', 'products', 'orders'].map((t) => (
            <button key={t} className={`btn ${tab === t ? 'primary' : ''}`} onClick={() => setTab(t)}>
              {t}{t === 'orders' && stats.byStatus?.placed ? ` (${stats.byStatus.placed} placed)` : ''}
            </button>
          ))}
        </div>
        <button className={`btn ${soundEnabled ? 'primary' : ''}`} onClick={toggleSound}>
          {soundEnabled ? 'Sound alerts on' : 'Enable sound alerts'}
        </button>
      </div>

      <div className="card small">
        <b>Order notifications:</b> Live dashboard {notificationStatus?.liveDashboard ? '✓' : '—'} ·
        Email {notificationStatus?.email ? '✓ configured' : 'not configured'} ·
        WhatsApp {notificationStatus?.whatsapp ? '✓ configured' : 'not configured'}
        <br />
        <span className="muted">Dashboard checks for new orders every 10 seconds. Keep this page open for live alerts.</span>
      </div>

      {tab === 'overview' && <>
        <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(170px,1fr))' }}>
          <div className="card"><div className="muted small">Orders</div><div className="stat">{stats.orders}</div></div>
          <div className="card"><div className="muted small">Revenue (excl. cancelled)</div><div className="stat">{inr(stats.revenue)}</div></div>
          <div className="card"><div className="muted small">Products</div><div className="stat">{stats.products}</div></div>
          <div className="card"><div className="muted small">Out of stock</div><div className="stat">{stats.outOfStock.length}</div></div>
        </div>
        <p className="muted small">All figures are computed live from stored orders and products.</p>
        <div className="two">
          <div className="card">
            <h3>Top sellers</h3>
            {stats.topProducts.map((t) => <div key={t.name} className="row between"><span>{t.name}</span><b>{t.qty}</b></div>)}
            {!stats.topProducts.length && <span className="muted">No orders yet</span>}
          </div>
          <div className="card">
            <h3>Low stock</h3>
            {stats.lowStock.map((t) => <div key={t.id} className="row between"><span>{t.name}</span><span className="badge amber">{t.stock}</span></div>)}
            {stats.outOfStock.map((n) => <div key={n} className="row between"><span>{n}</span><span className="badge red">0</span></div>)}
          </div>
        </div>
      </>}

      {tab === 'products' && <>
        <form className="card" onSubmit={submitProduct}>
          <h3>{editingProduct ? `Edit product: ${editingProduct.name}` : 'Add product'}</h3>
          <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(130px,1fr))' }}>
            <div>
              <label htmlFor="an">Name</label>
              <input id="an" required minLength="2" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div>
              <label htmlFor="ac">Category</label>
              <select id="ac" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
                {cats.map((c) => <option key={c.slug} value={c.slug}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="ab">Brand</label>
              <input id="ab" required value={form.brand} onChange={(e) => setForm({ ...form, brand: e.target.value })} />
            </div>
            <div>
              <label htmlFor="am">MRP ₹</label>
              <input id="am" type="number" min="0" required value={form.mrp} onChange={(e) => setForm({ ...form, mrp: e.target.value })} />
            </div>
            <div>
              <label htmlFor="ad">Discount %</label>
              <input id="ad" type="number" min="0" max="90" value={form.discountPercent} onChange={(e) => setForm({ ...form, discountPercent: e.target.value })} />
            </div>
            <div>
              <label htmlFor="as">Stock</label>
              <input id="as" type="number" min="0" value={form.stock} onChange={(e) => setForm({ ...form, stock: e.target.value })} />
            </div>
            <div>
              <label htmlFor="au">Unit</label>
              <select id="au" value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })}>
                <option>g</option><option>ml</option><option>pc</option>
              </select>
            </div>
            <div>
              <label htmlFor="ap">Pack size</label>
              <input id="ap" type="number" min="1" required value={form.packSize} onChange={(e) => setForm({ ...form, packSize: e.target.value })} />
            </div>
          </div>
          <div className="row" style={{ marginTop: 10 }}>
            <button className="btn primary" type="submit">{editingProduct ? 'Update product' : 'Add product'}</button>
            {editingProduct && <button className="btn" type="button" onClick={resetProductForm}>Cancel edit</button>}
          </div>
        </form>

        <div className="card scroll">
          <table className="table">
            <thead><tr><th>Product</th><th>Category</th><th>Price</th><th>Stock</th><th>Actions</th></tr></thead>
            <tbody>
              {products.map((p) => (
                <tr key={p.id}>
                  <td>{p.name}</td>
                  <td>{p.category}</td>
                  <td>{inr(p.price)}</td>
                  <td>
                    <input
                      aria-label={`Stock for ${p.name}`}
                      type="number"
                      min="0"
                      style={{ width: 90 }}
                      value={edits[p.id] ?? p.stock}
                      onChange={(e) => setEdits({ ...edits, [p.id]: e.target.value })}
                    />
                    {' '}
                    <button
                      className="btn sm"
                      disabled={edits[p.id] == null}
                      onClick={() => act(
                        () => api(`/admin/products/${p.id}/stock`, { method: 'PATCH', body: { stock: Number(edits[p.id]) } })
                          .then(() => setEdits((current) => {
                            const next = { ...current };
                            delete next[p.id];
                            return next;
                          })),
                        'Stock updated'
                      )}
                    >Save</button>
                  </td>
                  <td>
                    <div className="row" style={{ flexWrap: 'wrap' }}>
                      <button className="btn sm" onClick={() => startEdit(p)}>Edit</button>
                      <button className="btn sm danger" onClick={() => {
                        if (confirm(`Delete ${p.name}?`)) {
                          act(() => api(`/admin/products/${p.id}`, { method: 'DELETE' }), 'Deleted');
                        }
                      }}>Delete</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </>}

      {tab === 'orders' && <div className="card scroll">
        <table className="table">
          <thead><tr><th>Order</th><th>Date</th><th>Items</th><th>Total</th><th>Status</th></tr></thead>
          <tbody>
            {orders.length === 0 && <tr><td colSpan="5" className="muted">No orders yet</td></tr>}
            {orders.map((o) => (
              <tr key={o.id}>
                <td>#{o.id.slice(-6)}<div className="muted small">{o.customer?.name || 'Customer'}<br />{o.customer?.email || ''}</div></td>
                <td>{new Date(o.createdAt).toLocaleString()}</td>
                <td className="small">
                  {o.items.map((i) => `${i.qty}× ${i.name}`).join(', ')}
                  <div className="muted small">{o.address?.line1}, {o.address?.city} - {o.address?.pincode}</div>
                </td>
                <td>
                  {inr(o.total)}
                  <div className="muted small">{o.payment?.method?.toUpperCase()} · {o.payment?.status || 'unknown'}</div>
                  {o.payment?.gatewayPaymentId && <div className="muted small">Payment ID: {o.payment.gatewayPaymentId}</div>}
                </td>
                <td>
                  <select
                    aria-label="Order status"
                    value={o.status}
                    disabled={o.status === 'cancelled'}
                    onChange={(e) => act(
                      () => api(`/admin/orders/${o.id}`, { method: 'PATCH', body: { status: e.target.value } }),
                      'Order updated'
                    )}
                  >
                    {['placed', 'packed', 'delivered', 'cancelled'].map((s) => <option key={s}>{s}</option>)}
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>}
    </div>
  );
}

import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, inr } from '../api.js';
import { useApp } from '../context.jsx';
import { ProductCard, Spinner, Empty } from '../components.jsx';

export function Orders() {
  const { toast } = useApp(); const [orders, setOrders] = useState(null);
  const load = () => api('/orders').then((r) => setOrders(r.orders));
  useEffect(() => { load(); }, []);
  const cancel = async (id) => { try { await api(`/orders/${id}/cancel`, { method: 'POST' }); toast('Order cancelled'); load(); } catch (e) { toast(e.message, 'err'); } };
  if (!orders) return <Spinner />; if (!orders.length) return <Empty icon="📦" title="No orders yet"><Link to="/shop">Start shopping</Link></Empty>;
  return <div className="stack" style={{ marginTop: 16 }}><h1>Your orders</h1>{orders.map((o) => (
    <div key={o.id} className="card stack"><div className="row between"><b>#{o.id.slice(-6)} · {new Date(o.createdAt).toLocaleDateString()}</b><span className={`badge ${o.status === 'delivered' ? 'green' : o.status === 'cancelled' ? 'red' : 'amber'}`}>{o.status}</span></div>
      <div className="small muted">{o.items.map((i) => `${i.qty}× ${i.name}`).join(', ')}</div><div className="row between"><span>{inr(o.total)} · {o.payment.status}</span>{o.status === 'placed' && <button className="btn sm danger" onClick={() => cancel(o.id)}>Cancel order</button>}</div></div>))}</div>;
}

export function Wishlist() {
  const { wish } = useApp(); const [items, setItems] = useState(null);
  useEffect(() => { api('/wishlist').then((r) => setItems(r.products)); }, [wish]);
  if (!items) return <Spinner />; if (!items.length) return <Empty icon="🤍" title="Your wishlist is empty"><Link to="/shop">Find something you like</Link></Empty>;
  return <div style={{ marginTop: 16 }}><h1>Wishlist</h1><div className="grid">{items.map((p) => <ProductCard key={p.id} p={p} />)}</div></div>;
}

export function Profile() {
  const { user, toast } = useApp(); const [me, setMe] = useState(null);
  useEffect(() => { api('/auth/me').then((r) => setMe({ name: r.user.name, addresses: r.user.addresses, p: { dietary: [], avoidAllergens: [], favouriteBrands: [], monthlyBudget: '', personalisationConsent: false, ...(r.preferences || {}) } })); }, []);
  if (!me) return <Spinner />;
  const csv = (k) => me.p[k].join(', '); const setP = (patch) => setMe({ ...me, p: { ...me.p, ...patch } }); const list = (v) => v.split(',').map((x) => x.trim()).filter(Boolean);
  const save = async (e) => { e.preventDefault(); try { await api('/me', { method: 'PUT', body: { name: me.name, addresses: me.addresses.map(({ id, label, line1, city, pincode }) => ({ id, label, line1, city, pincode })), preferences: { ...me.p, monthlyBudget: me.p.monthlyBudget === '' ? null : +me.p.monthlyBudget } } }); toast('Profile saved'); } catch (er) { toast(er.message, 'err'); } };
  return (
    <form className="stack" style={{ marginTop: 16, maxWidth: 680 }} onSubmit={save}>
      <h1>Profile & preferences</h1>
      <div className="card stack"><div><label htmlFor="pn">Name</label><input id="pn" value={me.name} onChange={(e) => setMe({ ...me, name: e.target.value })} /></div><div className="muted small">{user.email}</div></div>
      <div className="card stack"><h3>Shopping preferences</h3>
        <div><label htmlFor="pd">Dietary (e.g. vegetarian, vegan)</label><input id="pd" value={csv('dietary')} onChange={(e) => setP({ dietary: list(e.target.value) })} /></div>
        <div><label htmlFor="pa">Avoid allergens (peanut, milk, gluten…)</label><input id="pa" value={csv('avoidAllergens')} onChange={(e) => setP({ avoidAllergens: list(e.target.value) })} /></div>
        <div><label htmlFor="pb">Favourite brands</label><input id="pb" value={csv('favouriteBrands')} onChange={(e) => setP({ favouriteBrands: list(e.target.value) })} /></div>
        <div><label htmlFor="pm">Monthly grocery budget (₹)</label><input id="pm" type="number" min="0" value={me.p.monthlyBudget ?? ''} onChange={(e) => setP({ monthlyBudget: e.target.value })} /></div>
        <label className="check"><input type="checkbox" checked={me.p.personalisationConsent} onChange={(e) => setP({ personalisationConsent: e.target.checked })} />Use my past orders to personalise recommendations (you can turn this off any time)</label></div>
      <div className="card stack"><h3>Addresses</h3>{me.addresses.length === 0 && <span className="muted">No saved addresses. Add one at checkout.</span>}{me.addresses.map((a) => <div key={a.id} className="row between"><span>{a.label}: {a.line1}, {a.city} {a.pincode}</span><button type="button" className="btn sm danger" onClick={() => setMe({ ...me, addresses: me.addresses.filter((x) => x.id !== a.id) })}>Remove</button></div>)}</div>
      <div className="row"><button className="btn primary">Save changes</button><Link className="btn" to="/orders">My orders</Link><Link className="btn" to="/wishlist">Wishlist</Link></div>
    </form>
  );
}

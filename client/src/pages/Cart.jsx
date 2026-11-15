import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api, inr } from '../api.js';
import { useApp } from '../context.jsx';
import { Img, Empty } from '../components.jsx';

export function Cart() {
  const { cart, changeCart, user } = useApp();
  if (!cart.items.length) return <Empty icon="🛒" title="Your cart is empty"><Link className="btn primary" to="/shop">Start shopping</Link></Empty>;
  return (
    <div className="layout" style={{ gridTemplateColumns: '1fr 320px', marginTop: 16 }}>
      <section className="card stack">
        <h2>Your cart ({cart.count} items)</h2>
        {cart.items.map(({ product: p, qty, lineTotal }) => (
          <div key={p.id} className="row between" style={{ borderTop: '1px solid var(--line)', paddingTop: 10 }}>
            <div className="row grow"><Img src={p.imageUrl} alt="" style={{ width: 64, height: 64, borderRadius: 12, objectFit: 'cover' }} /><div><Link to={`/product/${p.slug}`} className="name"><b>{p.name}</b></Link><div className="muted small">{inr(p.price)} each</div></div></div>
            <div className="row"><button className="btn sm" aria-label={`Decrease ${p.name}`} onClick={() => changeCart([{ productId: p.id, qty: qty - 1 }])}>−</button><b aria-live="polite">{qty}</b><button className="btn sm" aria-label={`Increase ${p.name}`} onClick={() => changeCart([{ productId: p.id, qty: qty + 1 }])}>+</button>
              <b style={{ minWidth: 70, textAlign: 'right' }}>{inr(lineTotal)}</b><button className="btn sm danger" aria-label={`Remove ${p.name}`} onClick={() => changeCart([{ productId: p.id, qty: 0 }])}>Remove</button></div>
          </div>))}
      </section>
      <aside className="card stack" style={{ position: 'sticky', top: 80 }}>
        <h3>Summary</h3><div className="row between"><span>Subtotal</span><b>{inr(cart.total)}</b></div><div className="row between muted small"><span>Delivery</span><span>Free (demo)</span></div>
        <Link className="btn primary" to={user ? '/checkout' : '/login'} state={{ from: '/checkout' }}>{user ? 'Checkout' : 'Sign in to checkout'}</Link>
        <Link className="btn" to="/optimizer">⚖️ Optimize this basket</Link>
      </aside>
    </div>
  );
}

async function loadRazorpay() {
  if (window.Razorpay) return true;
  return new Promise((resolve) => {
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.onload = () => resolve(true); script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

export function Checkout() {
  const { cart, user, refreshCart, toast } = useApp(); const nav = useNavigate();
  const [addrId, setAddrId] = useState(user.addresses?.[0]?.id || 'new');
  const [a, setA] = useState({ label: 'Home', line1: '', city: '', pincode: '' });
  const [pay, setPay] = useState('razorpay'); const [busy, setBusy] = useState(false); const [problems, setProblems] = useState([]); const [done, setDone] = useState(null); const [gatewayEnabled, setGatewayEnabled] = useState(false);
  useEffect(() => { refreshCart(); api('/payments/razorpay/status').then((r) => setGatewayEnabled(r.enabled)).catch(() => setGatewayEnabled(false)); }, []); // eslint-disable-line
  const getAddress = () => addrId === 'new' ? a : user.addresses?.find((x) => x.id === addrId);
  const addressBody = () => ({ ...(addrId === 'new' ? { address: a, saveAddress: true } : { addressId: addrId }) });
  const place = async (e) => {
    e.preventDefault(); setBusy(true); setProblems([]);
    try {
      if (pay === 'cod') {
        const r = await api('/orders', { method: 'POST', body: { payment: 'cod', ...addressBody() } });
        setDone(r); await refreshCart(); return;
      }
      const loaded = await loadRazorpay();
      if (!loaded) throw new Error('Could not load secure Razorpay checkout. Check your internet connection.');
      const created = await api('/payments/razorpay/order', { method: 'POST', body: addressBody() });
      const checkout = new window.Razorpay({
        key: created.keyId, amount: created.amount, currency: created.currency,
        name: 'GrocerAI', description: 'Grocery order payment', order_id: created.gatewayOrderId,
        prefill: { name: created.customer.name, email: created.customer.email },
        notes: { store: 'GrocerAI' },
        method: { upi: true, card: true, netbanking: true, wallet: true },
        theme: { color: '#237a57' },
        handler: async (response) => {
          try {
            const verified = await api('/payments/razorpay/verify', { method: 'POST', body: { ...response, address: created.address, saveAddress: created.saveAddress } });
            setDone(verified); await refreshCart();
          } catch (err) {
            toast(`Payment was made but order verification needs attention. Payment ID: ${response.razorpay_payment_id}. ${err.message}`, 'err');
          } finally { setBusy(false); }
        },
        modal: { ondismiss: () => setBusy(false) }
      });
      checkout.on('payment.failed', (response) => { toast(response.error?.description || 'Payment failed. You can try again.', 'err'); setBusy(false); });
      checkout.open();
    } catch (err) { toast(err.message, 'err'); setProblems(err.data?.problems || []); setBusy(false); }
  };
  if (done) return <Empty icon="🎉" title="Order placed!"><p>Order <b>#{done.order.id.slice(-6)}</b> · {inr(done.order.total)}</p><p className="banner small">{done.paymentNote}</p><Link className="btn primary" to="/orders">View orders</Link></Empty>;
  if (!cart.items.length) return <Empty title="Nothing to check out"><Link to="/shop">Go shopping</Link></Empty>;
  return (
    <form onSubmit={place} className="layout" style={{ gridTemplateColumns: '1fr 340px', marginTop: 16 }}>
      <div className="stack">
        <section className="card stack"><h2>Delivery address</h2>
          {user.addresses?.map((x) => <label key={x.id} className="check"><input type="radio" name="addr" checked={addrId === x.id} onChange={() => setAddrId(x.id)} />{x.label}: {x.line1}, {x.city} {x.pincode}</label>)}
          <label className="check"><input type="radio" name="addr" checked={addrId === 'new'} onChange={() => setAddrId('new')} />Use a new address</label>
          {addrId === 'new' && <div className="two"><div><label htmlFor="l">Label</label><input id="l" required value={a.label} onChange={(e) => setA({ ...a, label: e.target.value })} /></div><div><label htmlFor="c">City</label><input id="c" required value={a.city} onChange={(e) => setA({ ...a, city: e.target.value })} /></div><div><label htmlFor="ad">Address</label><input id="ad" required minLength={3} value={a.line1} onChange={(e) => setA({ ...a, line1: e.target.value })} /></div><div><label htmlFor="pin">Pincode</label><input id="pin" required pattern="\d{6}" title="6 digits" value={a.pincode} onChange={(e) => setA({ ...a, pincode: e.target.value })} /></div></div>}
        </section>
        <section className="card stack"><h2>Payment method</h2>
          {gatewayEnabled ? <>
            <label className="check"><input type="radio" name="payment" checked={pay === 'razorpay'} onChange={() => setPay('razorpay')} /><span><b>Pay online – UPI / QR / Debit Card / Credit Card</b><br/><span className="muted small">Secure payment powered by Razorpay. Available methods appear in the payment window.</span></span></label>
            <div className="row" style={{ flexWrap: 'wrap', gap: 8 }}><span className="badge">UPI & QR</span><span className="badge">Debit Card</span><span className="badge">Credit Card</span><span className="badge">Net Banking</span><span className="badge">Wallets</span></div>
          </> : <div className="banner">Online payments are not configured yet. Add Razorpay test/live API keys in <code>server/.env</code> to enable online payments.</div>}
          <label className="check"><input type="radio" name="payment" checked={pay === 'cod'} onChange={() => setPay('cod')} />Cash on delivery</label>
          <p className="muted small">Card details are entered only in Razorpay Checkout, never stored by GrocerAI.</p>
        </section>
        {problems.length > 0 && <div className="card" role="alert"><b>Stock changed:</b>{problems.map((p) => <div key={p.productId}>{p.name}: you asked for {p.requested}, only {p.available} available. <Link to="/cart">Update cart</Link></div>)}</div>}
      </div>
      <aside className="card stack" style={{ alignSelf: 'start' }}><h3>Order summary</h3>{cart.items.map((i) => <div key={i.product.id} className="row between small"><span>{i.qty} × {i.product.name}</span><span>{inr(i.lineTotal)}</span></div>)}<div className="row between"><b>Total</b><b>{inr(cart.total)}</b></div><button className="btn primary" disabled={busy || (pay === 'razorpay' && !gatewayEnabled)}>{busy ? 'Opening secure checkout…' : pay === 'cod' ? 'Place COD order' : 'Continue to payment'}</button><p className="muted small">Stock is re-checked when payment is verified.</p></aside>
    </form>
  );
}

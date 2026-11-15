import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api, getToken, setToken, guestId } from './api.js';

const Ctx = createContext(null);
export const useApp = () => useContext(Ctx);

export function AppProvider({ children }) {
  const [user, setUser] = useState(null);
  const [ready, setReady] = useState(false);
  const [cart, setCart] = useState({ items: [], total: 0, count: 0 });
  const [wish, setWish] = useState(new Set());
  const [toasts, setToasts] = useState([]);
  const [theme, setTheme] = useState(() => localStorage.getItem('grocerai.theme') || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'));

  useEffect(() => { document.documentElement.dataset.theme = theme; localStorage.setItem('grocerai.theme', theme); }, [theme]);
  const toast = useCallback((msg, kind = 'ok') => { const id = Math.random(); setToasts((t) => [...t, { id, msg, kind }]); setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3500); }, []);

  const refreshCart = useCallback(async () => { try { setCart(await api('/cart')); } catch { /* offline */ } }, []);
  const refreshWish = useCallback(async () => { if (!getToken()) return setWish(new Set()); try { setWish(new Set((await api('/wishlist')).products.map((p) => p.id))); } catch { /* ignore */ } }, []);

  useEffect(() => { (async () => {
    if (getToken()) { try { setUser((await api('/auth/me')).user); } catch { setToken(null); } }
    await Promise.all([refreshCart(), refreshWish()]); setReady(true);
  })(); }, [refreshCart, refreshWish]);

  const authenticate = async (path, body) => {
    const { token, user: u } = await api(path, { method: 'POST', body }); setToken(token); setUser(u);
    try { await api('/cart/merge', { method: 'POST', body: { guestId: guestId() } }); } catch { /* nothing to merge */ }
    await Promise.all([refreshCart(), refreshWish()]); return u;
  };
  const logout = () => { setToken(null); setUser(null); setWish(new Set()); refreshCart(); toast('Signed out'); };

  const changeCart = async (changes) => {
    try { const r = await api('/cart/changes', { method: 'POST', body: { changes } }); setCart(r); r.warnings?.forEach((w) => toast(w, 'err')); return r; }
    catch (e) { toast(e.message, 'err'); throw e; }
  };
  const addToCart = async (p, qty = 1) => { await changeCart([{ productId: p.id, qty, mode: 'add' }]); toast(`Added ${p.name}`); };
  const toggleWish = async (p) => {
    if (!user) return toast('Sign in to use your wishlist', 'err');
    const has = wish.has(p.id); await api(`/wishlist/${p.id}`, { method: has ? 'DELETE' : 'PUT' });
    setWish((w) => { const n = new Set(w); has ? n.delete(p.id) : n.add(p.id); return n; }); toast(has ? 'Removed from wishlist' : 'Saved to wishlist');
  };

  const value = useMemo(() => ({ user, ready, cart, wish, theme, setTheme, toast, authenticate, logout, changeCart, addToCart, refreshCart, toggleWish }), [user, ready, cart, wish, theme]); // eslint-disable-line
  return (
    <Ctx.Provider value={value}>
      {children}
      <div className="toasts" role="status" aria-live="polite">{toasts.map((t) => <div key={t.id} className={`toast ${t.kind === 'err' ? 'err' : ''}`}>{t.msg}</div>)}</div>
    </Ctx.Provider>
  );
}

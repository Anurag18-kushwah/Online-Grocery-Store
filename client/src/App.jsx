import { useState } from 'react';
import { Link, NavLink, Route, Routes, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { useApp } from './context.jsx';
import { Spinner, Empty } from './components.jsx';
import Home from './pages/Home.jsx';
import Shop from './pages/Shop.jsx';
import Product from './pages/Product.jsx';
import { Cart, Checkout } from './pages/Cart.jsx';
import Optimizer from './pages/Optimizer.jsx';
import Recipes from './pages/Recipes.jsx';
import Copilot from './pages/Copilot.jsx';
import Auth from './pages/Auth.jsx';
import { Orders, Wishlist, Profile } from './pages/Account.jsx';
import Admin from './pages/Admin.jsx';

function Guard({ children, admin }) {
  const { user, ready } = useApp(); const loc = useLocation();
  if (!ready) return <Spinner />;
  if (!user) return <Navigate to={admin ? '/admin/login' : '/login'} state={{ from: loc.pathname }} replace />;
  if (admin && user.role !== 'admin') return <Empty icon="🔒" title="Admins only">Your account does not have access to this page.</Empty>;
  return children;
}

export default function App() {
  const { user, cart, logout, theme, setTheme } = useApp(); const nav = useNavigate(); const [open, setOpen] = useState(false); const [q, setQ] = useState('');
  const go = (e) => { e.preventDefault(); if (q.trim()) nav(`/shop?q=${encodeURIComponent(q.trim())}`); };
  const link = ({ isActive }) => (isActive ? 'active' : '');
  return (
    <>
      <a href="#main" className="skip">Skip to content</a>
      <header className="nav"><div className="container">
        <Link to="/" className="logo" aria-label="GrocerAI home"><span aria-hidden>🥬</span><span>Grocer<b>AI</b><small>Smarter Choices. Fresher Living.</small></span></Link>
        <nav className={`links ${open ? 'open' : ''}`} aria-label="Main" onClick={() => setOpen(false)}>
          {user?.role === 'admin' && <NavLink to="/admin" className={link}>Admin Dashboard</NavLink>}<NavLink to="/shop" className={link}>Shop</NavLink><NavLink to="/optimizer" className={link}>Basket Optimizer</NavLink><NavLink to="/recipes" className={link}>Recipes</NavLink><NavLink to="/copilot" className={link}>AI Copilot</NavLink>
        </nav>
        <form className="search" onSubmit={go} role="search"><label className="sr" htmlFor="gs">Search products</label><input id="gs" placeholder="Search groceries…" value={q} onChange={(e) => setQ(e.target.value)} style={{ width: 200 }} /></form>
        <button className="btn icon" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} aria-label="Toggle dark mode">{theme === 'dark' ? '☀️' : '🌙'}</button>
        <Link className="btn" to="/cart" aria-label={`Cart, ${cart.count} items`}>🛒 {cart.count}</Link>
        {user ? <Link className="btn" to="/profile">{user.name.split(' ')[0]}</Link> : <Link className="btn primary" to="/login">Sign in</Link>}
        {user && <button className="btn sm" onClick={() => { logout(); nav('/'); }}>Sign out</button>}
        <button className="btn icon menu-btn" onClick={() => setOpen(!open)} aria-label="Menu" aria-expanded={open}>☰</button>
      </div></header>
      <main id="main" className="container" style={{ paddingTop: 8 }}>
        <Routes>
          <Route path="/" element={<Home />} /><Route path="/shop" element={<Shop />} /><Route path="/product/:slug" element={<Product />} />
          <Route path="/cart" element={<Cart />} /><Route path="/checkout" element={<Guard><Checkout /></Guard>} />
          <Route path="/optimizer" element={<Optimizer />} /><Route path="/recipes" element={<Recipes />} /><Route path="/copilot" element={<Copilot />} />
          <Route path="/login" element={<Auth />} /><Route path="/admin/login" element={<Auth adminOnly />} /><Route path="/orders" element={<Guard><Orders /></Guard>} /><Route path="/wishlist" element={<Guard><Wishlist /></Guard>} /><Route path="/profile" element={<Guard><Profile /></Guard>} />
          <Route path="/admin" element={<Guard admin><Admin /></Guard>} />
          <Route path="*" element={<Empty icon="🧭" title="Page not found"><Link to="/">Back to home</Link></Empty>} />
        </Routes>
      </main>
      <footer>
        <div className="container stack" style={{ textAlign: 'center' }}>
          <div className="made-by">Made with <span aria-label="love" role="img">❤️</span> by <b>Anurag</b></div>
          <div className="small">© GrocerAI — Smarter Choices. Fresher Living.</div>
        </div>
      </footer>
    </>
  );
}

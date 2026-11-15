import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useApp } from '../context.jsx';

export default function Auth({ adminOnly = false }) {
  const { authenticate, toast } = useApp(); const nav = useNavigate(); const loc = useLocation();
  const [mode, setMode] = useState('login'); const [f, setF] = useState({ name: '', email: '', password: '' }); const [busy, setBusy] = useState(false); const [err, setErr] = useState('');
  const submit = async (e) => {
    e.preventDefault(); setBusy(true); setErr('');
    try { const u = await authenticate(adminOnly ? '/auth/admin/login' : (mode === 'login' ? '/auth/login' : '/auth/register'), mode === 'login' ? { email: f.email, password: f.password } : f); if (adminOnly && u.role !== 'admin') throw new Error('This account is not an administrator'); toast(`Welcome, ${u.name.split(' ')[0]}!`); nav(adminOnly ? '/admin' : (loc.state?.from || '/'), { replace: true }); }
    catch (e2) { setErr(e2.data?.details ? e2.data.details.map((d) => d.message).join(', ') : e2.message); } finally { setBusy(false); }
  };
  const fill = (email, password) => setF({ ...f, email, password });
  return (
    <div style={{ maxWidth: 420, margin: '40px auto' }} className="stack">
      <form className="card stack" onSubmit={submit}>
        <h1 style={{ fontSize: '1.7rem' }}>{adminOnly ? 'Admin sign in' : (mode === 'login' ? 'Welcome back' : 'Create your account')}</h1>
        {adminOnly && <p className="muted small">Restricted store administration portal.</p>}
        {mode === 'register' && <div><label htmlFor="n">Name</label><input id="n" required minLength={2} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} autoComplete="name" /></div>}
        <div><label htmlFor="e">Email</label><input id="e" type="email" required value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} autoComplete="email" /></div>
        <div><label htmlFor="p">Password {mode === 'register' && <span className="muted">(min 8 characters)</span>}</label><input id="p" type="password" required minLength={mode === 'register' ? 8 : 1} value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} /></div>
        {err && <div className="banner" role="alert">{err}</div>}
        <button className="btn primary" disabled={busy}>{busy ? 'Please wait…' : mode === 'login' ? 'Sign in' : 'Sign up'}</button>
        {!adminOnly && <button type="button" className="btn" onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setErr(''); }}>{mode === 'login' ? 'New here? Create an account' : 'Have an account? Sign in'}</button>}
      </form>
      {!adminOnly && <div className="card small"><b>Shopper demo</b><div className="row" style={{ marginTop: 6 }}><button className="btn sm" onClick={() => { setMode('login'); fill('demo@grocerai.dev', 'Demo@1234'); }}>Use shopper demo</button></div></div>}
    </div>
  );
}

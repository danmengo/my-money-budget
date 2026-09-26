'use client';

import { useEffect, useState, type FormEvent } from 'react';
import type { Session } from '@supabase/supabase-js';
import { ArrowRight, Check, LockKeyhole, TrendingUp } from 'lucide-react';
import { getSupabase } from './supabase-client';
import DashboardClient from './dashboard-client';

function GoogleIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true" className="google-icon">
    <path fill="#4285F4" d="M21.6 12.23c0-.71-.06-1.4-.18-2.07H12v3.91h5.38a4.6 4.6 0 0 1-2 3.02v2.54h3.24c1.9-1.75 2.98-4.33 2.98-7.4Z"/>
    <path fill="#34A853" d="M12 22c2.7 0 4.98-.9 6.63-2.43l-3.24-2.53c-.9.6-2.05.96-3.39.96-2.61 0-4.82-1.76-5.61-4.13H3.05v2.61A10 10 0 0 0 12 22Z"/>
    <path fill="#FBBC05" d="M6.39 13.87A6 6 0 0 1 6.08 12c0-.65.11-1.28.31-1.87V7.52H3.05A10 10 0 0 0 2 12c0 1.61.39 3.14 1.05 4.48l3.34-2.61Z"/>
    <path fill="#EA4335" d="M12 6c1.47 0 2.79.51 3.83 1.5l2.87-2.87A9.63 9.63 0 0 0 12 2a10 10 0 0 0-8.95 5.52l3.34 2.61C7.18 7.76 9.39 6 12 6Z"/>
  </svg>;
}

export default function SupabaseShell() {
  const supabase = getSupabase();
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [sent, setSent] = useState(false);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [googleBusy, setGoogleBusy] = useState(false);

  useEffect(() => {
    let active = true;
    void supabase.auth.getSession().then(({ data }) => {
      if (active) { setSession(data.session); setLoading(false); }
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, next) => {
      if (active) { setSession(next); setLoading(false); }
    });
    return () => { active = false; subscription.unsubscribe(); };
  }, []);

  async function sendCode(event: FormEvent) {
    event.preventDefault(); setBusy(true); setMessage('');
    const { error } = await supabase.auth.signInWithOtp({ email: email.trim(), options: { shouldCreateUser: true } });
    setBusy(false);
    if (error) setMessage(error.message);
    else { setSent(true); setMessage('We sent a sign-in code to your email.'); }
  }

  async function verifyCode(event: FormEvent) {
    event.preventDefault(); setBusy(true); setMessage('');
    const { error } = await supabase.auth.verifyOtp({ email: email.trim(), token: code.trim(), type: 'email' });
    setBusy(false);
    if (error) setMessage(error.message);
  }

  async function signInGoogle() {
    setMessage(''); setGoogleBusy(true);
    const { error } = await supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: `${window.location.origin}/` } });
    if (error) { setMessage(error.message); setGoogleBusy(false); }
  }

  if (loading) return <main className="app-loading-page"><div className="app-loading-card"><div className="app-loading-brand"><span className="auth-logo-icon"><TrendingUp size={20}/></span><span>my<span>money</span></span></div><div className="app-loading-copy"><strong>Loading your money</strong><span>Getting your budget ready…</span></div><div className="app-loading-bar"><i/></div></div></main>;
  if (session) return <DashboardClient displayName={session.user.user_metadata?.full_name || session.user.email || 'My budget'} accessToken={session.access_token} onSignOut={() => { void supabase.auth.signOut(); }} />;

  return <main className="auth-page">
    <section className="auth-showcase">
      <a className="auth-brand" href="/" aria-label="My Money home"><span className="auth-logo-icon"><TrendingUp size={20}/></span><span>my<span>money</span></span></a>
      <div className="auth-pitch">
        <span className="auth-kicker">PERSONAL FINANCE, SIMPLIFIED</span>
        <h1>Know exactly where your money goes.</h1>
        <p>One calm place for your spending, monthly budget, savings, and investing goals.</p>
        <div className="auth-benefits">
          <span><i><Check size={14}/></i>Track every dollar in and out</span>
          <span><i><Check size={14}/></i>Build a budget that fits your life</span>
          <span><i><Check size={14}/></i>Keep your financial data private</span>
        </div>
      </div>
      <div className="auth-trust"><LockKeyhole size={15}/> Your budget is private to your account.</div>
    </section>

    <section className="auth-form-side">
      <div className="auth-mobile-brand"><span className="auth-logo-icon"><TrendingUp size={18}/></span><strong>my<span>money</span></strong></div>
      <div className="auth-card">
        <div className="auth-card-head"><span>WELCOME</span><h2>{sent ? 'Check your email' : 'Welcome to My Money'}</h2><p>{sent ? <>Enter the 6-digit code sent to <strong>{email}</strong>.</> : 'Sign in or create an account to continue.'}</p></div>
        {!sent && <>
          <button className="google-button" type="button" onClick={() => void signInGoogle()} disabled={googleBusy}><GoogleIcon/><span>{googleBusy ? 'Connecting…' : 'Continue with Google'}</span></button>
          <div className="auth-divider"><span>or continue with email</span></div>
        </>}
        <form onSubmit={sent ? verifyCode : sendCode} className="auth-form">
          {!sent && <label><span>Email address</span><input required type="email" autoComplete="email" placeholder="you@example.com" value={email} onChange={event => setEmail(event.target.value)} /></label>}
          {sent && <label><span>Sign-in code</span><input className="code-input" required inputMode="numeric" autoComplete="one-time-code" placeholder="000000" maxLength={8} autoFocus value={code} onChange={event => setCode(event.target.value.replace(/\D/g,''))} /></label>}
          <button className="email-button" type="submit" disabled={busy}><span>{busy ? 'Please wait…' : sent ? 'Verify & sign in' : 'Continue with email'}</span>{!busy && <ArrowRight size={17}/>}</button>
        </form>
        {sent && <button className="auth-link-button" type="button" onClick={() => { setSent(false); setCode(''); setMessage(''); }}>Use a different email</button>}
        {message && <p className="auth-message" role="status">{message}</p>}
        {!sent && <p className="auth-terms">By continuing, you acknowledge the <a href="/privacy">Privacy Policy</a>.</p>}
      </div>
    </section>
  </main>;
}

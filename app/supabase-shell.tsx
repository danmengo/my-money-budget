'use client';

import { useEffect, useState, type FormEvent } from 'react';
import type { Session } from '@supabase/supabase-js';
import { getSupabase } from './supabase-client';
import DashboardClient from './dashboard-client';

export default function SupabaseShell() {
  const supabase = getSupabase();
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [sent, setSent] = useState(false);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

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
    else { setSent(true); setMessage('Check your email for the sign-in code.'); }
  }

  async function verifyCode(event: FormEvent) {
    event.preventDefault(); setBusy(true); setMessage('');
    const { error } = await supabase.auth.verifyOtp({ email: email.trim(), token: code.trim(), type: 'email' });
    setBusy(false);
    if (error) setMessage(error.message);
  }

  async function signInGoogle() {
    setMessage('');
    const { error } = await supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: window.location.origin } });
    if (error) setMessage(error.message);
  }

  if (loading) return <main className="sign-in-page"><div className="sign-in-card">Loading…</div></main>;
  if (session) return <DashboardClient displayName={session.user.user_metadata?.full_name || session.user.email || 'My budget'} accessToken={session.access_token} onSignOut={() => { void supabase.auth.signOut(); }} />;

  return <main className="sign-in-page"><div className="sign-in-card">
    <div className="sign-in-mark">↗</div><h1>Your money, in one place.</h1>
    <p>Sign in to see your private budget, spending, savings, and investing goals.</p>
    <button type="button" onClick={() => { void signInGoogle(); }}>Continue with Google</button>
    <p>Or sign in with email</p>
    <form onSubmit={sent ? verifyCode : sendCode} className="form">
      <label>Email<input required type="email" autoComplete="email" value={email} onChange={event => setEmail(event.target.value)} disabled={sent} /></label>
      {sent && <label>Code<input required inputMode="numeric" autoComplete="one-time-code" value={code} onChange={event => setCode(event.target.value)} /></label>}
      <button type="submit" disabled={busy}>{busy ? 'Please wait…' : sent ? 'Verify code' : 'Send sign-in code'}</button>
    </form>
    {sent && <button type="button" onClick={() => { setSent(false); setCode(''); setMessage(''); }}>Use another email</button>}
    {message && <p role="status">{message}</p>}
  </div></main>;
}

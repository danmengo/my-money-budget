'use client';

import { useState } from 'react';
import { ArrowLeft,ShieldAlert,TrendingUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { getSupabase } from '../supabase-client';

export default function AccountPage(){
  const [confirmation,setConfirmation]=useState('');
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');

  async function closeAccount(event:React.FormEvent){
    event.preventDefault();
    if(confirmation!=='DELETE'){setError('Type DELETE to confirm.');return}
    setBusy(true);setError('');
    try{
      const {data:{session}}=await getSupabase().auth.getSession();
      if(!session) throw Error('Sign in to continue.');
      const response=await fetch('/api/account/delete',{
        method:'POST',
        headers:{'Content-Type':'application/json',Authorization:`Bearer ${session.access_token}`},
        body:JSON.stringify({confirmation})
      });
      const result=await response.json() as {ok?:boolean;error?:string};
      if(!response.ok) throw Error(result.error||'Could not complete the request.');
      await getSupabase().auth.signOut();
      window.location.href='/';
    }catch(e){
      setError(e instanceof Error?e.message:'Could not complete the request.');
    }finally{
      setBusy(false);
    }
  }

  return <main className="privacy-page">
    <div className="privacy-shell">
      <a className="privacy-brand" href="/"><span className="auth-logo-icon"><TrendingUp size={20}/></span><span>my<span>money</span></span></a>
      <article className="privacy-card account-controls-page">
        <a className="admin-back" href="/"><ArrowLeft size={16}/> Back to My Money</a>
        <div className="account-danger-icon"><ShieldAlert size={24}/></div>
        <h1>Account controls</h1>
        <p className="privacy-updated">Close your My Money account and remove stored app data.</p>

        <div className="delete-account-warning">
          <p>This action removes your budgeting data and sign-in account.</p>
          <p>It cannot be undone.</p>
        </div>

        <form className="form" onSubmit={closeAccount}>
          <label>Type <strong>DELETE</strong> to confirm
            <Input value={confirmation} onChange={e=>setConfirmation(e.target.value)} autoComplete="off" placeholder="DELETE"/>
          </label>
          {error&&<div className="error"><span>{error}</span></div>}
          <div className="delete-account-actions">
            <Button type="button" variant="outline" onClick={()=>{window.location.href='/'}}>Cancel</Button>
            <Button type="submit" className="danger-confirm" disabled={busy||confirmation!=='DELETE'}>{busy?'Closing…':'Close my account'}</Button>
          </div>
        </form>
      </article>
    </div>
  </main>;
}

'use client';

import { useEffect,useState } from 'react';
import { ArrowLeft,MessageSquare,RefreshCcw,TrendingUp } from 'lucide-react';
import { getSupabase } from '../../supabase-client';

type Feedback={id:number;owner_id:string;email:string|null;message:string;created_at:string};

export default function FeedbackAdminPage(){
  const [items,setItems]=useState<Feedback[]>([]);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState('');

  async function load(){
    setLoading(true);setError('');
    try{
      const {data:{session}}=await getSupabase().auth.getSession();
      if(!session) throw Error('Sign in to view feedback.');
      const r=await fetch('/api/admin/feedback',{headers:{Authorization:`Bearer ${session.access_token}`}});
      const x=await r.json() as {feedback?:Feedback[];error?:string};
      if(!r.ok) throw Error(x.error||'Could not load feedback.');
      setItems(x.feedback||[]);
    }catch(e){setError(e instanceof Error?e.message:'Could not load feedback.')}
    finally{setLoading(false)}
  }

  useEffect(()=>{void load()},[]);

  return <main className="admin-feedback-page">
    <div className="admin-feedback-shell">
      <header className="admin-feedback-header">
        <a className="privacy-brand" href="/"><span className="auth-logo-icon"><TrendingUp size={20}/></span><span>my<span>money</span></span></a>
        <a className="admin-back" href="/"><ArrowLeft size={16}/> Back to app</a>
      </header>

      <section className="admin-feedback-card">
        <div className="admin-feedback-title">
          <div><p className="eyebrow">ADMIN</p><h1>Feedback inbox</h1><p>Review messages submitted through My Money.</p></div>
          <button onClick={()=>void load()} disabled={loading}><RefreshCcw size={16}/>{loading?'Refreshing…':'Refresh'}</button>
        </div>

        {error&&<div className="error"><span>{error}</span></div>}
        {!error&&loading&&<div className="admin-feedback-empty">Loading feedback…</div>}
        {!error&&!loading&&!items.length&&<div className="admin-feedback-empty"><MessageSquare size={24}/><h2>No feedback yet</h2><p>New submissions will appear here.</p></div>}

        {!error&&!loading&&items.length>0&&<div className="admin-feedback-list">{items.map(item=><article className="admin-feedback-item" key={item.id}><div className="admin-feedback-meta"><div><strong>{item.email||'Unknown email'}</strong><span>{new Date(item.created_at).toLocaleString()}</span></div><span>#{item.id}</span></div><p>{item.message}</p><small>User ID: {item.owner_id}</small></article>)}</div>}
      </section>
    </div>
  </main>
}

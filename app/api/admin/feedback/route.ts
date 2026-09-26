import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

const headers={ 'Cache-Control':'no-store, max-age=0' };
const json=(body:unknown,status=200)=>NextResponse.json(body,{status,headers});

export async function GET(request: NextRequest) {
  const url=process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  const token=request.headers.get('authorization')?.match(/^Bearer (.+)$/i)?.[1];
  if(!url||!key||!token) return json({error:'Sign in required.'},401);

  const client=createClient(url,key,{global:{headers:{Authorization:`Bearer ${token}`}},auth:{persistSession:false,autoRefreshToken:false}});
  const {data:{user},error:authError}=await client.auth.getUser(token);
  if(authError||!user) return json({error:'Your session expired.'},401);

  const {data:admin,error:adminError}=await client.from('admin_users').select('user_id').eq('user_id',user.id).maybeSingle();
  if(adminError){console.error('Admin lookup failed',adminError);return json({error:'Could not verify admin access.'},500);}
  if(!admin) return json({error:'Admin access required.'},403);

  const {data,error}=await client.from('feedback').select('id,owner_id,email,message,created_at').order('created_at',{ascending:false});
  if(error){console.error('Feedback inbox query failed',error);return json({error:'Could not load feedback.'},500);}
  return json({feedback:data||[]});
}

import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

const json=(body:unknown,status=200)=>NextResponse.json(body,{status});

export async function POST(request:NextRequest){
  const url=process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishable=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  const serviceRole=process.env.SUPABASE_SERVICE_ROLE_KEY;
  const token=request.headers.get('authorization')?.match(/^Bearer (.+)$/i)?.[1];

  if(!url||!publishable||!token) return json({error:'Sign in required.'},401);
  if(!serviceRole) return json({error:'Account deletion is not configured yet.'},503);

  let body:{confirmation?:string}={};
  try{body=await request.json()}catch{}
  if(body.confirmation!=='DELETE') return json({error:'Type DELETE to confirm account deletion.'},400);

  const userClient=createClient(url,publishable,{
    global:{headers:{Authorization:`Bearer ${token}`}},
    auth:{persistSession:false,autoRefreshToken:false}
  });

  const {data:{user},error:authError}=await userClient.auth.getUser(token);
  if(authError||!user) return json({error:'Your session expired. Please sign in again.'},401);

  const admin=createClient(url,serviceRole,{auth:{persistSession:false,autoRefreshToken:false}});
  const ownerId=user.id;

  // Remove application data explicitly before deleting the auth user.
  // This also makes the behavior predictable even if a future table does not cascade.
  const tables=['feedback','transactions','recurring_items','goals','budgets','settings','admin_users'] as const;
  for(const table of tables){
    const column=table==='admin_users'?'user_id':'owner_id';
    const {error}=await admin.from(table).delete().eq(column,ownerId);
    if(error) return json({error:`Could not delete account data from ${table}.`},500);
  }

  const {error:deleteUserError}=await admin.auth.admin.deleteUser(ownerId);
  if(deleteUserError) return json({error:'Your data was removed, but the sign-in account could not be deleted. Please contact support.'},500);

  return json({ok:true});
}

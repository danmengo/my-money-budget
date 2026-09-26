import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

const headers={ 'Cache-Control':'no-store, max-age=0' };
const json=(body:unknown,status=200)=>NextResponse.json(body,{status,headers});

export async function POST(request:NextRequest){
  const url=process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishable=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  const serviceRole=process.env.SUPABASE_SECRET_KEY;
  const token=request.headers.get('authorization')?.match(/^Bearer (.+)$/i)?.[1];

  if(!url||!publishable||!token) return json({error:'Sign in required.'},401);
  if(!serviceRole) return json({error:'Account deletion is not configured yet.'},503);

  const contentLength=Number(request.headers.get('content-length')||0);
  if(contentLength>2048) return json({error:'Request is too large.'},413);
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

  // All user-owned application tables reference auth.users with ON DELETE CASCADE.
  // Delete the auth user as one authoritative operation so the database handles dependent rows.
  const {error:deleteUserError}=await admin.auth.admin.deleteUser(ownerId);
  if(deleteUserError){
    console.error('Account deletion failed',deleteUserError);
    return json({error:'Could not delete your account. Please try again or contact support.'},500);
  }

  return json({ok:true});
}

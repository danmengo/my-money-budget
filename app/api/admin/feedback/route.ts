import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const url=process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  const token=request.headers.get('authorization')?.match(/^Bearer (.+)$/i)?.[1];
  if(!url||!key||!token) return NextResponse.json({error:'Sign in required.'},{status:401});

  const client=createClient(url,key,{global:{headers:{Authorization:`Bearer ${token}`}},auth:{persistSession:false,autoRefreshToken:false}});
  const {data:{user},error:authError}=await client.auth.getUser(token);
  if(authError||!user) return NextResponse.json({error:'Your session expired.'},{status:401});

  const {data:admin,error:adminError}=await client.from('admin_users').select('user_id').eq('user_id',user.id).maybeSingle();
  if(adminError) return NextResponse.json({error:adminError.message},{status:500});
  if(!admin) return NextResponse.json({error:'Admin access required.'},{status:403});

  const {data,error}=await client.from('feedback').select('id,owner_id,email,message,created_at').order('created_at',{ascending:false});
  if(error) return NextResponse.json({error:error.message},{status:500});
  return NextResponse.json({feedback:data||[]});
}

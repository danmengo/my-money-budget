import { NextRequest } from 'next/server';
import { handleSupabase } from './supabase';

export async function GET(request: NextRequest) {
  return handleSupabase(request);
}

export async function POST(request: NextRequest) {
  return handleSupabase(request);
}

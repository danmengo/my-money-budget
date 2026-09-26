import { createClient } from '@supabase/supabase-js';
import { deleteAccount } from '@/lib/account-deletion';

export async function POST(request: Request) {
  return deleteAccount(request, {
    url: process.env.NEXT_PUBLIC_SUPABASE_URL,
    publishableKey: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    secretKey: process.env.SUPABASE_SECRET_KEY,
  }, createClient);
}

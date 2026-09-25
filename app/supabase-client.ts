import { createClient } from '@supabase/supabase-js';
import type { SupabaseClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

export const supabaseEnabled = Boolean(url && key);
let client: SupabaseClient | undefined;

export function getSupabase() {
  if (!url || !key) throw new Error('Supabase is not configured.');
  return client ??= createClient(url, key);
}

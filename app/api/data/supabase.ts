import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

const defaultCategories = ['Housing','Utilities','Food','Transportation','Shopping','Entertainment','Subscriptions','Investing','Miscellaneous'];
const initialBudgets = [150000,15000,60000,35000,30000,25000,10000,0,20000];
const bad = (message: string, status = 400) => NextResponse.json({ error: message }, { status });

export async function handleSupabase(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  const token = request.headers.get('authorization')?.match(/^Bearer (.+)$/i)?.[1];
  if (!url || !key || !token) return bad('Sign in to access your budget.', 401);

  // Use the user's token, never an admin key. RLS applies to every query.
  const client = createClient(url, key, { global: { headers: { Authorization: `Bearer ${token}` } }, auth: { persistSession: false, autoRefreshToken: false } });
  const { data: { user }, error: authError } = await client.auth.getUser(token);
  if (authError || !user) return bad('Your session expired. Please sign in again.', 401);
  const owner_id = user.id;

  async function run() {
    const { data: marker, error: markerError } = await client.from('settings').select('value').eq('owner_id',owner_id).eq('key','initialized').maybeSingle();
    if (markerError) throw markerError;
    if (!marker) {
      const { error } = await client.from('budgets').upsert(defaultCategories.map((category, i) => ({ owner_id, category, amount: initialBudgets[i] })), { onConflict: 'owner_id,category', ignoreDuplicates: true });
      if (error) throw error;
      const { error: initError } = await client.from('settings').upsert({ owner_id, key: 'initialized', value: 'personal' }, { onConflict: 'owner_id,key', ignoreDuplicates: true });
      if (initError) throw initError;
    }

    const { data: categorySetting, error: categoryError } = await client.from('settings').select('value').eq('owner_id',owner_id).eq('key','expense_categories').maybeSingle();
    if (categoryError) throw categoryError;
    let categories: string[] = defaultCategories;
    if (categorySetting?.value) { try { const parsed=JSON.parse(categorySetting.value); if(Array.isArray(parsed)) categories=parsed.filter(v=>typeof v==='string'&&v.trim()).map(v=>v.trim().slice(0,40)); } catch {} }
    // Merge any legacy budget categories so existing data is never hidden.
    const { data: existingBudgets, error: existingBudgetError } = await client.from('budgets').select('category').eq('owner_id',owner_id);
    if (existingBudgetError) throw existingBudgetError;
    for (const row of existingBudgets || []) if (!categories.includes(row.category)) categories.push(row.category);

    if (request.method === 'POST') {
      const x = await request.json() as Record<string, unknown>;
      let error: { message: string } | null = null;
      const id = Number(x.id);
      const validId = Number.isSafeInteger(id) && id > 0;
      const amount = Math.round(Number(x.amount) * 100);
      const name = typeof x.name === 'string' ? x.name.trim().slice(0,100) : '';
      if (x.action === 'transaction') {
        if (!name || typeof x.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(x.date) || !Number.isSafeInteger(amount) || amount <= 0 || amount > 100000000 || !['expense','income','saving','investing'].includes(String(x.type)) || !(x.type === 'expense' ? categories.includes(String(x.category)) : x.category === x.type)) return bad('Check the transaction details.');
        if (x.id !== undefined && !validId) return bad('Invalid transaction.');
        const row = { owner_id, date: x.date, name, amount, category: String(x.category), type: String(x.type), demo: false };
        if (x.id !== undefined) ({ error } = await client.from('transactions').update(row).eq('owner_id',owner_id).eq('id',id));
        else ({ error } = await client.from('transactions').insert(row));
      } else if (x.action === 'deleteTransaction') {
        if (!validId) return bad('Invalid transaction.');
        ({ error } = await client.from('transactions').delete().eq('owner_id',owner_id).eq('id',id));
      } else if (x.action === 'addCategory') {
        const category = typeof x.category === 'string' ? x.category.trim().replace(/\s+/g,' ').slice(0,40) : '';
        if (!category || categories.some(c=>c.toLowerCase()===category.toLowerCase())) return bad('Enter a new category name.');
        categories=[...categories,category];
        const setResult=await client.from('settings').upsert({owner_id,key:'expense_categories',value:JSON.stringify(categories)},{onConflict:'owner_id,key'}); if(setResult.error) throw setResult.error;
        ({error}=await client.from('budgets').upsert({owner_id,category,amount:0,demo:false},{onConflict:'owner_id,category'}));
      } else if (x.action === 'deleteCategory') {
        const category=String(x.category||'');
        if (!categories.includes(category)) return bad('Category not found.');
        const {count,error:countError}=await client.from('transactions').select('id',{count:'exact',head:true}).eq('owner_id',owner_id).eq('category',category); if(countError) throw countError;
        if((count||0)>0) return bad('Move or delete transactions in this category before removing it.');
        categories=categories.filter(c=>c!==category);
        const setResult=await client.from('settings').upsert({owner_id,key:'expense_categories',value:JSON.stringify(categories)},{onConflict:'owner_id,key'}); if(setResult.error) throw setResult.error;
        ({error}=await client.from('budgets').delete().eq('owner_id',owner_id).eq('category',category));
      } else if (x.action === 'budget') {
        if (!categories.includes(String(x.category)) || !Number.isSafeInteger(amount) || amount < 0 || amount > 100000000) return bad('Enter a valid budget amount.');
        ({ error } = await client.from('budgets').upsert({ owner_id, category: x.category, amount, demo: false }, { onConflict: 'owner_id,category' }));
      } else if (x.action === 'monthlyIncome') {
        if (!Number.isSafeInteger(amount) || amount < 0 || amount > 1000000000) return bad('Enter a valid monthly income.');
        ({ error } = await client.from('settings').upsert({ owner_id, key: 'monthly_income', value: String(amount) }, { onConflict: 'owner_id,key' }));
      } else if (x.action === 'goal') {
        const target = Math.round(Number(x.target)*100), current = Math.round(Number(x.current)*100);
        if (!name || !['saving','investing'].includes(String(x.type)) || !Number.isSafeInteger(target) || target <= 0 || target > 1000000000 || !Number.isSafeInteger(current) || current < 0 || current > 1000000000) return bad('Enter valid goal details.');
        if (x.id !== undefined && !validId) return bad('Invalid goal.');
        const row = { owner_id, name, type: String(x.type), target, current, demo: false };
        if (x.id !== undefined) ({ error } = await client.from('goals').update(row).eq('owner_id',owner_id).eq('id',id));
        else ({ error } = await client.from('goals').insert(row));
      } else if (x.action === 'deleteGoal') {
        if (!validId) return bad('Invalid goal.');
        ({ error } = await client.from('goals').delete().eq('owner_id',owner_id).eq('id',id));
      } else if (x.action === 'clearDemo') {
        const { data: demoMarker, error: lookupError } = await client.from('settings').select('value').eq('owner_id',owner_id).eq('key','initialized').single();
        if (lookupError) throw lookupError;
        if (demoMarker.value !== 'demo') return bad('Demo data already removed');
        for (const table of ['transactions','budgets','goals'] as const) {
          const result = await client.from(table).delete().eq('owner_id',owner_id).eq('demo',true);
          if (result.error) throw result.error;
        }
        ({ error } = await client.from('settings').update({value:'personal'}).eq('owner_id',owner_id).eq('key','initialized'));
      } else return bad('Unknown action');
      if (error) throw error;
    }

    const [t,b,g,s,mi] = await Promise.all([
      client.from('transactions').select('id,date,name,amount,category,type').eq('owner_id',owner_id).order('date',{ascending:false}).order('id',{ascending:false}),
      client.from('budgets').select('category,amount').eq('owner_id',owner_id),
      client.from('goals').select('id,name,type,target,current').eq('owner_id',owner_id).order('id'),
      client.from('settings').select('value').eq('owner_id',owner_id).eq('key','initialized').single(),
      client.from('settings').select('value').eq('owner_id',owner_id).eq('key','monthly_income').maybeSingle(),
    ]);
    for (const result of [t,b,g,s,mi]) if (result.error) throw result.error;
    const monthlyIncome = mi.data?.value ? Number(mi.data.value) : 0;
    return NextResponse.json({ transactions: t.data, budgets: (b.data || []).sort((a,b) => categories.indexOf(a.category)-categories.indexOf(b.category)), categories, goals:g.data, demo:s.data?.value === 'demo', monthlyIncome: Number.isSafeInteger(monthlyIncome) ? monthlyIncome : 0 });
  }
  try { return await run(); }
  catch (error) { console.error('Supabase budget request failed', error); return bad('Could not access your budget. Please try again.',503); }
}

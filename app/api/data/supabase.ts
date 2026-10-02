import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';
import { readJsonObject } from '@/lib/request-json';
import { parseMonthReviews, validMonth } from '@/lib/month-review';
import { readAllPages } from '@/lib/read-all-pages';
import { budgetPlanKey, parseBudgetPlans, rolloverModes } from '@/lib/budget-planning';
import { enrichGoalData } from '@/lib/goal-tracking';
import { shiftMonth } from '@/lib/month-review';

const defaultCategories = ['Housing','Utilities','Food','Transportation','Shopping','Entertainment','Subscriptions','Investing','Miscellaneous'];
const initialBudgets = [150000,15000,60000,35000,30000,25000,10000,0,20000];
const responseHeaders = { 'Cache-Control': 'no-store, max-age=0' };
const bad = (message: string, status = 400) => NextResponse.json({ error: message }, { status, headers: responseHeaders });

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
  const ownerEmail = user.email || null;

  // Validate before initialization or recurring-payment processing can write data.
  let body: Record<string, unknown> = {};
  if (request.method === 'POST') {
    const parsed = await readJsonObject(request, 16384);
    if (!parsed.ok) return bad(parsed.error, parsed.status);
    body = parsed.value;
  }

  // Validate review choices before any initialization or recurring writes.
  if (body.action === 'monthReview') {
    let currentMonth: string;
    try {
      const timeZone = typeof body.timeZone === 'string' ? body.timeZone : 'UTC';
      const parts = new Intl.DateTimeFormat('en-US', { timeZone, year: 'numeric', month: '2-digit' }).formatToParts(new Date());
      currentMonth = `${parts.find(part => part.type === 'year')!.value}-${parts.find(part => part.type === 'month')!.value}`;
    } catch { return bad('Choose a valid time zone.'); }
    if (!validMonth(body.month) || body.month >= currentMonth || !['carry', 'unallocated'].includes(String(body.choice))) {
      return bad('Choose a completed month and a valid surplus option.');
    }
  }

  if (body.action === 'budget' || body.action === 'resetBudget') {
    if (!validMonth(body.month)) return bad('Choose a valid budget month.');
    if (body.action === 'budget' && !rolloverModes.includes(body.rollover as typeof rolloverModes[number])) return bad('Choose a valid rollover option.');
  }

  if (body.action === 'goal' && body.tracking !== undefined && !['manual','linked'].includes(String(body.tracking))) return bad('Choose a valid goal tracking mode.');
  const warnings: string[] = [];
  // A financial record can save even if its optional metadata write fails.
  // Return success with a specific warning so the UI does not invite a duplicate.
  async function saveMetadata(key: string, value: string, warning: string) {
    try {
      const result = await client.from('settings').upsert({owner_id,key,value},{onConflict:'owner_id,key'});
      if (result.error) throw result.error;
    } catch { warnings.push(warning); }
  }
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

    let selectedGoalId: number | null | undefined;
    if (['transaction','recurring'].includes(String(body.action)) && body.goal_id !== undefined) {
      selectedGoalId = body.goal_id === null || body.goal_id === 'none' || body.goal_id === '' ? null : Number(body.goal_id);
      if (selectedGoalId !== null) {
        if (!Number.isSafeInteger(selectedGoalId) || selectedGoalId <= 0 || !['saving','investing'].includes(String(body.type))) return bad('Choose a matching saving or investing goal.');
        const goal = await client.from('goals').select('id,type').eq('owner_id',owner_id).eq('id',selectedGoalId).maybeSingle();
        if (goal.error) throw goal.error;
        if (!goal.data || goal.data.type !== body.type) return bad('Choose one of your matching goals.');
      }
    }

    // Keep exactly one posted transaction per recurring item per month.
    // Existing linked occurrences are repaired in place when the recurring rule changes.
    const now = new Date();
    const currentYm = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;
    const monthLast = new Date(now.getFullYear(), now.getMonth()+1, 0).getDate();
    const monthStart = `${currentYm}-01`;
    const monthEnd = `${currentYm}-${String(monthLast).padStart(2,'0')}`;
    const todayDate = `${currentYm}-${String(now.getDate()).padStart(2,'0')}`;
    const { data: recurringForAuto, error: recurringAutoError } = await readAllPages((from,to)=>client.from('recurring_items').select('id,name,amount,category,type,day_of_month,start_date,active,end_type,end_date,max_occurrences,ended_at').eq('owner_id',owner_id).eq('active',true).order('id').range(from,to));
    if (recurringAutoError) throw recurringAutoError;
    for (const item of recurringForAuto || []) {
      if (!item.start_date || item.start_date.slice(0,7) > currentYm) continue;
      const dueDay = Math.min(item.day_of_month, monthLast);
      const dueDate = `${currentYm}-${String(dueDay).padStart(2,'0')}`;
      if(item.end_type==='date' && item.end_date && dueDate>item.end_date){
        const ended=await client.from('recurring_items').update({active:false,ended_at:new Date().toISOString()}).eq('owner_id',owner_id).eq('id',item.id);
        if(ended.error) throw ended.error;
        continue;
      }
      if(item.end_type==='count' && item.max_occurrences){
        const {count:occurrenceCount,error:occurrenceError}=await client.from('transactions').select('id',{count:'exact',head:true}).eq('owner_id',owner_id).eq('recurring_item_id',item.id);
        if(occurrenceError) throw occurrenceError;
        if((occurrenceCount||0)>=item.max_occurrences){
          const ended=await client.from('recurring_items').update({active:false,ended_at:new Date().toISOString()}).eq('owner_id',owner_id).eq('id',item.id);
          if(ended.error) throw ended.error;
          continue;
        }
      }
      const { data: linked, error: linkedError } = await client.from('transactions').select('id,date').eq('owner_id',owner_id).eq('recurring_item_id',item.id).gte('date',monthStart).lte('date',monthEnd).order('id',{ascending:true});
      if (linkedError) throw linkedError;
      if ((linked || []).length > 0) {
        const keep = linked![0];
        const duplicateIds=(linked || []).slice(1).map(row=>row.id);
        if (duplicateIds.length) {
          const deleteResult=await client.from('transactions').delete().eq('owner_id',owner_id).in('id',duplicateIds);
          if (deleteResult.error) throw deleteResult.error;
        }
        const syncResult = await client.from('transactions').update({
          date: dueDate,
          name: item.name,
          amount: item.amount,
          category: item.type==='expense'?item.category:item.type,
          type: item.type
        }).eq('owner_id',owner_id).eq('id',keep.id);
        if (syncResult.error) throw syncResult.error;
        continue;
      }
      if (dueDate > todayDate) continue;
      const { error: insertError } = await client.from('transactions').insert({owner_id,date:dueDate,name:item.name,amount:item.amount,category:item.type==='expense'?item.category:item.type,type:item.type,demo:false,recurring_item_id:item.id});
      if (insertError && insertError.code !== '23505') throw insertError;
    }

    if (request.method === 'POST') {
      const x = body;
      let error: { message: string } | null = null;
      const id = Number(x.id);
      const validId = Number.isSafeInteger(id) && id > 0;
      const amount = Math.round(Number(x.amount) * 100);
      const name = typeof x.name === 'string' ? x.name.trim().slice(0,100) : '';
      if (x.action === 'monthReview') {
        ({ error } = await client.from('settings').upsert({ owner_id, key: `month_review:${x.month}`, value: String(x.choice) }, { onConflict: 'owner_id,key' }));
      } else if (x.action === 'transaction') {
        if (!name || typeof x.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(x.date) || !Number.isSafeInteger(amount) || amount <= 0 || amount > 100000000 || !['expense','income','saving','investing'].includes(String(x.type)) || !(x.type === 'expense' ? categories.includes(String(x.category)) : x.category === x.type)) return bad('Check the transaction details.');
        if (x.id !== undefined && !validId) return bad('Invalid transaction.');
        const row = { owner_id, date: x.date, name, amount, category: String(x.category), type: String(x.type), demo: false };
        const saved = x.id !== undefined
          ? await client.from('transactions').update(row).eq('owner_id',owner_id).eq('id',id).select('id').single()
          : await client.from('transactions').insert(row).select('id').single();
        error = saved.error;
        if (!error && saved.data && selectedGoalId !== undefined) await saveMetadata(`plan:tx-goal:${saved.data.id}`,String(selectedGoalId ?? 0),'Transaction saved, but its goal link could not be saved. Edit the transaction to retry the goal selection.');
      } else if (x.action === 'deleteTransaction') {
        if (!validId) return bad('Invalid transaction.');
        ({ error } = await client.from('transactions').delete().eq('owner_id',owner_id).eq('id',id));
        if (!error) await client.from('settings').delete().eq('owner_id',owner_id).eq('key',`plan:tx-goal:${id}`);
      } else if (x.action === 'addCategory') {
        const category = typeof x.category === 'string' ? x.category.trim().replace(/\s+/g,' ').slice(0,40) : '';
        if (!category || categories.some(c=>c.toLowerCase()===category.toLowerCase())) return bad('Enter a new category name.');
        categories=[...categories,category];
        const setResult=await client.from('settings').upsert({owner_id,key:'expense_categories',value:JSON.stringify(categories)},{onConflict:'owner_id,key'}); if(setResult.error) throw setResult.error;
        ({error}=await client.from('budgets').upsert({owner_id,category,amount:0,demo:false},{onConflict:'owner_id,category'}));
      } else if (x.action === 'deleteCategory') {
        const category=String(x.category||'');
        if (!categories.includes(category)) return bad('Category not found.');
        const [{count,error:countError},{count:recurringCount,error:recurringCountError}]=await Promise.all([client.from('transactions').select('id',{count:'exact',head:true}).eq('owner_id',owner_id).eq('category',category),client.from('recurring_items').select('id',{count:'exact',head:true}).eq('owner_id',owner_id).eq('category',category)]); if(countError) throw countError; if(recurringCountError) throw recurringCountError;
        if((count||0)>0 || (recurringCount||0)>0) return bad('Move or remove transactions and recurring items in this category before removing it.');
        categories=categories.filter(c=>c!==category);
        const setResult=await client.from('settings').upsert({owner_id,key:'expense_categories',value:JSON.stringify(categories)},{onConflict:'owner_id,key'}); if(setResult.error) throw setResult.error;
        ({error}=await client.from('budgets').delete().eq('owner_id',owner_id).eq('category',category));
        if (!error) { const prefix=`plan:budget:${encodeURIComponent(category)}:`; const removed=await client.from('settings').delete().eq('owner_id',owner_id).gte('key',prefix).lt('key',prefix+'~'); if(removed.error) throw removed.error; }
      } else if (x.action === 'recurring') {
        const recurringType=String(x.type);
        const recurringCategory=recurringType==='expense'?String(x.category):recurringType;
        const day=Number(x.day_of_month);
        if (!name || !['expense','income','saving','investing'].includes(recurringType) || !Number.isSafeInteger(amount) || amount<=0 || amount>100000000 || !Number.isInteger(day) || day<1 || day>31 || (recurringType==='expense'&&!categories.includes(recurringCategory))) return bad('Check the recurring item details.');
        if (x.id !== undefined && !validId) return bad('Invalid recurring item.');
        const startDate=typeof x.start_date==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(x.start_date)?x.start_date:'';
        if(!startDate) return bad('Choose a valid start date.');
        const endType=['never','date','count'].includes(String(x.end_type))?String(x.end_type):'never';
        const endDate=endType==='date'&&typeof x.end_date==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(x.end_date)?x.end_date:null;
        const maxOccurrences=endType==='count'?Number(x.max_occurrences):null;
        if(endType==='date'&&!endDate) return bad('Choose a valid end date.');
        if(endType==='count'&&(maxOccurrences===null||!Number.isInteger(maxOccurrences)||maxOccurrences<1||maxOccurrences>1200)) return bad('Choose a valid number of payments.');
        const row={owner_id,name,amount,category:recurringCategory,type:recurringType,frequency:'monthly',day_of_month:day,start_date:startDate,end_type:endType,end_date:endDate,max_occurrences:maxOccurrences,active:x.active!==false,ended_at:null};
        let recurringId=id;
        if(x.id!==undefined) {
          ({error}=await client.from('recurring_items').update(row).eq('owner_id',owner_id).eq('id',id));
          if(!error){
            const now=new Date();
            const ym=`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;
            const syncResult=await client.from('transactions').update({
              name,
              amount,
              category:recurringType==='expense'?recurringCategory:recurringType,
              type:recurringType
            }).eq('owner_id',owner_id).eq('recurring_item_id',id).gte('date',`${ym}-01`).lte('date',`${ym}-31`);
            if(syncResult.error) throw syncResult.error;
          }
        } else {
          const saved=await client.from('recurring_items').insert(row).select('id').single();
          error=saved.error;
          recurringId=saved.data?.id;
        }
        if (!error && selectedGoalId !== undefined) {
          const posted=await client.from('transactions').select('date').eq('owner_id',owner_id).eq('recurring_item_id',recurringId).order('date',{ascending:false}).limit(1);
          if (posted.error) warnings.push('Recurring item saved, but the goal link could not be saved. Edit it to retry.');
          else {
            const afterLast = posted.data?.[0] ? shiftMonth(posted.data[0].date.slice(0,7),1) : currentYm;
            const effectiveMonth = [currentYm,startDate.slice(0,7),afterLast].sort().at(-1)!;
            await saveMetadata(`plan:recurring-goal:${recurringId}:${effectiveMonth}`,String(selectedGoalId ?? 0),'Recurring item saved, but the goal link could not be saved. Edit it to retry.');
          }
        }
      } else if (x.action === 'markRecurringPaid') {
        if(!validId || typeof x.date!=='string' || !/^\d{4}-\d{2}-\d{2}$/.test(x.date)) return bad('Invalid recurring payment.');
        const {data:item,error:itemError}=await client.from('recurring_items').select('id,name,amount,category,type').eq('owner_id',owner_id).eq('id',id).single(); if(itemError) throw itemError;
        const monthPrefix=x.date.slice(0,7);
        const {count,error:dupError}=await client.from('transactions').select('id',{count:'exact',head:true}).eq('owner_id',owner_id).eq('recurring_item_id',id).gte('date',`${monthPrefix}-01`).lte('date',`${monthPrefix}-31`); if(dupError) throw dupError;
        if((count||0)>0) return bad('This recurring item is already marked paid for that month.');
        ({error}=await client.from('transactions').insert({owner_id,date:x.date,name:item.name,amount:item.amount,category:item.type==='expense'?item.category:item.type,type:item.type,demo:false,recurring_item_id:id}));
      } else if (x.action === 'toggleRecurring') {
        if(!validId || typeof x.active!=='boolean') return bad('Invalid recurring item.');
        ({error}=await client.from('recurring_items').update({active:x.active,ended_at:x.active?null:undefined}).eq('owner_id',owner_id).eq('id',id));
      } else if (x.action === 'endRecurring') {
        if(!validId) return bad('Invalid recurring item.');
        ({error}=await client.from('recurring_items').update({active:false,ended_at:new Date().toISOString()}).eq('owner_id',owner_id).eq('id',id));
      } else if (x.action === 'deleteRecurring') {
        if(!validId) return bad('Invalid recurring item.');
        const [transactions, goals, settings] = await Promise.all([
          readAllPages((from,to)=>client.from('transactions').select('id,date,type,amount,recurring_item_id').eq('owner_id',owner_id).eq('recurring_item_id',id).order('id').range(from,to)),
          client.from('goals').select('id,name,type,target,current').eq('owner_id',owner_id),
          readAllPages((from,to)=>client.from('settings').select('key,value').eq('owner_id',owner_id).like('key','plan:%').order('key').range(from,to)),
        ]);
        if (goals.error) throw goals.error;
        const links=enrichGoalData(transactions.data,[],goals.data||[],settings.data).transactions.filter(t=>t.goal_id !== null).map(t=>({owner_id,key:`plan:tx-goal:${t.id}`,value:String(t.goal_id)}));
        if (links.length) { const saved=await client.from('settings').upsert(links,{onConflict:'owner_id,key'}); if(saved.error) throw saved.error; }
        ({error}=await client.from('recurring_items').delete().eq('owner_id',owner_id).eq('id',id));
      } else if (x.action === 'feedback') {
        const message=typeof x.message==='string'?x.message.trim().slice(0,2000):'';
        if(!message) return bad('Write a message before sending feedback.');
        ({error}=await client.from('feedback').insert({owner_id,email:ownerEmail,message}));
      } else if (x.action === 'resetBudget') {
        ({error}=await client.from('settings').upsert(categories.map(category=>({owner_id,key:budgetPlanKey(category,String(x.month)),value:JSON.stringify({amount:0,rollover:'none',reset:true})})),{onConflict:'owner_id,key'}));
      } else if (x.action === 'budget') {
        if (!categories.includes(String(x.category)) || !Number.isSafeInteger(amount) || amount < 0 || amount > 100000000) return bad('Enter a valid budget amount.');
        ({ error } = await client.from('settings').upsert({ owner_id, key: budgetPlanKey(String(x.category),String(x.month)), value: JSON.stringify({amount,rollover:x.rollover}) }, { onConflict: 'owner_id,key' }));
      } else if (x.action === 'monthlyIncome') {
        if (!Number.isSafeInteger(amount) || amount < 0 || amount > 1000000000) return bad('Enter a valid monthly income.');
        ({ error } = await client.from('settings').upsert({ owner_id, key: 'monthly_income', value: String(amount) }, { onConflict: 'owner_id,key' }));
      } else if (x.action === 'goal') {
        const target = Math.round(Number(x.target)*100), current = Math.round(Number(x.current)*100);
        if (!name || !['saving','investing'].includes(String(x.type)) || !Number.isSafeInteger(target) || target <= 0 || target > 1000000000 || !Number.isSafeInteger(current) || current < 0 || current > 1000000000) return bad('Enter valid goal details.');
        if (x.id !== undefined && !validId) return bad('Invalid goal.');
        const row = { owner_id, name, type: String(x.type), target, current, demo: false };
        if (x.id !== undefined) {
          const existing=await client.from('goals').select('type').eq('owner_id',owner_id).eq('id',id).single();
          if (existing.error) throw existing.error;
          if (existing.data.type !== x.type) return bad('A goal’s type cannot be changed. Create a new goal for the other type.');
        }
        const saved=x.id !== undefined
          ? await client.from('goals').update(row).eq('owner_id',owner_id).eq('id',id).select('id').single()
          : await client.from('goals').insert(row).select('id').single();
        error=saved.error;
        if (!error && saved.data && x.tracking !== undefined) await saveMetadata(`plan:goal-mode:${saved.data.id}`,String(x.tracking),'Goal saved, but the tracking mode could not be updated. Edit the goal to retry.');
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

    const [t,b,g,s,mi,r,admin,reviews,planning] = await Promise.all([
      readAllPages((from, to) => client.from('transactions').select('id,date,name,amount,category,type,recurring_item_id').eq('owner_id',owner_id).order('date',{ascending:false}).order('id',{ascending:false}).range(from, to)),
      client.from('budgets').select('category,amount').eq('owner_id',owner_id),
      readAllPages((from,to)=>client.from('goals').select('id,name,type,target,current').eq('owner_id',owner_id).order('id').range(from,to)),
      client.from('settings').select('value').eq('owner_id',owner_id).eq('key','initialized').single(),
      client.from('settings').select('value').eq('owner_id',owner_id).eq('key','monthly_income').maybeSingle(),
      readAllPages((from,to)=>client.from('recurring_items').select('id,name,amount,category,type,frequency,day_of_month,start_date,active,end_type,end_date,max_occurrences,ended_at').eq('owner_id',owner_id).order('active',{ascending:false}).order('day_of_month').order('id').range(from,to)),
      client.from('admin_users').select('user_id').eq('user_id',owner_id).maybeSingle(),
      readAllPages((from, to) => client.from('settings').select('key,value').eq('owner_id',owner_id).like('key','month_review:%').order('key').range(from, to)),
      readAllPages((from,to)=>client.from('settings').select('key,value').eq('owner_id',owner_id).like('key','plan:%').order('key').range(from,to)),
    ]);
    for (const result of [t,b,g,s,mi,r,admin,reviews,planning]) if (result.error) throw result.error;
    const linked = enrichGoalData(t.data,r.data||[],g.data||[],planning.data);
    const monthlyIncome = mi.data?.value ? Number(mi.data.value) : 0;
    return NextResponse.json({ transactions: linked.transactions, planningSettings: planning.data, warning: warnings.join(' ') || undefined, budgetPlans: parseBudgetPlans(planning.data), monthReviews: parseMonthReviews(reviews.data), budgets: (b.data || []).sort((a,b) => categories.indexOf(a.category)-categories.indexOf(b.category)), categories, goals:linked.goals, recurring:linked.recurring, demo:s.data?.value === 'demo', monthlyIncome: Number.isSafeInteger(monthlyIncome) ? monthlyIncome : 0, isAdmin: !!admin.data },{headers:responseHeaders});
  }
  try { return await run(); }
  catch (error) {
    console.error('Supabase budget request failed', error);
    return bad('Could not access your budget. Please try again.',503);
  }
}

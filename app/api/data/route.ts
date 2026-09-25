import { env } from 'cloudflare:workers';
import { NextRequest, NextResponse } from 'next/server';
import { getChatGPTUser, type ChatGPTUser } from '../../chatgpt-auth';

const db = () => { if (!env.DB) throw new Error('Storage unavailable'); return env.DB; };
const bad = (message:string,status=400) => NextResponse.json({error:message},{status});
const categories = ['Housing','Utilities','Food','Transportation','Shopping','Entertainment','Subscriptions','Miscellaneous'];
const initialBudgets = [['Housing',150000],['Utilities',15000],['Food',60000],['Transportation',35000],['Shopping',30000],['Entertainment',25000],['Subscriptions',10000],['Miscellaneous',20000]] as const;
const today = () => new Date().toISOString().slice(0,10);

// This address only gates the one-time claim of records created before accounts existed.
const LEGACY_OWNER_EMAIL = 'danielmeng530@gmail.com';
async function initialize(database:D1Database, user:ChatGPTUser){
  const ownerId=user.userId;
  const initialized = await database.prepare("SELECT value FROM settings WHERE owner_id=? AND key='initialized'").bind(ownerId).first();
  if(initialized) return;
  // The previous version had one private owner. Attach those records to that owner's first signed-in visit.
  const legacy = await database.prepare("SELECT value FROM settings WHERE owner_id='' AND key='initialized'").first();
  if(legacy && user.email.toLowerCase()===LEGACY_OWNER_EMAIL){
    await database.batch([
      database.prepare("UPDATE transactions SET owner_id=? WHERE owner_id=''").bind(ownerId),
      database.prepare("UPDATE budgets SET owner_id=? WHERE owner_id=''").bind(ownerId),
      database.prepare("UPDATE goals SET owner_id=? WHERE owner_id=''").bind(ownerId),
      database.prepare("UPDATE settings SET owner_id=? WHERE owner_id=''").bind(ownerId),
    ]);
    return;
  }
  const month=today().slice(0,7);
  const samples:[string,string,number,string,string][]=[
    [`${month}-01`,'Paycheck',500000,'Income','income'],[`${month}-02`,'Rent',150000,'Housing','expense'],[`${month}-03`,'Electric & internet',13840,'Utilities','expense'],[`${month}-04`,'Trader Joe’s',8745,'Food','expense'],[`${month}-06`,'Gas station',5278,'Transportation','expense'],[`${month}-08`,'Coffee shop',1260,'Food','expense'],[`${month}-10`,'Netflix',1599,'Subscriptions','expense'],[`${month}-12`,'Target',6830,'Shopping','expense'],[`${month}-14`,'Dinner with friends',6480,'Food','expense'],[`${month}-17`,'Movie tickets',3650,'Entertainment','expense'],[`${month}-20`,'Groceries',11420,'Food','expense'],[`${month}-22`,'Rideshare',2420,'Transportation','expense'],[`${month}-23`,'Transfer to savings',65000,'saving','saving'],[`${month}-24`,'Investment contribution',40000,'investing','investing']
  ];
  await database.batch([
    ...initialBudgets.map(([c,a])=>database.prepare('INSERT INTO budgets(owner_id,category,amount,demo) VALUES (?,?,?,1)').bind(ownerId,c,a)),
    ...samples.map(x=>database.prepare('INSERT INTO transactions(owner_id,date,name,amount,category,type,demo) VALUES (?,?,?,?,?,?,1)').bind(ownerId,...x)),
    database.prepare('INSERT INTO goals(owner_id,name,type,target,current,demo) VALUES (?,?,?,?,?,1)').bind(ownerId,'Emergency fund','saving',1000000,800000),
    database.prepare('INSERT INTO goals(owner_id,name,type,target,current,demo) VALUES (?,?,?,?,?,1)').bind(ownerId,'Monthly investing','investing',50000,40000),
    database.prepare("INSERT INTO settings(owner_id,key,value) VALUES (?,'initialized','demo')").bind(ownerId)
  ]);
}

async function snapshot(database:D1Database,ownerId:string){
  const [t,b,g,s]=await Promise.all([
    database.prepare('SELECT id,date,name,amount,category,type FROM transactions WHERE owner_id=? ORDER BY date DESC,id DESC').bind(ownerId).all(),
    database.prepare('SELECT category,amount FROM budgets WHERE owner_id=? ORDER BY rowid').bind(ownerId).all(),
    database.prepare('SELECT id,name,type,target,current FROM goals WHERE owner_id=? ORDER BY id').bind(ownerId).all(),
    database.prepare("SELECT value FROM settings WHERE owner_id=? AND key='initialized'").bind(ownerId).first<{value:string}>()
  ]);
  return {transactions:t.results,budgets:b.results,goals:g.results,demo:s?.value==='demo'};
}

export async function GET(){
  const user=await getChatGPTUser();
  if(!user)return bad('Sign in to view your budget.',401);
  try{const d=db();await initialize(d,user);return NextResponse.json(await snapshot(d,user.userId));}
  catch(e){console.error(e);return bad('Unable to load your budget. Please try again.',503)}
}
export async function POST(request:NextRequest){
  const user=await getChatGPTUser();
  if(!user)return bad('Sign in to change your budget.',401);
  const ownerId=user.userId;
  try{
    const d=db();await initialize(d,user);const x=await request.json() as Record<string,unknown>;
    if(x.action==='clearDemo'){
      if((await d.prepare("SELECT value FROM settings WHERE owner_id=? AND key='initialized'").bind(ownerId).first<{value:string}>())?.value!=='demo')return bad('Demo data already removed');
      await d.batch([
        d.prepare('DELETE FROM transactions WHERE owner_id=? AND demo=1').bind(ownerId),
        d.prepare('DELETE FROM budgets WHERE owner_id=? AND demo=1').bind(ownerId),
        d.prepare('DELETE FROM goals WHERE owner_id=? AND demo=1').bind(ownerId),
        d.prepare("UPDATE settings SET value='personal' WHERE owner_id=? AND key='initialized'").bind(ownerId)
      ]);
    }else if(x.action==='transaction'){
      const amount=Math.round(Number(x.amount)*100),id=Number(x.id);
      const name=typeof x.name==='string'?x.name.trim():'';
      if(!name||typeof x.date!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(x.date)||!Number.isSafeInteger(amount)||amount<=0||amount>100000000||!['expense','income','saving','investing'].includes(String(x.type))||!(x.type==='expense'?categories.includes(String(x.category)):x.category===x.type))return bad('Check the transaction details.');
      if(x.id!==undefined){
        if(!Number.isSafeInteger(id)||id<=0)return bad('Invalid transaction.');
        await d.prepare('UPDATE transactions SET date=?,name=?,amount=?,category=?,type=?,demo=0 WHERE id=? AND owner_id=?').bind(x.date,name.slice(0,100),amount,x.category,x.type,id,ownerId).run();
      }else await d.prepare('INSERT INTO transactions(owner_id,date,name,amount,category,type) VALUES (?,?,?,?,?,?)').bind(ownerId,x.date,name.slice(0,100),amount,x.category,x.type).run();
    }else if(x.action==='deleteTransaction'){
      const id=Number(x.id);if(!Number.isSafeInteger(id)||id<=0)return bad('Invalid transaction.');
      await d.prepare('DELETE FROM transactions WHERE id=? AND owner_id=?').bind(id,ownerId).run();
    }else if(x.action==='budget'){
      const amount=Math.round(Number(x.amount)*100);
      if(!categories.includes(String(x.category))||!Number.isSafeInteger(amount)||amount<0||amount>100000000)return bad('Enter a valid budget amount.');
      await d.prepare('INSERT INTO budgets(owner_id,category,amount) VALUES (?,?,?) ON CONFLICT(owner_id,category) DO UPDATE SET amount=excluded.amount,demo=0').bind(ownerId,x.category,amount).run();
    }else if(x.action==='goal'){
      const target=Math.round(Number(x.target)*100),current=Math.round(Number(x.current)*100),id=Number(x.id);
      const name=typeof x.name==='string'?x.name.trim():'';
      if(!name||!['saving','investing'].includes(String(x.type))||!Number.isSafeInteger(target)||target<=0||target>1000000000||!Number.isSafeInteger(current)||current<0||current>1000000000)return bad('Enter valid goal details.');
      if(x.id!==undefined){
        if(!Number.isSafeInteger(id)||id<=0)return bad('Invalid goal.');
        await d.prepare('UPDATE goals SET name=?,type=?,target=?,current=?,demo=0 WHERE id=? AND owner_id=?').bind(name.slice(0,100),x.type,target,current,id,ownerId).run();
      }else await d.prepare('INSERT INTO goals(owner_id,name,type,target,current) VALUES (?,?,?,?,?)').bind(ownerId,name.slice(0,100),x.type,target,current).run();
    }else if(x.action==='deleteGoal'){
      const id=Number(x.id);if(!Number.isSafeInteger(id)||id<=0)return bad('Invalid goal.');
      await d.prepare('DELETE FROM goals WHERE id=? AND owner_id=?').bind(id,ownerId).run();
    }else return bad('Unknown action');
    return NextResponse.json(await snapshot(d,ownerId));
  }catch(e){console.error(e);return bad('Could not save. Your changes were not applied.',503)}
}

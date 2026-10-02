import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
import { loadTS } from './load-ts.mjs';
const owner='owner-a';
function setup(failMetadata=false) {
 const tables={settings:[{owner_id:owner,key:'initialized',value:'personal'},{owner_id:owner,key:'plan:goal-mode:1',value:'linked'}],budgets:[{owner_id:owner,category:'Food',amount:10000}],transactions:[],recurring_items:[],goals:[{owner_id:owner,id:1,name:'Reserve',type:'saving',target:100000,current:500},{owner_id:'owner-b',id:2,name:'Other person',type:'saving',target:100000,current:0}],admin_users:[]};
 let nextId=100;
 const client={auth:{getUser:async()=>({data:{user:{id:owner,email:'test@example.test'}},error:null})},from(table){
  let filters=[],operation='read',payload,options={},single=false,orders=[],range,limit;
  const query={
   select(_columns,opts={}){options=opts;return query;},eq(k,v){filters.push(r=>r[k]===v);return query;},
   gte(k,v){filters.push(r=>r[k]>=v);return query;},lte(k,v){filters.push(r=>r[k]<=v);return query;},lt(k,v){filters.push(r=>r[k]<v);return query;},
   in(k,v){filters.push(r=>v.includes(r[k]));return query;},like(k,v){filters.push(r=>r[k]?.startsWith(v.slice(0,-1)));return query;},
   order(k,o={}){orders.push([k,o.ascending!==false]);return query;},range(a,b){range=[a,b];return query;},limit(n){limit=n;return query;},
   single(){single=true;return query;},maybeSingle(){single=true;return query;},
   insert(row){operation='insert';payload=row;return query;},upsert(row){operation='upsert';payload=row;return query;},
   update(row){operation='update';payload=row;return query;},delete(){operation='delete';return query;},
   then(resolve,reject){return Promise.resolve().then(()=>{
    let found=tables[table].filter(r=>filters.every(f=>f(r)));
    if(operation==='read'||operation==='update'||operation==='delete') assert.ok(found.every(r=>(table==='admin_users'?r.user_id:r.owner_id)===owner),'query leaked another owner');
    if(operation==='insert'||operation==='upsert'){
     const rows=Array.isArray(payload)?payload:[payload];
     if(failMetadata&&rows.some(r=>r.key?.startsWith('plan:tx-goal:'))) return {data:null,error:{message:'Simulated metadata failure'}};
     found=rows.map(row=>{
      assert.equal(row.owner_id,owner);
      const existing=operation==='upsert'?tables[table].find(r=>r.owner_id===row.owner_id&&(table==='settings'?r.key===row.key:r.category===row.category)):null;
      if(existing){Object.assign(existing,row);return existing;}
      const added={...row,...(!['settings','budgets'].includes(table)?{id:nextId++}:{})};tables[table].push(added);return added;
     });
    } else if(operation==='update'){found.forEach(r=>Object.assign(r,payload));}
    else if(operation==='delete'){tables[table]=tables[table].filter(r=>!found.includes(r));}
    const count=found.length;
    for(const [k,ascending]of [...orders].reverse())found.sort((a,b)=>(String(a[k]).localeCompare(String(b[k]),undefined,{numeric:true}))*(ascending?1:-1));
    if(range)found=found.slice(range[0],range[1]+1);if(limit)found=found.slice(0,limit);
    return {data:options.head?null:single?(found[0]??null):found,count,error:null};
   }).then(resolve,reject);},
  };return query;
 }};
 const dependencies={
  '@supabase/supabase-js':{createClient:(_url,key,options)=>{assert.equal(key,'test-key');assert.equal(options.global.headers.Authorization,'Bearer test');return client;}},
  'next/server':{NextResponse:Response},
  ...Object.fromEntries(['request-json','month-review','read-all-pages','budget-planning','goal-tracking'].map(name=>[`@/lib/${name}`,loadTS(`lib/${name}.ts`)])),
 };
 const source=readFileSync(new URL('../app/api/data/supabase.ts',import.meta.url),'utf8');
 const {outputText}=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}});
 const exports={};new Function('require','exports',outputText)(name=>{assert.ok(name in dependencies,name);return dependencies[name];},exports);
 process.env.NEXT_PUBLIC_SUPABASE_URL='https://example.supabase.co';process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY='test-key';
 async function call(body){const response=await exports.handleSupabase(new Request('https://example.test/api/data',{method:body?'POST':'GET',headers:{Authorization:'Bearer test'},...(body?{body:JSON.stringify(body)}:{})}));return {status:response.status,body:await response.json()};}
 return {tables,call};
}
const saving={action:'transaction',name:'Save',type:'saving',category:'saving',date:'2026-09-01',amount:'10.00',goal_id:1};
test('linked transaction lifecycle derives progress and ignores forged owner',async()=>{
 const {call}=setup();
 let result=await call({...saving,owner_id:'owner-b'});assert.equal(result.status,200);assert.equal(result.body.goals[0].current,1500);
 const id=result.body.transactions[0].id;
 result=await call({...saving,id,amount:'5.00'});assert.equal(result.body.goals[0].current,1000);
 result=await call();assert.equal(result.body.goals[0].current,1000);
 result=await call({action:'deleteTransaction',id});assert.equal(result.body.goals[0].current,500);
});
test('foreign or incompatible goal is rejected without inserting a transaction',async()=>{
 const {call,tables}=setup();
 assert.equal((await call({...saving,goal_id:2})).status,400);
 assert.equal((await call({...saving,type:'investing',category:'investing'})).status,400);
 assert.equal(tables.transactions.length,0);
});
test('metadata failure reports the saved transaction, not a retryable failed financial write',async()=>{
 const {call,tables}=setup(true);
 const result=await call(saving);assert.equal(result.status,200);assert.match(result.body.warning,/Transaction saved/);assert.equal(tables.transactions.length,1);assert.equal(result.body.transactions[0].goal_id,null);
});
test('monthly category plans preserve the legacy base and reject malformed inputs',async()=>{
 const {call,tables}=setup();
 let result=await call({action:'budget',category:'Food',amount:'200',month:'2026-10',rollover:'unused',owner_id:'owner-b'});
 assert.equal(result.status,200);assert.equal(result.body.budgetPlans[0].amount,20000);assert.equal(tables.budgets[0].amount,10000);
 assert.equal((await call({action:'budget',category:'Food',amount:'200',month:'2026-13',rollover:'unused'})).status,400);
 assert.equal((await call({action:'budget',category:'Food',amount:'200',month:'2026-10',rollover:'invalid'})).status,400);
 result=await call({action:'resetBudget',month:'2026-11'});assert.equal(result.status,200);assert.ok(result.body.budgetPlans.filter(x=>x.month==='2026-11').every(x=>x.reset&&x.amount===0));
});
test('existing manual goals remain manual and goal type cannot be rewritten',async()=>{
 const {call}=setup();
 const result=await call({action:'goal',id:1,name:'Reserve',type:'saving',target:'1000',current:'25',tracking:'manual'});
 assert.equal(result.status,200);assert.equal(result.body.goals[0].current,2500);assert.equal(result.body.goals[0].tracking,'manual');
 assert.equal((await call({action:'goal',id:1,name:'Reserve',type:'investing',target:'1000',current:'25',tracking:'linked'})).status,400);
});

test('recurring goal changes apply after posted history and preserve links when the rule is deleted',async()=>{
 const {call,tables}=setup();
 const month=new Date().toISOString().slice(0,7);
 const [year,number]=month.split('-').map(Number);const next=new Date(Date.UTC(year,number,1)).toISOString().slice(0,7);
 tables.recurring_items.push({owner_id:owner,id:8,name:'Monthly saving',type:'saving',amount:1000,category:'saving',frequency:'monthly',day_of_month:1,start_date:month+'-01',active:false,end_type:'never',end_date:null,max_occurrences:null,ended_at:null});
 tables.transactions.push({owner_id:owner,id:9,date:month+'-01',name:'Old saving',type:'saving',category:'saving',amount:1000,recurring_item_id:8});
 let result=await call({action:'recurring',id:8,name:'Monthly saving',type:'saving',category:'saving',amount:'10',start_date:month+'-01',day_of_month:1,active:false,end_type:'never',goal_id:1});
 assert.equal(result.status,200);assert.equal(result.body.recurring[0].goal_effective_month,next);assert.equal(result.body.transactions[0].goal_id,null);
 // Simulate a posted occurrence with an earlier configured goal, then delete the rule.
 tables.settings.push({owner_id:owner,key:`plan:recurring-goal:8:${month}`,value:'1'});
 result=await call({action:'deleteRecurring',id:8});assert.equal(result.status,200);
 assert.ok(tables.settings.some(r=>r.key==='plan:tx-goal:9'&&r.value==='1'));
});

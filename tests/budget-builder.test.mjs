import assert from 'node:assert/strict';
import test from 'node:test';
import { loadTS } from './load-ts.mjs';
const {dollarsToCents,suggestBudget,recurringFloor,plannedValue,validBuilderPayload}=loadTS('lib/budget-builder.ts');
const rows=[{category:'Housing',group:'needs',amount:50000,fixed:0},{category:'Food',group:'needs',amount:50000,fixed:0},{category:'Fun',group:'wants',amount:10000,fixed:0},{category:'Investing',group:'future',amount:0,fixed:0}];
const total=plan=>plan.rows.reduce((n,r)=>n+r.amount,plan.saving);
test('balanced and savings templates distribute exact cents and leave investing counted once',()=>{
 for(const [template,fraction] of [['balanced',20],['saving',30]]){
  const plan=suggestBudget(300001,template,rows,0);
  assert.equal(total(plan),300001);assert.equal(plan.saving,Math.floor(300001*fraction/100));
  assert.equal(plan.rows[3].amount,0);assert.ok(plan.rows.every(r=>Number.isSafeInteger(r.amount)));
 }
 const plan=suggestBudget(300000,'balanced',rows.map(r=>r.category==='Investing'?{...r,fixed:30000}:r),10000);
 assert.equal(plan.saving,30000);assert.equal(plan.rows[3].amount,30000);assert.equal(total(plan),300000);
});
test('high essential costs reduce flexible extras without inventing a deficit',()=>{
 const plan=suggestBudget(300000,'balanced',rows.map(r=>r.category==='Housing'?{...r,fixed:195000}:r),0);
 assert.equal(total(plan),300000);assert.equal(plan.rows[0].amount,195000);assert.equal(plan.rows[2].amount,45000);assert.equal(plan.saving,60000);
});
test('unaffordable commitments stay intact and zero income never creates percentages or NaN',()=>{
 const fixed=rows.map(r=>({...r,fixed:100000}));
 const plan=suggestBudget(200000,'balanced',fixed,50000);
 assert.equal(total(plan),450000);assert.ok(plan.rows.every(r=>r.amount===100000));
 assert.equal(total(suggestBudget(0,'saving',rows,0)),0);
});
test('custom keeps limits and essentials assigns only confirmed commitments',()=>{
 assert.deepEqual(suggestBudget(300000,'custom',rows,15000).rows,rows);
 assert.equal(total(suggestBudget(300000,'essentials',rows,15000)),15000);
 assert.deepEqual(rows.map(r=>r.amount),[50000,50000,10000,0]);
});
test('missing expense buckets remain unallocated, not silently assigned elsewhere',()=>{
 const plan=suggestBudget(300000,'balanced',rows.filter(r=>r.group!=='needs'),0);
 assert.equal(total(plan),150000);
});
test('strict dollars parsing rejects invalid values without rounding cents',()=>{
 for(const value of ['', '-1','1.234','1e3','Infinity','NaN','1000000.01'])assert.equal(dollarsToCents(value),null,value);
 assert.equal(dollarsToCents('0'),0);assert.equal(dollarsToCents('12.01'),1201);assert.equal(dollarsToCents('1000000'),100000000);
});
test('effective income and saving preserve earlier and later plans and ignore malformed stored data',()=>{
 const data=[{key:'plan:income:2026-10',value:'300000'},{key:'plan:income:2026-12',value:'400000'},{key:'plan:saving:2026-10',value:'50000'},{key:'plan:income:2026-11',value:'NaN'},{key:'plan:income:2026-13',value:'500000'}];
 assert.equal(plannedValue(data,'income','2026-09',200000),200000);
 assert.equal(plannedValue(data,'income','2026-11'),300000);assert.equal(plannedValue(data,'income','2026-12'),400000);
 assert.equal(plannedValue(data,'saving','2026-11'),50000);
 assert.equal(plannedValue([...data,{key:'plan:saving:2026-11',value:'0'}],'saving','2026-12'),0);
});
test('recurring suggestions combine posted and pending payments once and respect lifecycle',()=>{
 const recurring=[{id:1,name:'Rent',amount:100000,category:'Housing',type:'expense',day_of_month:1,start_date:'2026-01-01',active:true,end_type:'never',end_date:null,max_occurrences:null},
 {id:2,name:'Food',amount:20000,category:'Food',type:'expense',day_of_month:15,start_date:'2026-01-15',active:true,end_type:'count',end_date:null,max_occurrences:2},
 {id:3,name:'Paused',amount:9999,category:'Housing',type:'expense',day_of_month:1,start_date:'2026-01-01',active:false,end_type:'never',end_date:null,max_occurrences:null}];
 const tx=[{id:1,date:'2026-10-01',amount:90000,category:'Housing',type:'expense',recurring_item_id:1},{id:2,date:'2026-10-01',amount:10000,category:'saving',type:'saving',recurring_item_id:4},{id:3,date:'2026-10-01',amount:100,category:'__saving',type:'expense',recurring_item_id:5}];
 const result=recurringFloor('2026-10','2026-10',recurring,tx);
 assert.equal(result.categories.Housing,90000);assert.equal(result.categories.Food,20000);assert.equal(result.saving,10000);assert.equal(result.categories.__saving,100);
 assert.equal(recurringFloor('2026-12','2026-10',recurring,tx).categories.Food,undefined);
 assert.equal(recurringFloor('2026-09','2026-10',recurring,tx).categories.Housing,undefined);
});
test('API payload validates integer cents, bounded row counts, duplicate categories and calendar months',()=>{
 const payload={month:'2026-10',income:300000,saving:60000,rows:[{category:'Food',amount:10000}]};
 assert.equal(validBuilderPayload(payload),true);
 for(const patch of [{income:'3000'},{saving:-1},{saving:1.1},{month:'2026-13'},{rows:[]},{rows:[...payload.rows,...payload.rows]},{rows:[{category:'Food',amount:Infinity}]}])assert.equal(validBuilderPayload({...payload,...patch}),false);
});

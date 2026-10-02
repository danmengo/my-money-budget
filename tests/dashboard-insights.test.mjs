import assert from 'node:assert/strict';
import test from 'node:test';
import { loadTS } from './load-ts.mjs';
const { dashboardInsights, scheduledPayments, dateForMonth, daysBetween } = loadTS('lib/dashboard-insights.ts');
const rule = (id, extra={}) => ({id,name:'Bill',amount:10000,category:'Bills',type:'expense',day_of_month:15,start_date:'2026-01-15',active:true,end_type:'never',end_date:null,max_occurrences:null,...extra});
const tx = (date,type,amount,extra={}) => ({date,type,amount,category:type,name:'Entry',...extra});
test('upcoming respects posted, paused, start/end dates, finite counts and month-end clamping',()=>{
 const result=scheduledPayments([rule(1),rule(2,{active:false}),rule(3,{start_date:'2026-11-15'}),rule(4,{end_type:'date',end_date:'2026-09-15'}),rule(5,{end_type:'count',max_occurrences:1}),rule(6,{day_of_month:31})],[tx('2026-10-15','expense',10000,{recurring_item_id:1}),tx('2026-09-15','expense',10000,{recurring_item_id:5})],'2026-10','2026-10');
 assert.deepEqual(result.map(x=>x.id),[6]);
 assert.equal(dateForMonth('2028-02',31),'2028-02-29');
 assert.equal(dateForMonth('2027-02',31),'2027-02-28');
 assert.equal(daysBetween('2026-12-31','2027-01-01'),1);
});
test('finite future forecast counts projected payments once',()=>{
 assert.deepEqual(scheduledPayments([rule(1,{end_type:'count',max_occurrences:2})],[],'2026-10','2027-01').map(x=>x.dueDate),['2026-10-15','2026-11-15']);
});
test('safe to spend excludes future income and reserves future transactions without double counting',()=>{
 const transactions=[tx('2026-10-01','income',100000),tx('2026-10-02','expense',10000),tx('2026-10-20','income',900000),tx('2026-10-15','expense',20000,{recurring_item_id:2})];
 const result=dashboardInsights('2026-10','2026-10-03',transactions,[rule(1),rule(2,{amount:20000}),rule(3,{type:'saving',amount:5000})],[],2000,0);
 assert.equal(result.cash,92000); assert.equal(result.remainingExpenses,10000);assert.equal(result.futureOutflows,20000);assert.equal(result.safeToSpend,57000);
});
test('shortfall floors spendable at zero; historical months do not show a current cash estimate',()=>{
 const result=dashboardInsights('2026-10','2026-10-03',[],[rule(1)],[],0,0);
 assert.equal(result.safeToSpend,0);assert.equal(result.shortfall,10000);
 assert.equal(dashboardInsights('2026-09','2026-10-03',[],[],[],0,0).safeToSpend,null);
});
test('seven-day window crosses month boundaries',()=>{
 const result=dashboardInsights('2026-10','2026-10-29',[],[rule(1,{day_of_month:2}),rule(2,{day_of_month:10})],[ ],0,0);
 assert.ok(result.upcoming.some(x=>x.dueDate==='2026-11-02'));
 assert.ok(!result.upcoming.some(x=>x.dueDate==='2026-11-10'));
});

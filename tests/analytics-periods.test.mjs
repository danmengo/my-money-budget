import test from 'node:test';
import assert from 'node:assert/strict';
import {loadTS} from './load-ts.mjs';
const {presetRange,validateRange,periodTotals,monthlyComparison,metricChange,allocationRates}=loadTS('lib/analytics-periods.ts');
const {historicalAnalytics}=loadTS('lib/historical-analytics.ts');
const tx=(date,type,amount,extra={})=>({date,type,amount,name:'Entry',category:'Food',...extra});
const range={start:'2026-10-01',end:'2026-10-31'};
test('presets use local date input, completed last month and calendar recent months',()=>{
 assert.deepEqual(presetRange('this-month','2025-09','2026-01-02'),{start:'2026-01-01',end:'2026-01-02'});
 assert.deepEqual(presetRange('last-month','2025-09','2026-01-02'),{start:'2025-12-01',end:'2025-12-31'});
 assert.deepEqual(presetRange('last-3','2025-09','2026-01-02'),{start:'2025-11-01',end:'2026-01-02'});
 assert.deepEqual(presetRange('last-6','2025-09','2026-01-02'),{start:'2025-08-01',end:'2026-01-02'});
 assert.deepEqual(presetRange('ytd','2025-09','2026-01-02'),{start:'2026-01-01',end:'2026-01-02'});
 assert.deepEqual(presetRange('selected','2028-02','2026-01-02'),{start:'2028-02-01',end:'2028-02-29'});
});
test('custom validation rejects impossible, reversed and excessive ranges',()=>{
 for(const r of [{start:'2026-02-29',end:'2026-03-01'},{start:'2026-04-31',end:'2026-05-01'},{start:'',end:'2026-01-01'},{start:'2026-02-01',end:'2026-01-01'},{start:'2016-01-01',end:'2026-01-01'}])assert.ok(validateRange(r));
 assert.equal(validateRange({start:'2028-02-29',end:'2028-02-29'}),'');
 assert.equal(validateRange({start:'2016-01-01',end:'2025-12-31'}),'');
});
test('inclusive boundaries and partial-month history agree with exact period totals',()=>{
 const r={start:'2026-09-15',end:'2026-10-02'};
 const transactions=[tx('2026-09-14','income',999),tx('2026-09-15','income',10001),tx('2026-10-02','expense',3456),tx('2026-10-03','expense',999)];
 const totals=periodTotals(transactions,r);assert.equal(totals.net,6545);assert.equal(totals.count,2);
 const rows=historicalAnalytics(transactions,'2026-10',undefined,r);assert.equal(rows.length,2);assert.equal(rows.reduce((s,row)=>s+row.net,0),totals.net);
});
test('through-today presets exclude later entries while selected month keeps them',()=>{
 const transactions=[tx('2026-10-01','income',10000),tx('2026-10-31','income',50000)];
 assert.equal(periodTotals(transactions,presetRange('this-month','2026-10','2026-10-02')).income,10000);
 assert.equal(periodTotals(transactions,presetRange('selected','2026-10','2026-10-02')).income,60000);
});
test('current comparison uses same elapsed days, excluding later entries',()=>{
 const rows=[tx('2026-10-02','income',2000),tx('2026-10-03','income',9000),tx('2026-09-02','income',1000),tx('2026-09-03','income',8000)];
 const result=monthlyComparison(rows,'2026-10','2026-10-02');
 assert.equal(result.current.income,2000);assert.equal(result.previous.income,1000);assert.equal(result.previousRange.end,'2026-09-02');
 assert.deepEqual(metricChange(result.current.income,result.previous.income),{amount:1000,percent:100});
});
test('completed comparison covers full months, year transitions and February clamping',()=>{
 assert.equal(monthlyComparison([],'2026-01','2026-10-02').previousRange.start,'2025-12-01');
 assert.equal(monthlyComparison([],'2026-01','2026-10-02').currentRange.end,'2026-01-31');
 assert.equal(monthlyComparison([],'2028-03','2028-03-31').previousRange.end,'2028-02-29');
 assert.equal(monthlyComparison([],'2027-03','2027-03-31').previousRange.end,'2027-02-28');
 assert.equal(monthlyComparison([],'2026-11','2026-10-02'),null);
});
test('zero and negative comparison baselines have no misleading percent change',()=>{
 assert.deepEqual(metricChange(1000,0),{amount:1000,percent:null});assert.deepEqual(metricChange(1000,-1000),{amount:2000,percent:null});assert.deepEqual(metricChange(-1000,1000),{amount:-2000,percent:-200});
});
test('comparison applies the same combined filters to both periods',()=>{
 const rows=[tx('2026-10-01','expense',100,{recurring_item_id:1}),tx('2026-09-01','expense',200,{recurring_item_id:1}),tx('2026-09-01','expense',999)];
 const result=monthlyComparison(rows,'2026-10','2026-10-02',{type:'expense',category:'Food',source:'Recurring'});
 assert.equal(result.current.spent,100);assert.equal(result.previous.spent,200);
});
test('allocation rates use contribution totals divided by income and preserve cents',()=>{
 const result=allocationRates([tx('2026-10-01','income',10000),tx('2026-10-02','saving',1501),tx('2026-10-03','investing',1000),tx('2026-10-04','expense',3000)],range);
 assert.ok(Math.abs(result.savingRate-15.01)<1e-10);assert.equal(result.investingRate,10);assert.ok(Math.abs(result.combinedRate-25.01)<1e-10);assert.equal(result.net,4499);
});
test('rates have no denominator for empty or zero-income periods',()=>{
 assert.equal(allocationRates([],range).combinedRate,null);
 const result=allocationRates([tx('2026-10-01','saving',123)],range);assert.equal(result.savingRate,null);assert.equal(result.saved,123);assert.equal(result.net,-123);
});
test('over-100 rates and deficits are not clamped or silently called surplus',()=>{
 const result=allocationRates([tx('2026-10-01','income',100),tx('2026-10-02','saving',200),tx('2026-10-02','investing',50)],range);
 assert.equal(result.combinedRate,250);assert.equal(result.net,-150);
});
test('range rates are weighted from totals, exclude earlier activity, and recalculate after corrections',()=>{
 const rows=[tx('2026-09-01','income',10000),tx('2026-09-01','saving',1000),tx('2026-10-01','income',1000),tx('2026-10-01','saving',500),tx('2026-08-01','saving',9999)];
 const r={start:'2026-09-01',end:'2026-10-31'};
 assert.ok(Math.abs(allocationRates(rows,r).savingRate-1500/11000*100)<1e-10);
 assert.equal(allocationRates(rows.filter(x=>x.type!=='saving'),r).savingRate,0);
});

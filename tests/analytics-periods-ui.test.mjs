import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { loadTS } from './load-ts.mjs';
const Rates=loadTS('app/analytics-rates.tsx').default;
const Comparison=loadTS('app/analytics-comparison.tsx').default;
const Controls=loadTS('app/analytics-range-controls.tsx').default;
const View=loadTS('app/analytics-view.tsx').default;
const History=loadTS('app/historical-analytics.tsx').default;
const range={start:'2026-10-01',end:'2026-10-31'};
const filters={type:'All',category:'All',source:'All'};
const tx=(date,type,amount)=>({date,type,amount,name:'Entry',category:'Food'});
const render=(Component,props)=>renderToStaticMarkup(React.createElement(Component,props));
test('rates explain missing income, over-allocation and deficit without invalid numbers',()=>{
 const empty=render(Rates,{transactions:[],range});assert.ok(empty.includes('No transactions recorded'));assert.ok(!/NaN|Infinity/.test(empty));
 const missing=render(Rates,{transactions:[tx('2026-10-01','saving',123)],range});assert.ok(missing.includes('unavailable without positive recorded income'));assert.ok(missing.includes('$1.23'));
 const high=render(Rates,{transactions:[tx('2026-10-01','income',100),tx('2026-10-02','saving',200)],range});
 for(const text of ['200.0%','Rates above 100%','outflows exceed income','activity filters do not apply','not investment returns'])assert.ok(high.includes(text),text);
});
test('comparison renders exact ranges, changes and honest missing-period state',()=>{
 const props={month:'2026-10',today:'2026-10-02',filters};
 const html=render(Comparison,{...props,transactions:[tx('2026-10-02','income',2000),tx('2026-09-02','income',1000)]});
 for(const text of ['2026-10-01','2026-10-02','2026-09-02','+$10.00','+100.0%','scope="col"'])assert.ok(html.includes(text),text);
 assert.ok(render(Comparison,{...props,transactions:[]}).includes('Previous period has no matching entries'));
 assert.ok(render(Comparison,{...props,month:'2026-11',transactions:[]}).includes('current and completed months'));
});
test('custom controls retain applied range and expose labeled input boundaries',()=>{
 const html=render(Controls,{month:'2026-10',today:'2026-10-02',range,preset:'custom',onApply(){}});
 for(const text of ['Applied:','Start date','End date','Apply dates','type="date"','120 calendar months'])assert.ok(html.includes(text),text);
});
test('custom history renders only selected months and marks partial month',()=>{
 const html=render(History,{transactions:[],month:'2026-10',currentMonth:'2026-10',filters,onMonth(){},range:{start:'2026-09-15',end:'2026-10-02'}});
 assert.equal((html.match(/class="history-month"/g)||[]).length,2);assert.ok(html.includes('Partial month'));assert.ok(!html.includes('Older months'));
});
test('integrated analytics preserves monthly carry while rates ignore the expense filter',()=>{
 const html=render(View,{transactions:[tx('2026-10-01','income',10000),tx('2026-10-01','saving',2000),tx('2026-10-02','expense',3000)],categories:['Food'],month:'2026-10',today:'2026-10-02',filters:{...filters,type:'expense'},onFilters(){},categoryColor(){return '#11685f'},carryIn:5000,carryOut:0,monthResult:10000,onAllocate(){},onMonth(){}});
 for(const text of ['20.0%','Carried in (not income)','$50.00','Full selected month','Filtered net activity','Saving &amp; investing rates','Monthly comparison'])assert.ok(html.includes(text),text);
});

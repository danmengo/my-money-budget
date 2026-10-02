import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { loadTS } from './load-ts.mjs';
const Insights=loadTS('app/dashboard-insights.tsx').default;
const GoalSelect=loadTS('app/goal-select.tsx').default;
const props={month:'2026-10',today:'2026-10-01',transactions:[],recurring:[],budgets:[],carryIn:0,carryOut:0,onRecurring(){},onBudget(){}};
test('dashboard renders calculation, empty upcoming state and accessible progress',()=>{
 const html=renderToStaticMarkup(React.createElement(Insights,props));
 for(const text of ['Safe to spend','Budget health','No unposted recurring payments','Month progress','Planned and future income are excluded'])assert.ok(html.includes(text),text);
});
test('dashboard renders shortfall and due-soon amounts',()=>{
 const html=renderToStaticMarkup(React.createElement(Insights,{...props,recurring:[{id:1,name:'Rent',amount:100000,category:'Housing',type:'expense',day_of_month:2,start_date:'2026-01-02',active:true,end_type:'never',end_date:null,max_occurrences:null}]}));
 assert.ok(html.includes('Rent'));assert.ok(html.includes('Due in 1 day'));assert.ok(html.includes('$1,000.00'));assert.ok(html.includes('short of these commitments'));
});
test('goal selector appears only for savings/investing and handles no matching goals',()=>{
 assert.equal(renderToStaticMarkup(React.createElement(GoalSelect,{type:'expense',value:'none',goals:[],onChange(){}})),'');
 const html=renderToStaticMarkup(React.createElement(GoalSelect,{type:'saving',value:'none',goals:[],onChange(){}}));
 assert.ok(html.includes('Goal (optional)'));assert.ok(html.includes('Create a saving goal'));
});

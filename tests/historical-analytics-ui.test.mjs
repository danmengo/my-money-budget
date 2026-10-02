import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { loadTS } from './load-ts.mjs';
const History = loadTS('app/historical-analytics.tsx').default;
const props = {transactions:[],month:'2026-10',currentMonth:'2026-10',filters:{type:'All',category:'All',source:'All'},onMonth(){}};
const render = extra => renderToStaticMarkup(React.createElement(History,{...props,...extra}));
test('accessible empty history, month controls and accounting explanation',()=>{
 const html=render({});
 for(const text of ['Monthly history','No transactions recorded in this period','In progress','Cash carry and category rollover are excluded','scope="col"','View Sep 2026 analytics','not verified zero activity']) assert.ok(html.includes(text),text);
 assert.match(html,/ disabled=""[^>]*>Newer months/);
 assert.equal((html.match(/class="history-month"/g)||[]).length,12);
});
test('real table renders exact negative net and distinguishes filtered emptiness',()=>{
 const transactions=[{date:'2026-09-01',name:'Food',type:'expense',category:'Food',amount:12345}];
 const html=render({transactions});assert.ok(html.includes('-$123.45'));assert.ok(html.includes('1 matching entry'));
 const filtered=render({transactions,filters:{...props.filters,type:'income'}});
 assert.ok(filtered.includes('No transactions match these filters'));assert.ok(filtered.includes('No matching entries'));assert.ok(filtered.includes('Filtered net'));assert.ok(!filtered.includes('$123.45'));
});
test('future selected months clamp history to current month; historical navigation stays available',()=>{
 assert.ok(!render({month:'2027-01'}).includes('View Jan 2027 analytics'));
 const html=render({month:'2025-10'});assert.ok(html.includes('Nov 2024'));assert.ok(!/ disabled=""[^>]*>Newer months/.test(html));
});

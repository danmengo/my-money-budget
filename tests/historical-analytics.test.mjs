import assert from 'node:assert/strict';
import test from 'node:test';
import { loadTS } from './load-ts.mjs';
const { historicalAnalytics, ALL_ANALYTICS } = loadTS('lib/historical-analytics.ts');
const tx = (date, type, amount, extra = {}) => ({ date, type, amount, name: 'Entry', category: 'Food', ...extra });

test('twelve ordered calendar months cross years and preserve empty gaps', () => {
  const rows = historicalAnalytics([tx('2025-10-31','income',999),tx('2026-11-01','income',999)], '2026-10');
  assert.equal(rows.length,12); assert.equal(rows[0].month,'2025-11'); assert.equal(rows[11].month,'2026-10');
  assert.ok(rows.every(row => row.count === 0 && row.net === 0));
  assert.deepEqual(historicalAnalytics([], 'invalid'), []);
});
test('integer cents, zero income, deficits, and four transaction types', () => {
  const rows = historicalAnalytics([tx('2026-09-01','income',10001), tx('2026-09-02','expense',2002),tx('2026-09-03','saving',3003),tx('2026-09-04','investing',4004),tx('2026-10-01','expense',123)],'2026-10');
  assert.deepEqual(rows[10],{month:'2026-09',income:10001,spent:2002,saved:3003,invested:4004,net:992,count:4,recordedCount:4});
  assert.equal(rows[11].net,-123); assert.equal(rows[11].income,0);
});
test('combined category, type and recurring filters use posted amounts only', () => {
  const items = [tx('2026-10-01','expense',201,{recurring_item_id:1}),tx('2026-10-02','expense',300),tx('2026-10-03','income',900,{recurring_item_id:2}),tx('2026-10-04','expense',500,{category:'Housing',recurring_item_id:3})];
  const row = historicalAnalytics(items,'2026-10',{type:'expense',category:'Food',source:'Recurring'}).at(-1);
  assert.equal(row.net,-201); assert.equal(row.count,1); assert.equal(row.recordedCount,4);
  assert.equal(historicalAnalytics(items,'2026-10',{...ALL_ANALYTICS,source:'One-time'}).at(-1).spent,300);
  assert.equal(historicalAnalytics(items,'2026-10',{...ALL_ANALYTICS,category:'Removed category'}).at(-1).count,0);
});
test('edits and deletions recalculate without changing inputs or carrying cash', () => {
  const items = [tx('2026-09-01','income',10000),tx('2026-09-02','saving',3000)];
  const before = JSON.stringify(items);
  let rows = historicalAnalytics(items,'2026-10');
  assert.equal(rows[10].net,7000); assert.equal(rows[11].income,0); assert.equal(rows[11].net,0);
  assert.equal(JSON.stringify(items),before);
  rows = historicalAnalytics([{...items[0],amount:5000}],'2026-10'); assert.equal(rows[10].net,5000);
});
test('all supplied records beyond 1000, leap day, and entered future dates are included', () => {
  const items = Array.from({length:1501},()=>tx('2028-02-29','expense',1));
  items.push(tx('2028-02-28','income',2000));
  const row=historicalAnalytics(items,'2028-02').at(-1);
  assert.equal(row.count,1502); assert.equal(row.net,499);
});

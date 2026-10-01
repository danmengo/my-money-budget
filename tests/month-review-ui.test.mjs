import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync, existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ts from 'typescript';

const root = path.resolve(import.meta.dirname, '..');
const require = createRequire(import.meta.url);
const loaded = new Map();
// Render the real component and its real UI primitives; only compile TS/TSX.
function load(file) {
  const sourcePath = ['', '.ts', '.tsx'].map(ext => file + ext).find(candidate => existsSync(candidate));
  assert.ok(sourcePath, `Missing module ${file}`);
  if (loaded.has(sourcePath)) return loaded.get(sourcePath);
  const { outputText } = ts.transpileModule(readFileSync(sourcePath, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
  });
  const exports = {};
  loaded.set(sourcePath, exports);
  new Function('require', 'exports', outputText)(name => {
    if (name.startsWith('@/')) return load(path.join(root, name.slice(2)));
    if (name.startsWith('.')) return load(path.resolve(path.dirname(sourcePath), name));
    return require(name);
  }, exports);
  return exports;
}
const MonthEndReview = load(path.join(root, 'app/month-end-review.tsx')).default;
const props = {
  month: '2026-09', currentMonth: '2026-10', transactions: [], budgets: [],
  carryIn: 0, carryOut: 0, busy: false,
  onChoice: async () => true, onAllocate() {}, onNextBudget() {},
};

test('completed review renders every action and honest empty states', () => {
  const html = renderToStaticMarkup(React.createElement(MonthEndReview, props));
  for (const text of ['Total income', 'Total spent', 'Total saved', 'Total invested', 'No transactions recorded',
    'Move surplus to savings', 'Move surplus to investing', 'Carry surplus forward', 'Leave unallocated',
    'October 2026', 'Historical limits are not stored yet']) assert.ok(html.includes(text), text);
  assert.match(html, /disabled[^>]*>Move surplus to savings/);
});

test('current month preview has no closeout actions', () => {
  const html = renderToStaticMarkup(React.createElement(MonthEndReview, { ...props, month: '2026-10' }));
  assert.ok(html.includes('Month in progress'));
  assert.ok(!html.includes('Move surplus to savings'));
  assert.ok(!html.includes('Carry surplus forward</button>'));
});

test('recorded activity and carry remain separately visible', () => {
  const html = renderToStaticMarkup(React.createElement(MonthEndReview, {
    ...props, choice: 'carry', carryIn: 20000, carryOut: 100000,
    transactions: [
      { date: '2026-09-01', name: 'Paycheck', type: 'income', category: 'income', amount: 100000 },
      { date: '2026-09-02', name: 'Phone bill', type: 'expense', category: 'Utilities', amount: 20000, recurring_item_id: 1 },
    ], budgets: [{ category: 'Utilities', amount: 15000 }],
  }));
  for (const text of ['$1,000.00', '$800.00', '$200.00', '$50.00', 'Phone bill', 'Undo carry-forward', 'Saved choice:']) assert.ok(html.includes(text), text);
});

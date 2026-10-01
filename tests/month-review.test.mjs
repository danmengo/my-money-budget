import assert from 'node:assert/strict';
import test from 'node:test';
import { buildMonthReview, monthBalances, parseMonthReviews, shiftMonth, validMonth } from '../lib/month-review.ts';
import { readAllPages } from '../lib/read-all-pages.ts';

const tx = (date, type, amount, extra = {}) => ({ date, type, amount, category: type === 'expense' ? 'Food' : type, name: 'Test entry', ...extra });

test('review uses actual cents, selected month, all four types and legacy categories', () => {
  const review = buildMonthReview('2026-09', [
    tx('2026-09-01', 'income', 500001), tx('2026-09-02', 'expense', 100001),
    tx('2026-09-03', 'saving', 50000), tx('2026-09-04', 'investing', 75000),
    tx('2026-09-05', 'expense', 120000, { category: 'Legacy category' }),
    tx('2026-10-01', 'income', 999999),
  ], [{ category: 'Food', amount: 100000 }]);
  assert.deepEqual([review.income, review.spent, review.saved, review.invested, review.surplus], [500001, 220001, 50000, 75000, 155000]);
  assert.equal(review.count, 5);
  assert.equal(review.topCategory.category, 'Legacy category');
  assert.deepEqual(review.overBudget.map(x => [x.category, x.amount - x.limit]), [['Food', 1]]);
});

test('recurring highlights group posted expenses, exclude other types and other months', () => {
  const review = buildMonthReview('2026-09', [
    tx('2026-09-01', 'expense', 1000, { name: 'Service', recurring_item_id: 7 }),
    tx('2026-09-02', 'expense', 2000, { name: 'Service', recurring_item_id: 7 }),
    tx('2026-09-03', 'income', 500000, { recurring_item_id: 8 }),
    tx('2026-10-01', 'expense', 999999, { recurring_item_id: 9 }),
  ], []);
  assert.deepEqual(review.recurring, [{ id: 7, name: 'Service', amount: 3000 }]);
});

test('empty month is zero, deficit stays negative and exact-limit spending is not over budget', () => {
  assert.equal(buildMonthReview('2026-09', [], []).surplus, 0);
  const review = buildMonthReview('2026-09', [tx('2026-09-01', 'expense', 123)], [{ category: 'Food', amount: 123 }]);
  assert.equal(review.surplus, -123);
  assert.deepEqual(review.overBudget, []);
});

test('carry chains across year boundaries without increasing earned income', () => {
  const transactions = [tx('2025-12-01', 'income', 10000), tx('2026-01-01', 'expense', 4000)];
  const balances = monthBalances(transactions, { '2025-12': 'carry', '2026-01': 'carry' }, '2026-02');
  assert.deepEqual(balances.incoming, { '2026-01': 10000, '2026-02': 6000 });
  assert.equal(balances.cashFlow['2026-01'], -4000);
  assert.equal(buildMonthReview('2026-01', transactions, []).income, 0);
  assert.equal(shiftMonth('2026-01', -1), '2025-12');
});

test('edits, undo, and deficits recompute carry without a stale balance', () => {
  const reviews = { '2026-08': 'carry', '2026-09': 'carry' };
  const transactions = [tx('2026-08-01', 'income', 10000), tx('2026-09-01', 'expense', 6000)];
  assert.equal(monthBalances(transactions, reviews, '2026-10').incoming['2026-10'], 4000);
  transactions.push(tx('2026-08-02', 'saving', 8000));
  assert.equal(monthBalances(transactions, reviews, '2026-10').incoming['2026-10'], 0);
  assert.equal(monthBalances(transactions, { ...reviews, '2026-08': 'unallocated' }, '2026-10').incoming['2026-09'], undefined);
});

test('unallocated choices stop a chain; present and future preferences cannot carry early', () => {
  const balances = monthBalances([tx('2026-09-01', 'income', 20000), tx('2026-10-01', 'income', 10000)],
    { '2026-09': 'unallocated', '2026-10': 'carry', '2026-11': 'carry' }, '2026-10');
  assert.deepEqual(balances.incoming, {});
  assert.deepEqual(balances.outgoing, {});
});

test('review settings ignore malformed keys, months and values', () => {
  assert.deepEqual(parseMonthReviews([
    { key: 'month_review:2026-09', value: 'carry' },
    { key: 'month_review:2026-13', value: 'carry' },
    { key: 'month_review:2026-08', value: 'invalid' },
    { key: 'monthly_income', value: 'carry' },
  ]), { '2026-09': 'carry' });
  for (const value of [null, 123, '2026-00', '2026-13', '2026-1', '2026-10-01']) assert.equal(validMonth(value), false);
});

test('financial reads include transactions beyond Supabase first page and fail closed on errors', async () => {
  const records = Array.from({ length: 1251 }, (_, id) => ({ id }));
  const pages = [];
  const result = await readAllPages(async (from, to) => {
    pages.push([from, to]);
    return { data: records.slice(from, to + 1), error: null };
  });
  assert.deepEqual(result.data, records);
  assert.equal(pages.length, 3);
  await assert.rejects(readAllPages(async () => ({ data: null, error: new Error('Failed page') })), /Failed page/);
});


test('over-budget review matches Investing limits and excludes unset limits', () => {
  const review = buildMonthReview('2026-09', [tx('2026-09-01', 'investing', 20000), tx('2026-09-02', 'expense', 10000)],
    [{ category: 'Investing', amount: 10000 }, { category: 'Food', amount: 0 }]);
  assert.deepEqual(review.overBudget, [{ category: 'Investing', amount: 20000, limit: 10000 }]);
});

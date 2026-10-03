import { shiftMonth, validMonth, type ReviewTransaction } from './month-review';

export type AnalyticsFilters = { type: string; category: string; source: string };
export const ALL_ANALYTICS: AnalyticsFilters = { type: 'All', category: 'All', source: 'All' };

export function matchesAnalytics(transaction: ReviewTransaction, filters: AnalyticsFilters) {
  return (filters.type === 'All' || transaction.type === filters.type) &&
    (filters.category === 'All' || transaction.category === filters.category) &&
    (filters.source === 'All' || (filters.source === 'Recurring'
      ? transaction.recurring_item_id != null : transaction.recurring_item_id == null));
}

// Read-only aggregation of the authenticated user's recorded transactions.
// Carry, category allowances, planned income and unposted schedules are not inputs.
export function historicalAnalytics(transactions: ReviewTransaction[], endMonth: string, filters = ALL_ANALYTICS, range?: { start: string; end: string }) {
  if (!validMonth(endMonth)) return [];
  const startMonth = range?.start.slice(0, 7) ?? shiftMonth(endMonth, -11);
  const lastMonth = range?.end.slice(0, 7) ?? endMonth;
  if (!validMonth(startMonth) || !validMonth(lastMonth) || startMonth > lastMonth) return [];
  const [sy, sm] = startMonth.split('-').map(Number);
  const [ey, em] = lastMonth.split('-').map(Number);
  const length = (ey - sy) * 12 + em - sm + 1;
  if (length > 120) return [];
  const rows = Array.from({ length }, (_, index) => ({
    month: shiftMonth(startMonth, index), income: 0, spent: 0, saved: 0,
    invested: 0, net: 0, count: 0, recordedCount: 0,
  }));
  const byMonth = new Map(rows.map(row => [row.month, row]));
  for (const transaction of transactions) {
    if (range && (transaction.date < range.start || transaction.date > range.end)) continue;
    const row = byMonth.get(transaction.date.slice(0, 7));
    if (!row || !['income', 'expense', 'saving', 'investing'].includes(transaction.type)) continue;
    row.recordedCount++;
    if (!matchesAnalytics(transaction, filters)) continue;
    row.count++;
    if (transaction.type === 'income') row.income += transaction.amount;
    if (transaction.type === 'expense') row.spent += transaction.amount;
    if (transaction.type === 'saving') row.saved += transaction.amount;
    if (transaction.type === 'investing') row.invested += transaction.amount;
  }
  for (const row of rows) row.net = row.income - row.spent - row.saved - row.invested;
  return rows;
}

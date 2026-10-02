import { shiftMonth, type ReviewTransaction } from './month-review';
import { ALL_ANALYTICS, matchesAnalytics, type AnalyticsFilters } from './historical-analytics';
export type DateRange = { start: string; end: string };
export type RangePreset = 'selected' | 'this-month' | 'last-month' | 'last-3' | 'last-6' | 'ytd' | 'custom';
export function validDate(value: string) {
  if (!/^(19|20|21)\d{2}-(0[1-9]|1[0-2])-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T12:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}
export function monthEnd(month: string) {
  const [year, number] = month.split('-').map(Number);
  return `${month}-${new Date(Date.UTC(year, number, 0)).getUTCDate()}`;
}
export function validateRange(range: DateRange) {
  if (!validDate(range.start) || !validDate(range.end)) return 'Enter two valid dates.';
  if (range.start > range.end) return 'Start date must be on or before end date.';
  const [sy, sm] = range.start.slice(0, 7).split('-').map(Number);
  const [ey, em] = range.end.slice(0, 7).split('-').map(Number);
  if ((ey - sy) * 12 + em - sm >= 120) return 'Choose a range spanning at most 120 calendar months.';
  return '';
}
export function presetRange(preset: Exclude<RangePreset, 'custom'>, selectedMonth: string, today: string): DateRange {
  const current = today.slice(0, 7);
  if (preset === 'selected') return { start: `${selectedMonth}-01`, end: monthEnd(selectedMonth) };
  if (preset === 'last-month') { const month = shiftMonth(current, -1); return { start: `${month}-01`, end: monthEnd(month) }; }
  return { start: preset === 'ytd' ? `${current.slice(0, 4)}-01-01` : `${shiftMonth(current, preset === 'last-3' ? -2 : preset === 'last-6' ? -5 : 0)}-01`, end: today };
}
export function inRange(transaction: ReviewTransaction, range: DateRange) {
  return transaction.date >= range.start && transaction.date <= range.end;
}
export function periodTotals(transactions: ReviewTransaction[], range: DateRange, filters: AnalyticsFilters = ALL_ANALYTICS) {
  const totals = { income: 0, spent: 0, saved: 0, invested: 0, net: 0, count: 0 };
  if (validateRange(range)) return totals;
  for (const tx of transactions) {
    if (!inRange(tx, range) || !matchesAnalytics(tx, filters) || !['income', 'expense', 'saving', 'investing'].includes(tx.type)) continue;
    totals.count++;
    if (tx.type === 'income') totals.income += tx.amount;
    if (tx.type === 'expense') totals.spent += tx.amount;
    if (tx.type === 'saving') totals.saved += tx.amount;
    if (tx.type === 'investing') totals.invested += tx.amount;
  }
  totals.net = totals.income - totals.spent - totals.saved - totals.invested;
  return totals;
}
export function monthlyComparison(transactions: ReviewTransaction[], month: string, today: string, filters: AnalyticsFilters = ALL_ANALYTICS) {
  if (!validDate(`${month}-01`) || !validDate(today) || month > today.slice(0, 7)) return null;
  const previousMonth = shiftMonth(month, -1);
  if (!validDate(`${previousMonth}-01`)) return null;
  const inProgress = month === today.slice(0, 7);
  const previousEnd = inProgress ? `${previousMonth}-${String(Math.min(Number(today.slice(8)), Number(monthEnd(previousMonth).slice(8)))).padStart(2, '0')}` : monthEnd(previousMonth);
  const currentRange = { start: `${month}-01`, end: inProgress ? today : monthEnd(month) };
  const previousRange = { start: `${previousMonth}-01`, end: previousEnd };
  return { currentRange, previousRange, inProgress, current: periodTotals(transactions, currentRange, filters), previous: periodTotals(transactions, previousRange, filters) };
}
export function metricChange(current: number, previous: number) {
  return { amount: current - previous, percent: previous > 0 ? (current - previous) / previous * 100 : null };
}
// Rates intentionally use every transaction in the applied range, independent of
// activity filters, so selecting Expenses cannot erase the income denominator.
export function allocationRates(transactions: ReviewTransaction[], range: DateRange) {
  const totals = periodTotals(transactions, range);
  const rate = (amount: number) => totals.income > 0 ? amount / totals.income * 100 : null;
  return { ...totals, savingRate: rate(totals.saved), investingRate: rate(totals.invested), combinedRate: rate(totals.saved + totals.invested) };
}

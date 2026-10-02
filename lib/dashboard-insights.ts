import { shiftMonth, type ReviewTransaction } from './month-review';
import type { BudgetView } from './budget-planning';

export type RecurringSchedule = { id: number; name: string; amount: number; category: string; type: string; day_of_month: number; start_date: string; active: boolean; end_type: string; end_date: string | null; max_occurrences: number | null };
export function dateForMonth(month: string, day: number) {
  const [year, number] = month.split('-').map(Number);
  const last = new Date(Date.UTC(year, number, 0)).getUTCDate();
  return `${month}-${String(Math.min(day, last)).padStart(2, '0')}`;
}
export function daysBetween(from: string, to: string) {
  return Math.round((Date.parse(`${to}T12:00:00Z`) - Date.parse(`${from}T12:00:00Z`)) / 86400000);
}

// Begin forecasts in the current month so finite payment counts include any
// unposted occurrences before a future selected month.
export function scheduledPayments(items: RecurringSchedule[], transactions: ReviewTransaction[], fromMonth: string, throughMonth: string) {
  const posted = new Set(transactions.filter(t => t.recurring_item_id != null).map(t => `${t.recurring_item_id}:${t.date.slice(0, 7)}`));
  const counts = new Map<number, number>();
  for (const t of transactions) if (t.recurring_item_id != null) counts.set(t.recurring_item_id, (counts.get(t.recurring_item_id) ?? 0) + 1);
  const pending: (RecurringSchedule & { dueDate: string })[] = [];
  for (const item of items) {
    if (!item.active) continue;
    let count = counts.get(item.id) ?? 0;
    for (let month = fromMonth; month <= throughMonth; month = shiftMonth(month, 1)) {
      const dueDate = dateForMonth(month, item.day_of_month);
      if (dueDate < item.start_date || (item.end_type === 'date' && item.end_date && dueDate > item.end_date) || posted.has(`${item.id}:${month}`)) continue;
      if (item.end_type === 'count' && item.max_occurrences != null && count >= item.max_occurrences) break;
      pending.push({ ...item, dueDate });
      count++;
    }
  }
  return pending.sort((a, b) => a.dueDate.localeCompare(b.dueDate) || a.name.localeCompare(b.name));
}

export function dashboardInsights(month: string, today: string, transactions: ReviewTransaction[], recurring: RecurringSchedule[], budgets: BudgetView[], carryIn: number, carryOut: number) {
  const currentMonth = today.slice(0, 7);
  const pending = month < currentMonth ? [] : scheduledPayments(recurring, transactions, currentMonth, shiftMonth(month, 1));
  const thisMonth = pending.filter(item => item.dueDate.startsWith(month));
  const remainingExpenses = thisMonth.filter(item => item.type === 'expense').reduce((sum, item) => sum + item.amount, 0);
  const remainingTransfers = thisMonth.filter(item => ['saving', 'investing'].includes(item.type)).reduce((sum, item) => sum + item.amount, 0);
  const monthly = transactions.filter(t => t.date.startsWith(month));
  const cash = monthly.filter(t => t.date <= today).reduce((sum, t) => sum + (t.type === 'income' ? t.amount : -t.amount), 0) + carryIn - carryOut;
  // Future dated records already in Transactions must not be double-reserved
  // as schedules. Future income is never counted as cash already available.
  const futureOutflows = monthly.filter(t => t.date > today && t.type !== 'income').reduce((sum, t) => sum + t.amount, 0);
  const afterCommitments = cash - remainingExpenses - remainingTransfers - futureOutflows;
  const spending = new Map<string, number>();
  for (const t of monthly) if (t.type === 'expense') spending.set(t.category, (spending.get(t.category) ?? 0) + t.amount);
  const largest = [...spending].sort((a, b) => b[1] - a[1])[0];
  const over = budgets.filter(b => (b.base > 0 || b.carry !== 0) && b.spent > b.amount);
  const near = budgets.filter(b => b.amount > 0 && b.spent <= b.amount && b.spent / b.amount >= .8);
  const lastDay = Number(dateForMonth(month, 31).slice(-2));
  const elapsed = month < currentMonth ? lastDay : month > currentMonth ? 0 : Number(today.slice(-2));
  const upcoming = month === currentMonth ? pending.filter(item => daysBetween(today, item.dueDate) <= 7) : thisMonth;
  return { remainingExpenses, remainingTransfers, futureOutflows, cash, afterCommitments,
    safeToSpend: month === currentMonth ? Math.max(0, afterCommitments) : null,
    shortfall: Math.max(0, -afterCommitments), upcoming, thisMonth,
    billsDueSoon: upcoming.filter(item => item.type === 'expense'),
    progress: Math.round(elapsed / lastDay * 100), elapsed, lastDay, largest, over, near };
}

import { shiftMonth, validMonth, type ReviewTransaction } from './month-review';

export type RolloverMode = 'none' | 'unused' | 'overspending';
export type BudgetPlan = { category: string; month: string; amount: number; rollover: RolloverMode; reset?: boolean };
export type BudgetView = { category: string; amount: number; base: number; carry: number; spent: number; remaining: number; rollover: RolloverMode; recorded: boolean };
export const rolloverModes = ['none', 'unused', 'overspending'] as const;
export const budgetPlanKey = (category: string, month: string) => `plan:budget:${encodeURIComponent(category)}:${month}`;

export function parseBudgetPlans(rows: { key: string; value: string }[]): BudgetPlan[] {
  const plans: BudgetPlan[] = [];
  for (const row of rows) {
    const match = /^plan:budget:(.+):(\d{4}-\d{2})$/.exec(row.key);
    if (!match || !validMonth(match[2])) continue;
    try {
      const value = JSON.parse(row.value);
      const category = decodeURIComponent(match[1]);
      if (category.length > 40 || !Number.isSafeInteger(value.amount) || value.amount < 0 || value.amount > 100000000 || !rolloverModes.includes(value.rollover)) continue;
      plans.push({ category, month: match[2], amount: value.amount, rollover: value.rollover, reset: value.reset === true });
    } catch { /* Ignore malformed settings, never invent financial values. */ }
  }
  return plans.sort((a, b) => a.month.localeCompare(b.month));
}

export function categoryBudgets(month: string, budgets: { category: string; amount: number }[], transactions: ReviewTransaction[], plans: BudgetPlan[]): BudgetView[] {
  const spending = new Map<string, number>();
  for (const t of transactions) {
    const category = t.type === 'investing' ? 'Investing' : t.type === 'expense' && t.category !== 'Investing' ? t.category : null;
    if (!category) continue;
    const key = `${t.date.slice(0, 7)}:${category}`;
    spending.set(key, (spending.get(key) ?? 0) + t.amount);
  }
  return budgets.map(budget => {
    const history = plans.filter(plan => plan.category === budget.category && plan.month <= month).sort((a, b) => a.month.localeCompare(b.month));
    let base = budget.amount, mode: RolloverMode = 'none', carry = 0;
    let cursor = history[0]?.month ?? month;
    let index = 0;
    while (cursor <= month) {
      const change = history[index]?.month === cursor ? history[index++] : undefined;
      if (change) {
        base = change.amount;
        mode = change.rollover;
        if (change.reset || mode === 'none') carry = 0;
      }
      const amount = base + carry;
      const spent = spending.get(`${cursor}:${budget.category}`) ?? 0;
      if (cursor === month) return { category: budget.category, amount, base, carry, spent, remaining: amount - spent, rollover: mode, recorded: history.length > 0 };
      carry = mode === 'unused' ? Math.max(0, amount - spent) : mode === 'overspending' ? Math.min(0, amount - spent) : 0;
      cursor = shiftMonth(cursor, 1);
    }
    throw new Error('Invalid budget month');
  });
}

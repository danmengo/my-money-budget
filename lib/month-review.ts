export type ReviewChoice = 'carry' | 'unallocated';
export type MonthReviews = Record<string, ReviewChoice>;
export type ReviewTransaction = {
  date: string; name: string; amount: number; category: string; type: string;
  recurring_item_id?: number | null;
};

export function validMonth(value: unknown): value is string {
  return typeof value === 'string' && /^(19|20|21)\d{2}-(0[1-9]|1[0-2])$/.test(value);
}

export function shiftMonth(month: string, offset: number) {
  const [year, number] = month.split('-').map(Number);
  const date = new Date(Date.UTC(year, number - 1 + offset, 1));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
}

export function parseMonthReviews(rows: { key: string; value: string }[]): MonthReviews {
  const reviews: MonthReviews = {};
  for (const row of rows) {
    const month = row.key.slice('month_review:'.length);
    if (row.key.startsWith('month_review:') && validMonth(month) &&
        (row.value === 'carry' || row.value === 'unallocated')) reviews[month] = row.value;
  }
  return reviews;
}

// Carry is a planning balance, never a new income transaction. Recalculate it
// from recorded activity so edits cannot leave stale or duplicated balances.
export function monthBalances(transactions: ReviewTransaction[], reviews: MonthReviews, currentMonth: string) {
  const cashFlow: Record<string, number> = {};
  for (const transaction of transactions) {
    const month = transaction.date.slice(0, 7);
    const sign = transaction.type === 'income' ? 1 :
      ['expense', 'saving', 'investing'].includes(transaction.type) ? -1 : 0;
    cashFlow[month] = (cashFlow[month] ?? 0) + transaction.amount * sign;
  }
  const incoming: Record<string, number> = {};
  const outgoing: Record<string, number> = {};
  for (const month of Object.keys(reviews).sort()) {
    if (!validMonth(month) || month >= currentMonth || reviews[month] !== 'carry') continue;
    const amount = Math.max(0, (cashFlow[month] ?? 0) + (incoming[month] ?? 0));
    outgoing[month] = amount;
    incoming[shiftMonth(month, 1)] = amount;
  }
  return { cashFlow, incoming, outgoing };
}

export function buildMonthReview(month: string, transactions: ReviewTransaction[], budgets: { category: string; amount: number; base?: number; carry?: number }[]) {
  const monthly = transactions.filter(transaction => transaction.date.slice(0, 7) === month);
  const total = (type: string) => monthly.filter(transaction => transaction.type === type).reduce((sum, transaction) => sum + transaction.amount, 0);
  const spending = new Map<string, number>();
  const recurring = new Map<number, { name: string; amount: number }>();
  for (const transaction of monthly) {
    if (transaction.type !== 'expense') continue;
    spending.set(transaction.category, (spending.get(transaction.category) ?? 0) + transaction.amount);
    if (transaction.recurring_item_id != null) {
      const previous = recurring.get(transaction.recurring_item_id);
      recurring.set(transaction.recurring_item_id, { name: transaction.name, amount: (previous?.amount ?? 0) + transaction.amount });
    }
  }
  const categories = [...spending].map(([category, amount]) => ({ category, amount })).sort((a, b) => b.amount - a.amount || a.category.localeCompare(b.category));
  const income = total('income'), spent = total('expense'), saved = total('saving'), invested = total('investing');
  // Match Budget's Investing category and its zero-means-no-limit behavior.
  const overBudget = budgets.filter(budget => budget.amount > 0 || (budget.base ?? 0) > 0 || (budget.carry ?? 0) !== 0).map(budget => ({ category: budget.category, limit: budget.amount,
    amount: budget.category === 'Investing' ? invested : (spending.get(budget.category) ?? 0) }))
    .filter(item => item.amount > item.limit).sort((a, b) => (b.amount - b.limit) - (a.amount - a.limit));
  return { income, spent, saved, invested, surplus: income - spent - saved - invested,
    count: monthly.length, topCategory: categories[0], overBudget,
    recurring: [...recurring.entries()].map(([id, item]) => ({ id, ...item })).sort((a, b) => b.amount - a.amount).slice(0, 5) };
}

import { validMonth } from './month-review';

type Goal = { id: number; name: string; type: string; target: number; current: number };
type Transaction = { id: number; date: string; type: string; amount: number; recurring_item_id?: number | null };
type Recurring = { id: number; type: string; start_date: string };
export type GoalTrackingMode = 'manual' | 'linked';
export function parseGoalSettings(rows: { key: string; value: string }[]) {
  const modes = new Map<number, GoalTrackingMode>();
  const links = new Map<number, number>();
  const recurring = new Map<number, { month: string; goalId: number }[]>();
  for (const row of rows) {
    const mode = /^plan:goal-mode:([1-9]\d*)$/.exec(row.key);
    const link = /^plan:tx-goal:([1-9]\d*)$/.exec(row.key);
    const rule = /^plan:recurring-goal:([1-9]\d*):(\d{4}-\d{2})$/.exec(row.key);
    if (mode && ['manual', 'linked'].includes(row.value)) modes.set(Number(mode[1]), row.value as GoalTrackingMode);
    const goalId = Number(row.value);
    if (!Number.isSafeInteger(goalId) || goalId < 0) continue;
    if (link) links.set(Number(link[1]), goalId);
    if (rule && validMonth(rule[2])) {
      const id = Number(rule[1]);
      const history = recurring.get(id) ?? [];
      history.push({ month: rule[2], goalId });
      recurring.set(id, history);
    }
  }
  for (const history of recurring.values()) history.sort((a, b) => a.month.localeCompare(b.month));
  return { modes, links, recurring };
}

export function enrichGoalData<T extends Transaction, R extends Recurring, G extends Goal>(transactions: T[], recurring: R[], goals: G[], rows: { key: string; value: string }[], today = new Date().toISOString().slice(0, 10)) {
  const settings = parseGoalSettings(rows);
  const goalMap = new Map(goals.map(goal => [goal.id, goal]));
  const compatible = (goalId: number | undefined, type: string) => {
    const goal = goalMap.get(goalId ?? 0);
    return goal && ['saving', 'investing'].includes(type) && goal.type === type ? goal : undefined;
  };
  const totals = new Map<number, { amount: number; count: number }>();
  const linkedTransactions = transactions.map(transaction => {
    const inherited = transaction.recurring_item_id == null ? undefined : settings.recurring.get(transaction.recurring_item_id)?.filter(rule => rule.month <= transaction.date.slice(0, 7)).at(-1)?.goalId;
    // Explicit zero is an unlink override and must not fall through to a rule.
    const goal = compatible(settings.links.has(transaction.id) ? settings.links.get(transaction.id) : inherited, transaction.type);
    if (goal && transaction.date <= today) {
      const previous = totals.get(goal.id) ?? { amount: 0, count: 0 };
      totals.set(goal.id, { amount: previous.amount + transaction.amount, count: previous.count + 1 });
    }
    return { ...transaction, goal_id: goal?.id ?? null, goal_name: goal?.name ?? null };
  });
  return {
    transactions: linkedTransactions,
    recurring: recurring.map(item => {
      const rule = settings.recurring.get(item.id)?.at(-1);
      const goal = compatible(rule?.goalId, item.type);
      return { ...item, goal_id: goal?.id ?? null, goal_name: goal?.name ?? null, goal_effective_month: rule?.month ?? null };
    }),
    goals: goals.map(goal => {
      const tracking = settings.modes.get(goal.id) ?? 'manual';
      const contributions = totals.get(goal.id) ?? { amount: 0, count: 0 };
      return { ...goal, tracking, manual_current: goal.current, linked_total: contributions.amount, linked_count: contributions.count,
        current: goal.current + (tracking === 'linked' ? contributions.amount : 0) };
    }),
  };
}

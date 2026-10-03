import { scheduledPayments, type RecurringSchedule } from './dashboard-insights';
import { validMonth, type ReviewTransaction } from './month-review';

export type Group = 'needs' | 'wants' | 'future';
export type Template = 'balanced' | 'saving' | 'essentials' | 'custom';
export type BuilderRow = { category: string; group: Group; amount: number; fixed: number };
export const templates: { id: Template; name: string; description: string }[] = [
  { id: 'balanced', name: 'Balanced', description: '50% needs · 30% wants · 20% saving and investing' },
  { id: 'saving', name: 'Savings focused', description: '50% needs · 20% wants · 30% saving and investing' },
  { id: 'essentials', name: 'Essentials first', description: 'Cover your bills, then assign what remains.' },
  { id: 'custom', name: 'Build my own', description: 'Start with your current limits and adjust each category.' },
];
export function defaultGroup(category: string): Group {
  if (category === 'Investing') return 'future';
  return ['housing','utilities','food','transportation','healthcare','insurance','debt'].includes(category.toLowerCase()) ? 'needs' : 'wants';
}
// Exact decimal parsing: no silent rounding, exponent notation, negatives or blanks.
export function dollarsToCents(value: string): number | null {
  if (!/^\d+(\.\d{1,2})?$/.test(value)) return null;
  const [whole, fraction = ''] = value.split('.');
  const cents = Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
  return Number.isSafeInteger(cents) && cents <= 100000000 ? cents : null;
}
export function plannedValue(settings: {key:string;value:string}[], kind: 'income' | 'saving', month: string, fallback = 0): number {
  const prefix = `plan:${kind}:`;
  const row = settings.filter(r => r.key.startsWith(prefix) && validMonth(r.key.slice(prefix.length)) && r.key.slice(prefix.length) <= month && /^\d+$/.test(r.value) && Number.isSafeInteger(Number(r.value)) && Number(r.value) <= 1000000000).sort((a,b)=>b.key.localeCompare(a.key))[0];
  return row ? Number(row.value) : fallback;
}
export function recurringFloor(month: string, currentMonth: string, recurring: RecurringSchedule[], transactions: ReviewTransaction[]) {
  const totals: Record<string,number> = Object.create(null);
  let saving = 0;
  const add = (type:string,category:string,amount:number) => {
    if (type === 'saving') { saving += amount; return; }
    const key = type === 'investing' ? 'Investing' : type === 'expense' ? category : null;
    if (key) totals[key] = (totals[key] ?? 0) + amount;
  };
  for (const t of transactions) if (t.recurring_item_id != null && t.date.startsWith(month)) add(t.type,t.category,t.amount);
  if (month >= currentMonth) for (const r of scheduledPayments(recurring,transactions,currentMonth,month)) if (r.dueDate.startsWith(month)) add(r.type,r.category,r.amount);
  return { categories: totals, saving };
}
export function suggestBudget(income: number, template: Template, rows: BuilderRow[], savingFloor: number) {
  const result = rows.map(r=>({...r,amount:template==='custom'?r.amount:r.fixed}));
  let saving = savingFloor;
  if (template === 'custom' || template === 'essentials') return { rows: result, saving };
  const futureTarget = Math.floor(income * (template==='saving'?30:20) / 100);
  const needsTarget = Math.floor(income / 2);
  const targets = { needs: needsTarget, wants: income-needsTarget-futureTarget, future: futureTarget };
  // Reserve all commitments first. Reduce discretionary extras when bills
  // exceed the suggested ratios; only real commitments can force a deficit.
  const groups = ['needs','wants','future'] as const;
  const extras = { needs: 0, wants: 0, future: 0 };
  for (const group of groups) {
    const matches = result.filter(r=>r.group===group);
    const fixed = matches.reduce((sum,r)=>sum+r.amount,0) + (group==='future'?saving:0);
    extras[group] = matches.length || group==='future' ? Math.max(0, targets[group]-fixed) : 0;
  }
  const committed = result.reduce((sum,r)=>sum+r.amount,saving);
  let excess = Math.max(0, Object.values(extras).reduce((sum,n)=>sum+n,0)-Math.max(0,income-committed));
  for (const group of ['wants','future','needs'] as const) {
    const cut = Math.min(excess, extras[group]);
    extras[group] -= cut;
    excess -= cut;
  }
  for (const group of groups) {
    if (group === 'future') { saving += extras[group]; continue; }
    const matches = result.filter(r=>r.group===group);
    if (!matches.length) continue;
    const each = Math.floor(extras[group]/matches.length), remainder=extras[group]%matches.length;
    matches.forEach((r,i)=>{r.amount+=each+(i<remainder?1:0);});
  }
  return { rows:result, saving };
}
export type BuilderPayload = { month:string; income:number; saving:number; rows:{category:string;amount:number}[] };
export function validBuilderPayload(value: Record<string,unknown>): value is Record<string,unknown> & BuilderPayload {
  const money = (v:unknown) => typeof v==='number' && Number.isSafeInteger(v) && v>=0 && v<=100000000;
  if (!validMonth(value.month) || !money(value.income) || !money(value.saving) || !Array.isArray(value.rows) || value.rows.length<1 || value.rows.length>100) return false;
  const names = new Set<string>();
  for (const row of value.rows) {
    if (!row || typeof row!=='object' || typeof row.category!=='string' || !row.category.trim() || row.category.length>40 || names.has(row.category) || !money(row.amount)) return false;
    names.add(row.category);
  }
  return true;
}

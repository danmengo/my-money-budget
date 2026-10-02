'use client';
import { Button } from '@/components/ui/button';
import { dashboardInsights, daysBetween, type RecurringSchedule } from '@/lib/dashboard-insights';
import type { ReviewTransaction } from '@/lib/month-review';
import type { BudgetView } from '@/lib/budget-planning';

const money = (n: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n / 100);
export default function DashboardInsights({ month, today, transactions, recurring, budgets, carryIn, carryOut, onRecurring, onBudget }: {
  month: string; today: string; transactions: ReviewTransaction[]; recurring: RecurringSchedule[];
  budgets: BudgetView[]; carryIn: number; carryOut: number; onRecurring: () => void; onBudget: () => void;
}) {
  const insight = dashboardInsights(month, today, transactions, recurring, budgets, carryIn, carryOut);
  const current = month === today.slice(0, 7);
  return <div className="dashboard-insights">
    <div className="two-col">
      <section className="panel safe-spend-panel"><h2>Safe to spend</h2>
        <strong className="insight-total">{insight.safeToSpend === null ? '—' : money(insight.safeToSpend)}</strong>
        <p className="panel-sub">{current ? 'Estimate after recorded activity and scheduled commitments' : 'Available for the current month only'}</p>
        {current && <><div className="flow-row"><span>Recorded balance, including cash carry</span><strong>{money(insight.cash)}</strong></div>
          <div className="flow-row"><span>Unposted recurring expenses</span><strong>− {money(insight.remainingExpenses)}</strong></div>
          <div className="flow-row"><span>Unposted recurring saving + investing</span><strong>− {money(insight.remainingTransfers)}</strong></div>
          {insight.futureOutflows > 0 && <div className="flow-row"><span>Future-dated outflows already entered</span><strong>− {money(insight.futureOutflows)}</strong></div>}
          {insight.shortfall > 0 && <p className="insight-warning">Recorded funds are {money(insight.shortfall)} short of these commitments.</p>}</>}
        <p className="review-note">Planned and future income are excluded. This is not your bank balance and does not reserve for unrecorded bills or unused category limits. Check your category budgets before spending.</p>
      </section>
      <section className="panel"><div className="panel-title"><div><h2>Budget health</h2><p>{insight.elapsed} of {insight.lastDay} days · {insight.progress}% of month elapsed</p></div><Button variant="outline" onClick={onBudget}>View budget</Button></div>
        <progress className="month-progress" aria-label="Month progress" max={100} value={insight.progress}/>
        <div className="flow-row"><span>Categories over limit</span><strong>{insight.over.length}</strong></div>
        <div className="flow-row"><span>Categories at 80% or more</span><strong>{insight.near.length}</strong></div>
        <div className="flow-row"><span>Remaining recurring expenses</span><strong>{money(insight.remainingExpenses)}</strong></div>
        <div className="flow-row"><span>Largest spending category</span><strong>{insight.largest ? `${insight.largest[0]} · ${money(insight.largest[1])}` : 'No spending yet'}</strong></div>
        <p className="review-note">{insight.over.length ? 'Review the categories over their allowance before adding more spending.' : 'No recorded category spending exceeds the selected limits.'} Paused and ended recurring items are excluded from upcoming commitments.</p>
      </section>
    </div>
    <section className="panel"><div className="panel-title"><div><h2>{current ? 'Bills due soon & upcoming payments' : 'Upcoming recurring payments'}</h2><p>{current ? 'Due within seven days, including any unposted overdue items' : 'Unposted schedules for the selected month'} · {insight.billsDueSoon.length} expense{insight.billsDueSoon.length === 1 ? '' : 's'}</p></div><Button variant="outline" onClick={onRecurring}>Manage recurring</Button></div>
      {insight.upcoming.length ? <ul className="upcoming-list">{insight.upcoming.slice(0, 8).map(item => {
        const days = daysBetween(today, item.dueDate);
        return <li key={`${item.id}:${item.dueDate}`}><div><strong>{item.name}</strong><small>{item.type} · {item.category}</small></div><div><span>{days < 0 ? `${Math.abs(days)} days overdue` : days === 0 ? 'Due today' : `Due in ${days} day${days === 1 ? '' : 's'}`}</span><small>{item.dueDate}</small></div><strong>{item.type === 'income' ? '+' : '−'}{money(item.amount)}</strong></li>;
      })}</ul> : <p className="empty">{month < today.slice(0, 7) ? 'This month has ended. See Transactions for posted payments.' : 'No unposted recurring payments due in this period.'}</p>}
      {insight.upcoming.length > 8 && <p className="review-note">Showing 8 of {insight.upcoming.length} upcoming payments. Open Recurring to see all items.</p>}
    </section>
  </div>;
}

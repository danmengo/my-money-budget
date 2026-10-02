'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { buildMonthReview, shiftMonth, type ReviewChoice, type ReviewTransaction } from '@/lib/month-review';

const money = (amount: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount / 100);
const monthName = (month: string) => new Date(`${month}-15T12:00:00`).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

type Props = {
  month: string; currentMonth: string; transactions: ReviewTransaction[];
  budgets: { category: string; amount: number; recorded?: boolean }[]; choice?: ReviewChoice;
  carryIn: number; carryOut: number; busy: boolean;
  onChoice: (choice: ReviewChoice) => Promise<boolean>;
  onAllocate: (type: 'saving' | 'investing') => void;
  onNextBudget: () => void;
};

export default function MonthEndReview(props: Props) {
  const { month, currentMonth, transactions, budgets, carryIn, carryOut, choice, busy, onChoice, onAllocate, onNextBudget } = props;
  const review = buildMonthReview(month, transactions, budgets);
  const complete = month < currentMonth;
  const available = review.surplus + carryIn - carryOut;
  const [confirmChoice, setConfirmChoice] = useState<ReviewChoice | null>(null);
  const [message, setMessage] = useState('');
  const [choiceError, setChoiceError] = useState(false);

  return <div className="month-review">
    <section className="panel review-intro">
      <div><h2>{complete ? 'Your month in review' : 'Month in progress'}</h2>
        <p className="panel-sub">{complete ? `A look back at ${monthName(month)}. Review recorded activity, then decide what comes next.` : 'This is a preview. Finish this month before choosing how to handle the remaining balance.'}</p>
        <p className="review-note">Based on recorded transactions, including posted recurring payments. Scheduled payments that have not posted are not included.</p></div>
      <Button variant="outline" disabled={!complete || busy} onClick={onNextBudget}>Start {monthName(shiftMonth(month, 1))}&apos;s budget</Button>
    </section>

    {!review.count && <p className="review-empty" role="status">No transactions recorded for this month. You can still review any balance carried in.</p>}
    <div className="stats-grid">
      {([['Total income', review.income], ['Total spent', review.spent], ['Total saved', review.saved], ['Total invested', review.invested]] as const).map(([label, amount]) =>
        <article className="stat-card" key={label}><span className="stat-label">{label}</span><strong>{money(amount)}</strong></article>)}
    </div>

    <div className="two-col">
      <section className="panel">
        <h2>{review.surplus < 0 ? 'Monthly deficit' : 'Monthly surplus'}</h2>
        <p className="panel-sub">Income minus expenses, savings, and investments</p>
        <div className={`month-result ${review.surplus < 0 ? 'deficit' : 'surplus'}`}><strong>{money(review.surplus)}</strong></div>
        <div className="flow-row"><span>Carried in from last month</span><strong>{money(carryIn)}</strong></div>
        <div className="flow-row"><span>Carried to next month</span><strong>{money(carryOut)}</strong></div>
        <div className="flow-row"><span>{available < 0 ? 'Uncovered deficit' : 'Left unallocated'}</span><strong>{money(available)}</strong></div>
        <p className="review-note">Carry-forward is separate from income. It updates if past transactions or carry choices change. A deficit is never automatically carried.</p>
        {complete && <div className="review-actions">
          <Button variant="outline" disabled={busy || available <= 0 || choice === 'carry'} onClick={() => onAllocate('saving')}>Move surplus to savings</Button>
          <Button variant="outline" disabled={busy || available <= 0 || choice === 'carry'} onClick={() => onAllocate('investing')}>Move surplus to investing</Button>
          <Button variant="outline" disabled={busy || available <= 0 || choice === 'carry'} onClick={() => { setChoiceError(false); setConfirmChoice('carry'); }}>Carry surplus forward</Button>
          <Button variant="outline" disabled={busy || choice === 'unallocated'} onClick={() => { setChoiceError(false); setConfirmChoice('unallocated'); }}>{choice === 'carry' ? 'Undo carry-forward' : 'Leave unallocated'}</Button>
        </div>}
        {choice && <p className="review-note">Saved choice: {choice === 'carry' ? `carry remaining surplus into ${monthName(shiftMonth(month, 1))}` : 'leave remaining balance unallocated'}.</p>}
        {message && <p role="status" className="review-note">{message}</p>}
        <p className="review-note">These actions update your budget records; they do not move money between bank accounts.</p>
      </section>
      <section className="panel">
        <h2>Spending highlights</h2>
        <p className="panel-sub">Largest spending category</p>
        {review.topCategory ? <div className="flow-row"><span>{review.topCategory.category}</span><strong>{money(review.topCategory.amount)}</strong></div> : <p className="empty">No expenses recorded.</p>}
        <h3 className="review-subheading">Biggest recurring expenses</h3>
        {review.recurring.length ? review.recurring.map(item => <div className="flow-row" key={item.id}><span>{item.name}</span><strong>{money(item.amount)}</strong></div>) : <p className="empty">No posted recurring expenses for this month.</p>}
        <p className="review-note">Up to five recurring items, ranked by what was actually posted this month.</p>
      </section>
    </div>

    <section className="panel">
      <div className="panel-title"><div><h2>Categories over budget</h2><p>Compared with this month&apos;s limits including rollover. {budgets.some(b=>!b.recorded)&&'Some limits predate monthly tracking and use the original limits available when tracking began.'} Categories with no limit are excluded.</p></div></div>
      {review.overBudget.length ? <ul className="review-budget-list">{review.overBudget.map(item => <li key={item.category}>
        <div><strong>{item.category}</strong><small>{money(item.amount)} spent · {money(item.limit)} limit</small></div>
        <strong className="review-over">{money(item.amount - item.limit)} over</strong>
      </li>)}</ul> : <p className="empty">{review.spent ? 'No categories exceed your selected limits.' : 'No expenses to compare yet.'}</p>}
    </section>
    <p className="review-note">Starting the next month opens your budget with the selected limits. It does not reset transactions or change previous months.</p>

    <Dialog open={confirmChoice !== null} onOpenChange={open => { if (!open && !busy) setConfirmChoice(null); }}>
      <DialogContent><DialogHeader><DialogTitle>{confirmChoice === 'carry' ? 'Carry surplus forward?' : 'Leave the balance unallocated?'}</DialogTitle></DialogHeader>
        <p>{confirmChoice === 'carry' ? `${money(Math.max(0, review.surplus + carryIn))} will be available in ${monthName(shiftMonth(month, 1))}, separate from income.` : 'This month’s remaining balance will stay unallocated. Any carry from this month will be removed from the next month.'}</p>
        <p className="review-note">Changing this choice or editing past transactions can change later carried balances. You can change your choice again.</p>
        {choiceError && <p role="alert">Could not save your choice. Close this dialog to check the error and try again.</p>}
        <DialogFooter><Button variant="outline" disabled={busy} onClick={() => setConfirmChoice(null)}>Cancel</Button><Button disabled={busy} onClick={async () => {
          if (!confirmChoice) return;
          const choiceToSave = confirmChoice;
          if (await onChoice(choiceToSave)) { setConfirmChoice(null); setMessage('Your month-end choice has been saved.'); }
          else setChoiceError(true);
        }}>{busy ? 'Saving…' : 'Save choice'}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  </div>;
}

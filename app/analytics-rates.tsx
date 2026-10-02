'use client';
import { allocationRates, type DateRange } from '@/lib/analytics-periods';
import type { ReviewTransaction } from '@/lib/month-review';
const money=(value:number)=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(value/100);
export default function AnalyticsRates({transactions,range}:{transactions:ReviewTransaction[];range:DateRange}){
 const totals=allocationRates(transactions,range);
 const cards=[{label:'Saving rate',amount:totals.saved,rate:totals.savingRate},{label:'Investing rate',amount:totals.invested,rate:totals.investingRate},{label:'Combined allocation rate',amount:totals.saved+totals.invested,rate:totals.combinedRate}];
 return <section className="panel analytics-rates" aria-labelledby="rates-title">
  <div className="panel-title"><div><h2 id="rates-title">Saving & investing rates</h2><p>All activity · {range.start} – {range.end} · activity filters do not apply</p></div></div>
  <p className="review-note">Recorded saving and investing contributions divided by recorded income of {money(totals.income)}. Cash carry, goal starting balances, planned income, and unposted schedules are excluded. These are allocation rates, not investment returns.</p>
  <div className="allocation-rate-grid">{cards.map(card=><article key={card.label}><span>{card.label}</span><strong>{card.rate===null?'—':`${card.rate.toFixed(1)}%`}</strong><small>{money(card.amount)} recorded</small></article>)}</div>
  {!totals.count?<p className="review-note" role="status">No transactions recorded in this date range.</p>:totals.income<=0?<p className="review-note" role="status">Rates are unavailable without positive recorded income. Your contribution amounts are still shown.</p>:null}
  {totals.combinedRate!==null&&totals.combinedRate>100&&<p className="review-note">Contributions exceed this period’s recorded income. Rates above 100% are shown as recorded; contributions may use earlier balances or income may be missing.</p>}
  {totals.net<0&&<p className="review-note">Recorded outflows exceed income by {money(-totals.net)} in this range, before cash carry. Positive contribution rates do not mean the period had a surplus.</p>}
 </section>;
}

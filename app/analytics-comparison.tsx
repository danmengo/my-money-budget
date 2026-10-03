'use client';
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { monthlyComparison, metricChange } from '@/lib/analytics-periods';
import type { AnalyticsFilters } from '@/lib/historical-analytics';
import type { ReviewTransaction } from '@/lib/month-review';
const money=(value:number)=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(value/100);
const metrics=[['income','Income'],['spent','Spending'],['saved','Saved'],['invested','Invested'],['net','Net activity']] as const;
export default function AnalyticsComparison({transactions,month,today,filters}:{transactions:ReviewTransaction[];month:string;today:string;filters:AnalyticsFilters}){
 const comparison=monthlyComparison(transactions,month,today,filters);
 return <section className="panel analytics-comparison" aria-labelledby="comparison-title">
  <div className="panel-title"><div><h2 id="comparison-title">Monthly comparison</h2><p>Uses the top month selector and activity filters, independently of the date range.</p></div></div>
  {!comparison?<p className="empty">Comparisons are available for current and completed months.</p>:<>
   <p className="review-note">{comparison.inProgress?'Month to date versus the same days of the previous month, capped at its last day. Later entries are excluded.':'Full selected month versus the full previous month.'} Recorded activity only; cash carry, category rollover, and unposted schedules are excluded.</p>
   <Table className="history-table"><TableCaption>Change is selected period minus previous period. Percent change is unavailable when the previous amount is zero or negative, or either period has no matching entries.</TableCaption>
    <TableHeader><TableRow><TableHead scope="col">Metric</TableHead><TableHead scope="col">Selected<small className="comparison-dates">{comparison.currentRange.start} – {comparison.currentRange.end}</small></TableHead><TableHead scope="col">Previous<small className="comparison-dates">{comparison.previousRange.start} – {comparison.previousRange.end}</small></TableHead><TableHead scope="col">Change</TableHead><TableHead scope="col">Change %</TableHead></TableRow></TableHeader>
    <TableBody>{metrics.map(([key,label])=>{
      const change=metricChange(comparison.current[key],comparison.previous[key]);
      const comparable=comparison.current.count>0&&comparison.previous.count>0;
      return <TableRow key={key}><TableCell>{label}</TableCell><TableCell>{comparison.current.count?money(comparison.current[key]):'—'}</TableCell><TableCell>{comparison.previous.count?money(comparison.previous[key]):'—'}</TableCell><TableCell>{comparable?`${change.amount>0?'+':''}${money(change.amount)}`:'—'}</TableCell><TableCell>{comparable&&change.percent!==null?`${change.percent>0?'+':''}${change.percent.toFixed(1)}%`:'—'}</TableCell></TableRow>;
    })}</TableBody>
   </Table>
   {(!comparison.current.count||!comparison.previous.count)&&<p className="review-note" role="status">{!comparison.current.count?'Selected period has no matching entries. ':''}{!comparison.previous.count?'Previous period has no matching entries. ':''}Missing records are not proof of zero activity.</p>}
  </>}
 </section>;
}

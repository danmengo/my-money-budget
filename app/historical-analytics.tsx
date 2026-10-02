'use client';
import { useMemo } from 'react';
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { historicalAnalytics, type AnalyticsFilters } from '@/lib/historical-analytics';
import { shiftMonth, type ReviewTransaction } from '@/lib/month-review';

const money = (cents: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100);
const monthLabel = (month: string) => new Date(`${month}-15T12:00:00`).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });

export default function HistoricalAnalytics({ transactions, month, currentMonth, filters, onMonth }: {
  transactions: ReviewTransaction[]; month: string; currentMonth: string;
  filters: AnalyticsFilters; onMonth: (month: string) => void;
}) {
  const end = month < currentMonth ? month : currentMonth;
  const rows = useMemo(() => historicalAnalytics(transactions, end, filters), [transactions, end, filters]);
  const filtered = Object.values(filters).some(value => value !== 'All');
  const hasRecords = rows.some(row => row.recordedCount > 0);
  const hasMatches = rows.some(row => row.count > 0);
  return <section className="panel history-panel" aria-labelledby="history-title">
    <div className="panel-title"><div><h2 id="history-title">Monthly history</h2>
      <p>{monthLabel(rows[0].month)} – {monthLabel(end)} · {filtered ? 'Matching activity' : 'Recorded activity'}</p></div>
      <div className="history-controls"><Button variant="outline" disabled={shiftMonth(end, -23) < '1900-01'} onClick={() => onMonth(shiftMonth(end, -12))}>Older months</Button>
        <Button variant="outline" disabled={end >= currentMonth} onClick={() => onMonth(shiftMonth(end, 12) > currentMonth ? currentMonth : shiftMonth(end, 12))}>Newer months</Button></div>
    </div>
    <p className="review-note">Uses the filters above. Net activity is income minus spending, saving, and investing. Cash carry and category rollover are excluded; this is not your bank balance. The current month is in progress and includes future-dated entries already recorded, but no unposted schedules.</p>
    {!hasMatches ? <p className="empty" role="status">{hasRecords ? 'No transactions match these filters in this period.' : 'No transactions recorded in this period. Try older or newer months.'}</p> : <div className="history-chart" role="img" aria-label="Monthly income and outflows. Exact values are in the table below.">
      <ResponsiveContainer width="100%" height="100%"><BarChart data={rows} margin={{ top: 12, right: 8, left: 4, bottom: 8 }}>
        <CartesianGrid vertical={false} stroke="var(--border)"/>
        <XAxis dataKey="month" tickFormatter={value => monthLabel(String(value))} tick={{ fill: 'var(--muted-foreground)', fontSize: 11 }} minTickGap={24}/>
        <YAxis tickFormatter={value => new Intl.NumberFormat('en-US', { notation: 'compact', style: 'currency', currency: 'USD', maximumFractionDigits: 1 }).format(Number(value) / 100)} tick={{ fill: 'var(--muted-foreground)', fontSize: 11 }} width={65}/>
        <Tooltip labelFormatter={value => monthLabel(String(value))} formatter={value => money(Number(value))} contentStyle={{ background: 'var(--card)', color: 'var(--foreground)', borderColor: 'var(--border)', borderRadius: 8 }}/>
        <Legend/>
        <Bar dataKey="income" name="Income" fill="#357e98"/>
        <Bar dataKey="spent" name="Spending" stackId="outflows" fill="#d1973d"/>
        <Bar dataKey="saved" name="Saved" stackId="outflows" fill="#8e68a8"/>
        <Bar dataKey="invested" name="Invested" stackId="outflows" fill="#4e8b70"/>
      </BarChart></ResponsiveContainer>
    </div>}
    <Table className="history-table"><TableCaption>Select a month to view its Analytics details. Dashes mean no matching records, not verified zero activity.</TableCaption>
      <TableHeader><TableRow><TableHead scope="col">Month</TableHead><TableHead scope="col">Income</TableHead><TableHead scope="col">Spending</TableHead><TableHead scope="col">Saved</TableHead><TableHead scope="col">Invested</TableHead><TableHead scope="col">{filtered ? 'Filtered net' : 'Net activity'}</TableHead></TableRow></TableHeader>
      <TableBody>{[...rows].reverse().map(row => <TableRow key={row.month} data-state={row.month === month ? 'selected' : undefined}>
        <TableCell><button className="history-month" aria-label={`View ${monthLabel(row.month)} analytics`} aria-current={row.month === month ? 'date' : undefined} onClick={() => onMonth(row.month)}>{monthLabel(row.month)}</button>
          <small>{row.month === currentMonth ? 'In progress · ' : ''}{row.count ? `${row.count} matching ${row.count === 1 ? 'entry' : 'entries'}` : row.recordedCount ? 'No matching entries' : 'No recorded entries'}</small></TableCell>
        {[row.income, row.spent, row.saved, row.invested, row.net].map((value, index) => <TableCell key={index}>{row.count ? money(value) : '—'}</TableCell>)}
      </TableRow>)}</TableBody>
    </Table>
  </section>;
}

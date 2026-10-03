'use client';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { presetRange, validateRange, type DateRange, type RangePreset } from '@/lib/analytics-periods';
const options: { value: RangePreset; label: string }[] = [
  {value:'selected',label:'Selected month'}, {value:'this-month',label:'This month'}, {value:'last-month',label:'Last month'},
  {value:'last-3',label:'Last 3 months'}, {value:'last-6',label:'Last 6 months'}, {value:'ytd',label:'Year to date'}, {value:'custom',label:'Custom dates'},
];
export default function AnalyticsRangeControls({month,today,range,preset,onApply}:{
  month:string;today:string;range:DateRange;preset:RangePreset;onApply:(range:DateRange,preset:RangePreset)=>void;
}) {
  const [custom,setCustom]=useState(preset==='custom'),[draft,setDraft]=useState(range),[error,setError]=useState('');
  return <section className="panel analytics-range" aria-label="Analytics date range">
    <div className="panel-title"><div><h2>Date range</h2><p>Applied: {range.start} – {range.end}, inclusive</p></div>
      <Select value={custom?'custom':preset} onValueChange={value=>{
        if(value==='custom'){setDraft(range);setCustom(true);setError('');return;}
        const option=options.find(item=>item.value===value);
        if(option && option.value!=='custom'){setCustom(false);setError('');onApply(presetRange(option.value,month,today),option.value);}
      }}><SelectTrigger aria-label="Date range preset"><SelectValue/></SelectTrigger><SelectContent>{options.map(item=><SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}</SelectContent></Select>
    </div>
    {custom&&<form className="analytics-custom-dates" onSubmit={event=>{event.preventDefault();const message=validateRange(draft);setError(message);if(!message)onApply(draft,'custom');}}>
      <label>Start date<Input type="date" required min="1900-01-01" max="2199-12-31" value={draft.start} aria-invalid={!!error} aria-describedby={error?'analytics-range-error':undefined} onChange={event=>setDraft({...draft,start:event.target.value})}/></label>
      <label>End date<Input type="date" required min="1900-01-01" max="2199-12-31" value={draft.end} aria-invalid={!!error} aria-describedby={error?'analytics-range-error':undefined} onChange={event=>setDraft({...draft,end:event.target.value})}/></label>
      <Button type="submit">Apply dates</Button><p className="review-note">Up to 120 calendar months. Your current results stay visible until you apply valid dates.</p>
      {error&&<p role="alert" id="analytics-range-error">{error}</p>}
    </form>}
    <p className="review-note">Recent-month presets include the current month and stop at today. Selected month uses the full calendar month. Custom dates can include future entries already recorded; unposted schedules are excluded. Changing the top month selector returns to Selected month.</p>
  </section>;
}

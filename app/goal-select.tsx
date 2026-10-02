'use client';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
export default function GoalSelect({ type, value, goals, onChange }: {
  type: string; value: string; goals: { id: number; name: string; type: string; tracking?: string }[]; onChange: (value: string) => void;
}) {
  if (!['saving', 'investing'].includes(type)) return null;
  const matching = goals.filter(goal => goal.type === type);
  return <div><label>Goal (optional)<Select value={value} onValueChange={next => onChange(next ?? 'none')}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent>
    <SelectItem value="none">No goal</SelectItem>
    {matching.map(goal => <SelectItem key={goal.id} value={String(goal.id)}>{goal.name}{goal.tracking === 'linked' ? '' : ' (manual tracking)'}</SelectItem>)}
  </SelectContent></Select></label><p className="panel-sub">{matching.length ? 'Linked transactions update automatically tracked goals. Manual goals keep their manually entered progress.' : `Create a ${type === 'saving' ? 'saving' : 'investing'} goal in Goals to link it here.`}</p></div>;
}

alter table public.recurring_items
  add column if not exists end_type text not null default 'never',
  add column if not exists end_date date,
  add column if not exists max_occurrences integer,
  add column if not exists ended_at timestamptz;

alter table public.recurring_items
  drop constraint if exists recurring_items_end_type_check;

alter table public.recurring_items
  add constraint recurring_items_end_type_check
  check (end_type in ('never','date','count'));

alter table public.recurring_items
  drop constraint if exists recurring_items_max_occurrences_check;

alter table public.recurring_items
  add constraint recurring_items_max_occurrences_check
  check (max_occurrences is null or max_occurrences > 0);

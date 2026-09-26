-- Track when recurring rules begin and link generated/paid transactions back to them.
alter table public.recurring_items
  add column if not exists start_date date not null default current_date;

alter table public.transactions
  add column if not exists recurring_item_id bigint references public.recurring_items(id) on delete set null;

create index if not exists transactions_owner_recurring_idx
  on public.transactions(owner_id, recurring_item_id, date);

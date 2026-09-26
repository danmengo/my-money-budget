-- Allow non-spending recurring transfers such as automatic savings and investments.
alter table public.recurring_items
  drop constraint if exists recurring_items_type_check;

alter table public.recurring_items
  add constraint recurring_items_type_check
  check (type in ('expense', 'income', 'saving', 'investing'));

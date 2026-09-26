-- Each recurring rule can create at most one posted transaction on a given occurrence date.
create unique index if not exists transactions_recurring_occurrence_unique
  on public.transactions(owner_id, recurring_item_id, date)
  where recurring_item_id is not null;

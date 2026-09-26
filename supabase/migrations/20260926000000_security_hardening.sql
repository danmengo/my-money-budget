-- Security hardening pass for all user-owned tables.
-- Reassert RLS and privileges, tighten feedback identity, and rate-limit feedback inserts.

alter table public.transactions enable row level security;
alter table public.budgets enable row level security;
alter table public.goals enable row level security;
alter table public.settings enable row level security;
alter table public.recurring_items enable row level security;
alter table public.feedback enable row level security;
alter table public.admin_users enable row level security;

revoke all on public.transactions, public.budgets, public.goals, public.settings,
  public.recurring_items, public.feedback, public.admin_users from anon, public;

grant select, insert, update, delete on public.transactions, public.budgets,
  public.goals, public.settings, public.recurring_items to authenticated;
grant insert, select on public.feedback to authenticated;
grant select on public.admin_users to authenticated;

revoke all on sequence public.transactions_id_seq, public.goals_id_seq,
  public.recurring_items_id_seq, public.feedback_id_seq from anon, public;
grant usage, select on sequence public.transactions_id_seq, public.goals_id_seq,
  public.recurring_items_id_seq, public.feedback_id_seq to authenticated;

drop policy if exists transactions_owner on public.transactions;
create policy transactions_owner on public.transactions for all to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));

drop policy if exists budgets_owner on public.budgets;
create policy budgets_owner on public.budgets for all to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));

drop policy if exists goals_owner on public.goals;
create policy goals_owner on public.goals for all to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));

drop policy if exists settings_owner on public.settings;
create policy settings_owner on public.settings for all to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));

drop policy if exists recurring_items_owner on public.recurring_items;
create policy recurring_items_owner on public.recurring_items for all to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));

drop policy if exists feedback_insert_own on public.feedback;
create policy feedback_insert_own on public.feedback
  for insert to authenticated
  with check (
    owner_id = (select auth.uid())
    and (
      email is null
      or email = (select auth.jwt() ->> 'email')
    )
  );

drop policy if exists feedback_admin_read on public.feedback;
create policy feedback_admin_read on public.feedback
  for select to authenticated
  using (
    exists (
      select 1 from public.admin_users
      where admin_users.user_id = (select auth.uid())
    )
  );

drop policy if exists admin_users_read_self on public.admin_users;
create policy admin_users_read_self on public.admin_users
  for select to authenticated
  using (user_id = (select auth.uid()));

create or replace function public.enforce_feedback_rate_limit()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  perform pg_advisory_xact_lock(hashtext(new.owner_id::text));

  if exists (
    select 1
    from public.feedback
    where owner_id = new.owner_id
      and created_at > now() - interval '30 seconds'
  ) then
    raise exception using
      errcode = 'P0001',
      message = 'Please wait before sending more feedback.';
  end if;

  return new;
end;
$$;

revoke all on function public.enforce_feedback_rate_limit() from public, anon, authenticated;

drop trigger if exists feedback_rate_limit on public.feedback;
create trigger feedback_rate_limit
before insert on public.feedback
for each row execute function public.enforce_feedback_rate_limit();

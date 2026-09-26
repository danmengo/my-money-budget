-- Admin-only feedback inbox support.
alter table public.feedback
  add column if not exists email text;

create table if not exists public.admin_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.admin_users enable row level security;

revoke all on public.admin_users from anon;
grant select on public.admin_users to authenticated;

drop policy if exists admin_users_read_self on public.admin_users;
create policy admin_users_read_self
  on public.admin_users
  for select
  to authenticated
  using (user_id = (select auth.uid()));

grant select on public.feedback to authenticated;

drop policy if exists feedback_admin_read on public.feedback;
create policy feedback_admin_read
  on public.feedback
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.admin_users
      where admin_users.user_id = (select auth.uid())
    )
  );

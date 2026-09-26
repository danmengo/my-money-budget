# Account deletion verification

Scope: roadmap Phase 1, item 1. Keep this item open until the live checks pass.

## Automated checks

Run `pnpm test:account-deletion` with Node 22.13+.

These tests execute the account-deletion handler with fake Supabase clients. They
cover authentication, target-user isolation, confirmation validation, actual body
byte limits, upstream failures, hard deletion, and non-cacheable responses. They
do not verify live Supabase configuration, database cascades, or browser sign-out.

## Check the deployed database first (read-only)

Run this in the Supabase SQL editor. Expect all seven rows to say `CASCADE`.
A missing constraint is a failure: do not test deletion until it is corrected.
No migration is required by this change; existing migrations already specify
these relationships.

```sql
with expected(table_name, owner_column) as (
  values ('transactions', 'owner_id'), ('budgets', 'owner_id'),
         ('goals', 'owner_id'), ('settings', 'owner_id'),
         ('recurring_items', 'owner_id'), ('feedback', 'owner_id'),
         ('admin_users', 'user_id')
)
select e.table_name, e.owner_column,
       case when exists (
         select 1
         from pg_constraint c
         join pg_attribute a on a.attrelid = c.conrelid
                            and a.attnum = any(c.conkey)
         where c.contype = 'f'
           and c.conrelid = to_regclass('public.' || e.table_name)
           and c.confrelid = 'auth.users'::regclass
           and c.confdeltype = 'c'
           and a.attname = e.owner_column
       ) then 'CASCADE' else 'MISSING — investigate' end as deletion_rule
from expected e
order by e.table_name;
```

## Throwaway-account test

1. Use a separate browser profile and a new test email, never your primary or
   admin account. Prefer staging; if testing production, enter only fictional
   amounts and confirm the test email before proceeding. Record the test user's
   UUID from Supabase Authentication > Users.
2. Create an expense, income, saving, investing, a budget, a goal, and a recurring
   item. Confirm settings exist. Submit one clearly labeled test feedback message
   manually if you want to verify feedback cleanup. Do not grant the account
   admin rights for this test.
3. Run the row-count query below with the test UUID. Record the counts. Every
   populated table must become zero after deletion. A table that starts at zero
   is not a tested cascade; `admin_users` is checked structurally above.
4. Open the same test account in a second browser session. Leave it open to
   check stale-session behavior after deletion.
5. In Settings > Account controls, test Cancel and an incorrect confirmation.
   Neither should delete anything. Then type `DELETE` and submit once.
6. Expect a return to sign-in. In Supabase Authentication > Users, confirm the
   recorded UUID no longer exists. Rerun the count query; all counts must be zero.
7. Reload the second session and try loading/saving data. Expect access to be
   denied; the deleted account must not recreate data. Confirm another test
   account's data is unchanged.
8. Signing in again with the deleted email may create a new account. If tested,
   confirm it has a new UUID and none of the old data. Clean up only that new test
   account through the normal deletion flow.

Replace the placeholder UUID, keeping the quotes. This query only reads data.

```sql
with test_account as (select 'REPLACE_WITH_TEST_USER_UUID'::uuid as id)
select 'transactions' as table_name, count(*) as remaining_rows
from public.transactions where owner_id = (select id from test_account)
union all select 'budgets', count(*) from public.budgets
where owner_id = (select id from test_account)
union all select 'goals', count(*) from public.goals
where owner_id = (select id from test_account)
union all select 'settings', count(*) from public.settings
where owner_id = (select id from test_account)
union all select 'recurring_items', count(*) from public.recurring_items
where owner_id = (select id from test_account)
union all select 'feedback', count(*) from public.feedback
where owner_id = (select id from test_account)
union all select 'admin_users', count(*) from public.admin_users
where user_id = (select id from test_account);
```

## Failure checks and limits

- Missing server secret: the API should return 503 without changing data. Test
  this locally/staging; do not remove a production secret to test it.
- Invalid/expired token: 401, with no privileged deletion request.
- Upstream deletion failure: generic 500, no success redirect, and retry remains
  available. Simulate this in automated tests or staging.
- Supabase notes that an issued JWT can remain valid until expiry even after
  user deletion. The app APIs verify the user with `getUser(token)` on each
  request. Test both the stale app session and database cleanup; do not equate
  JWT signature validity with a still-existing user.
- Supabase Storage object ownership can block user deletion. This app has no
  upload feature today. Revisit the deletion flow before adding uploads.

References:
- https://supabase.com/docs/reference/javascript/auth-admin-deleteuser
- https://supabase.com/docs/guides/auth/managing-user-data

## Evidence to record

Record commit/deployment, date, environment, automated test result, cascade check,
before/after counts, auth-user removal, second-session result, and unaffected
control-account result. Never record access tokens, secrets, or real finances.

Current status: automated handler tests added; live throwaway-account verification
pending. No production account was deleted while preparing this change.

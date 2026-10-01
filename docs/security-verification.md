# Phase 1 security verification

Reviewed October 1, 2026 UTC (September 30 Pacific), starting at commit
`23cbd0897dd8061bcf2ae177bb357d5b679fba08`.

## Verified

- Production homepage responds with CSP, HSTS, X-Content-Type-Options,
  X-Frame-Options, Referrer-Policy, and Permissions-Policy.
- `pnpm test:security`: 46 passing tests. Account deletion tests use fake
  Supabase clients; admin/data handler tests execute the actual TypeScript
  handlers with mocked SDK and framework boundaries. They do not prove live RLS.
- Admin handler denies unauthenticated/invalid users (401), ordinary users (403),
  and failed membership lookups (500), without querying feedback. Admin access
  is derived from the verified user ID, using the caller's token and public key.
- All seven user-owned tables have RLS and auth-user deletion cascades in the
  committed migrations. Deployment of those migrations remains to be checked.
- Cloudflare production build and focused ESLint pass.

## Fixed in this change

The data API previously trusted Content-Length and read JSON after initialization
and recurring processing. It now limits actual streamed bytes to 16 KiB and
rejects malformed JSON, arrays, null, and scalar values before any database work.
Rejections return generic, non-cacheable 400/413 responses. Account deletion keeps
its existing, separately tested 2 KiB limit.

## Still requires live verification

- Automated API probes were blocked at Cloudflare with HTTP 403 / error 1010.
  These responses are NOT evidence that application authorization passed.
- In a separate browser profile signed in as a non-admin, open
  `/admin/feedback`. Expect "Admin access required" with no messages. Inspect
  the API request if needed: it must return 403. Signed-out access must return
  401 from the API. The public page shell is not financial or feedback data.
- Run the read-only SQL below in Supabase SQL Editor. Expect seven rows with
  RLS enabled, anonymous SELECT disabled, and a deletion cascade. This checks
  structural configuration, not cross-user policy behavior.
- Test cross-user isolation with two throwaway accounts, plus deletion using
  [the deletion verification procedure](account-deletion-verification.md).
- Review actual Supabase redirect allowlist and Google OAuth production settings
  in their dashboards. Source code alone cannot verify them.
- CSP still allows inline scripts/styles. Nonce-based tightening is future work;
  presence of the header is not a complete XSS audit.

```sql
with expected(table_name, owner_column) as (
  values ('transactions', 'owner_id'), ('budgets', 'owner_id'),
         ('goals', 'owner_id'), ('settings', 'owner_id'),
         ('recurring_items', 'owner_id'), ('feedback', 'owner_id'),
         ('admin_users', 'user_id')
)
select e.table_name,
       coalesce(c.relrowsecurity, false) as rls_enabled,
       has_table_privilege('anon', c.oid, 'SELECT') as anonymous_select,
       exists (
         select 1 from pg_constraint fk
         join pg_attribute a on a.attrelid = fk.conrelid
                            and a.attnum = any(fk.conkey)
         where fk.contype = 'f' and fk.conrelid = c.oid
           and fk.confrelid = 'auth.users'::regclass
           and fk.confdeltype = 'c' and a.attname = e.owner_column
       ) as deletion_cascades
from expected e
left join pg_class c on c.oid = to_regclass('public.' || e.table_name)
order by e.table_name;
```

Never paste tokens, secret keys, or personal financial rows into verification
reports. The structural query above returns no user records.

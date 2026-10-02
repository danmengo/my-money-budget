# Phase 2 implementation

Supabase Auth/Postgres, the existing user-token data API, Cloudflare Workers, and GitHub deployment remain in place. No new tables, grants, privileged clients, or SQL migrations were needed.

## Category rollover

Budget > Edit limit now saves a monthly base limit and one mode: none, unused amounts forward, or overspending forward. Settings use `plan:budget:<encoded category>:YYYY-MM` with JSON `{amount,rollover,reset?}`. Changes apply from that month until another change. The existing `budgets` table is the legacy baseline and is no longer overwritten by limit edits.

Unused mode carries `max(0, effective allowance - recorded spending)`. Overspending mode carries `min(0, effective allowance - recorded spending)`, potentially making the following allowance negative. Turning rollover off clears incoming carry. Reset budget writes zero limits and reset markers from the selected month; previous history remains. Editing earlier transactions or plans recalculates later balances.

Category rollover changes category allowances only. It does not create cash or income. It is distinct from month-end cash carry-forward. Months before a category's first saved plan use the legacy baseline; historical values from before tracking cannot be reconstructed. Investing budgets retain the app's existing convention of using investing transactions.

## Dashboard

Overview adds safe-to-spend, remaining recurring expenses, upcoming payments/bills due within seven days, month progress, largest expense category, and category health. Schedules respect start dates, day clamping, paused/ended state, date/count endings, and already-posted monthly occurrences. Count forecasts include intervening unposted months.

Safe-to-spend is available only for the current month. It uses recorded income and outflows through today, plus cash carry, less unposted recurring outflows and future-dated outflows already entered. Future income and planned income are excluded. Scheduled records already in Transactions are not counted twice. Negative availability displays zero spendable plus a shortfall. The UI explains that this is not a bank balance and does not reserve unused category limits or unknown bills.

## Goals and transactions

Transactions, surplus allocation, and recurring saving/investing forms have an optional matching goal selector. New goals default to automatic tracking; existing goals remain manual. Automatic progress is the stored manual/starting balance plus linked saving/investing transactions through today. Editing, deleting, and unlinking entries recalculates progress; goal progress is never incremented as a side effect of reading data. Manual mode retains associations without adding them to progress. Goal type becomes immutable to avoid reinterpreting existing links.

Owner-private settings store metadata:
- `plan:goal-mode:<goal id>`: `manual` or `linked`.
- `plan:tx-goal:<transaction id>`: goal ID or `0` for explicit unlink.
- `plan:recurring-goal:<recurring id>:YYYY-MM`: goal ID or `0`, effective for future unposted occurrences after already-recorded history.

Recurring links are resolved from effective-dated rules. Explicit transaction choices override those rules. Deleting a recurring rule materializes its historical goal associations before deleting it, preserving progress. Deleting a goal makes its associations inert without deleting financial transactions. Full JSON export includes raw planning settings and enriched records.

All link validation uses the verified session owner and matching goal type. Existing settings RLS and account-deletion cascades cover new preferences. Metadata and financial records are separate writes: if a record saves but optional metadata fails, the API returns success plus a specific warning, and the UI closes the saved form rather than inviting a duplicate. Do not claim these multi-write operations are database-atomic. Retrying after a completely lost network response remains a general existing transaction-entry limitation.

## Verification

- `pnpm test:phase2`: 35 financial-calculation, API, lifecycle, and real-component render tests.
- `pnpm test:security`: 51 account-deletion, malformed-input, owner/access, and request-limit tests.
- `pnpm exec tsc --noEmit --incremental false`: type checking.
- `pnpm build:cloudflare`: production build.
- API tests execute actual handlers against a synthetic in-memory Supabase boundary. They do not replace live cross-user RLS testing.

Signed-in production checks still need user confirmation: change a category's rollover; review the next month's allowance; inspect due items; create/link/edit/delete a small saving transaction in an automatic goal; confirm progress and exports. Do not create or delete real financial records merely to run a test without the user's direction.

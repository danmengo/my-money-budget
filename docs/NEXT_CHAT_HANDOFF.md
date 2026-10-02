# My Money — next-chat handoff during Phase 3

## User preferences

Work autonomously on one feature at a time. Keep the existing architecture and UX; avoid unrelated redesigns. Prioritize owner isolation, validation, clear financial calculations, and reversible actions. At the end of every phase, produce an updated copy-and-paste handoff so the user can start a fresh chat. Never put secrets or credentials in a handoff.

## Project and deployment

- Repository: https://github.com/danmengo/my-money-budget
- Production: https://budget.danmengo.com
- Supabase project URL: https://wpsugoslgaarnmxvuenj.supabase.co
- Stack: React/Next-style application built with Vinext/Vite, Supabase Auth/Postgres, Cloudflare Workers.
- Worker: `my-money-budget`. Merging GitHub `main` triggers Cloudflare Workers Builds.
- Always fetch current `main` before editing; do not rely on old local worktrees or overwrite unrelated changes.
- Use an isolated branch/worktree, validate, merge, and verify Cloudflare's check plus production headers. User has authorized implementation and deployment in this project; avoid repetitive permission prompts.
- No Supabase secret is needed for financial data changes. The data API uses the caller's token and RLS.

## Completed

Core app: OTP email and Google auth; private transactions; monthly budgets/custom categories; recurring expense/income/saving/investing with lifecycle controls; saving/investing goals; analytics; exports; privacy; feedback/admin inbox; settings/themes; account deletion; reset budget.

Security/trust work:
- Deletion flow hardened and tested with a throwaway account. User reported auth and financial-table counts all zero afterward.
- User verified non-admin feedback access is blocked.
- Structural SQL checks showed RLS enabled, anonymous SELECT revoked, and deletion cascades on the seven relevant tables.
- Request byte limits and malformed-input checks occur before data writes. Generic production errors and no-store API responses remain.
- CSP, HSTS, nosniff, frame denial, referrer policy, and permissions policy were checked on production.
- Google redirects were reviewed with the user; Supabase redirects to the app root, Google OAuth redirects to the Supabase `/auth/v1/callback`. Google account chooser uses `prompt: select_account`.
- Resend SMTP and OTP email templates were configured by the user. The app uses an 8-digit code.
- Terms of Use deployed at `/terms`, linked from sign-in/Settings/Privacy (PR #11).

Phase 2 features:
1. Month-end review, previous-month prompt, summary/highlights, savings/investing allocation, reversible cash carry or unallocated choice, next-budget navigation (PR #12).
2. Category rollover: none, unused forward, overspending forward; effective-dated monthly category plans preserve future history.
3. Overview: upcoming bills/payments, recurring commitments, safe-to-spend calculation, month progress, largest category, budget health.
4. Goal integration: optional links on saving/investing transactions and recurring items; derived automatic progress plus starting/manual balance; manual mode retained.

Read `docs/month-end-review.md` and `docs/phase2-implementation.md` before changing these calculations. New Phase 2 metadata lives in existing owner-private settings; no migrations were required.

## Important behavior

- Currency is integer cents.
- Category rollover is a spending allowance, not cash. Month-end carry is a separate cash-planning balance, never income. Do not count either twice.
- Historical dates before monthly category-plan tracking use the legacy base; exact old limits cannot be reconstructed.
- Safe-to-spend excludes planned/future income and reserves known recurring/future outflows, but not unknown bills or unused discretionary category limits. UI explains this.
- Automatic goal progress is derived, not incremented during GET. Existing goals stay manual unless changed. Avoid double-counting the starting/manual balance and linked transactions.
- Recurring goal changes affect future unposted occurrences. Editing a posted transaction can override its goal.
- Optional metadata failure after a successful financial write returns a warning, not a failed-save prompt. Writes are not fully atomic; this limitation is documented.
- Full JSON export includes planning preferences. Privacy/export/deletion must remain free.
- At month changes, the app filters transactions by the selected month. The user's earlier missing-data scare was September versus October, not data loss.

## Validation and remaining checks

Phase 2 tests: `pnpm test:phase2` (35). Security tests: `pnpm test:security` (51). Use `pnpm exec tsc --noEmit --incremental false` and `pnpm build:cloudflare`. Existing dashboard hook lint findings may remain; compare with baseline instead of refactoring unrelated state.

Live signed-in verification of the new Phase 2 flows still needs user confirmation. Automated owner checks use synthetic Supabase boundaries; a dedicated two-account production RLS isolation test is still outstanding. Do not claim a complete security audit. OAuth scopes were not independently audited. Terms should receive legal review before wider launch.

Support/contact from Phase 1 was deferred when the user asked to move directly to Phase 2. No support mailbox was invented. Keep it visible in the backlog.

## Current phase: Phase 3 — analytics

Implement one feature at a time in this order:
1. Historical analytics — implemented. Read `docs/historical-analytics.md` for behavior and verification limitations.
2. Date ranges: this month, last month, last 3/6 months, year to date, custom.
3. Monthly comparisons.
4. Savings/investing rates.

Historical analytics adds a 12-month chart/table, older/newer navigation, and month drill-down using the shared filters. See `lib/historical-analytics.ts` and `app/historical-analytics.tsx`. `pnpm test:analytics` adds 8 passing tests; existing 35 Phase 2 and 51 security tests, type checking, and Cloudflare build passed. Browser visual/interaction verification is outstanding because the browser download failed. This is a partial-phase checkpoint, not completion of Phase 3.

Next implement date range presets and custom dates as one feature. Inspect existing Analytics filters, integer-cent totals, category-plan history, and cash-carry semantics. Keep earned income separate from carried funds. Define and test zero-income and deficit behavior before showing rates. Reuse the current design and filters.

After Phase 3, provide another handoff. Later phases: admin feedback status/user counts/app health; then pricing/entitlements/Stripe; then CSV import, notifications, bank connections, and shared budgets. Do not broaden scope without user direction.

## Budget Builder feature (separate from Phase 3)

The user requested rule-based budget help and templates. Budget → Help me plan my budget now includes Balanced, Savings focused, Essentials first, and Build my own. Read `docs/budget-builder.md` before changing it.

- Guided commitments → editable amounts → old/new preview and acknowledgement.
- High fixed costs reduce flexible extras; true deficits remain visible.
- Limits, planned income, and a savings reserve save together in one owner-private settings upsert, effective from the selected month. Earlier/future plans and rollover modes stay intact.
- `plan:income:YYYY-MM` and `plan:saving:YYYY-MM` are new settings. JSON export includes them. Income editing is now effective-dated; budget reset clears the reserve too.
- Savings reserve is a plan only. Actual goal contributions use existing transaction linking; no automatic goal progress or extra cash is created.
- `pnpm test:budget-builder` covers calculations, component events, and the real API with synthetic Supabase. Browser downloads remain unavailable; signed-in visual/interaction verification is outstanding.
- This feature does not complete or replace the remaining Phase 3 analytics work above.

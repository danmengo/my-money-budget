# My Money — next-chat handoff after Phase 3

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

## Completed Phase 3 — analytics

1. Historical analytics: 12-month chart/table, filters, older/newer navigation, and month drill-down (PR #14).
2. Date range presets (this month, last month, last 3/6 months, year to date) and validated inclusive custom dates.
3. Monthly comparisons with exact period boundaries, current-month elapsed-day handling, and safe zero/negative-baseline behavior.
4. Saving, investing, and combined allocation rates with explicit zero-income, over-100%, and deficit explanations.

Read `docs/phase3-implementation.md` and `docs/historical-analytics.md` before changing Analytics. Range activity, unfiltered range allocation rates, selected-month comparison, and selected-month cash balance have explicitly different scopes. Preserve those scopes or intentionally redesign and test them together. Do not count carry as income, average monthly percentage rates, or let expense filters erase a rate's income denominator.

`pnpm test:analytics`, `pnpm test:phase2`, `pnpm test:security`, type checking, and the Cloudflare production build passed for this implementation. Browser visual/click checks remain outstanding because browser downloads returned invalid archives. Signed-in production review and dedicated live cross-user RLS testing also remain outstanding. Feature implementation is complete; this is not a claim that every live verification is complete.

## Next phase

Start Phase 4 with admin feedback statuses, then user counts, then app health, one feature at a time. Inspect the current admin authorization and feedback schema first. Use server-verified admin access for all aggregate or cross-user data. Never expose email addresses or financial records merely to show user counts or app health. Keep support/contact deferred unless the user reopens it.

Later: pricing/entitlements/Stripe; then CSV import, notifications, bank connections, and shared budgets. Other conversations may be working on budget templates; fetch current main and preserve any parallel work. Do not broaden scope without direction.

At the end of the next phase, update this handoff and provide a copy-and-paste prompt for a fresh chat.

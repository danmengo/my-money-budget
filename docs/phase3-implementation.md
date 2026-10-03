# Phase 3 — Analytics

Implemented features: historical analytics, date ranges, monthly comparisons, and saving/investing allocation rates. Existing Supabase owner-scoped data, integer-cent amounts, Cloudflare deployment, and GitHub workflow remain. No new endpoint, database write, migration, authorization rule, or privileged client was added.

## Date ranges and scope

- Analytics defaults to the full month selected in the global month control. Existing recorded future-dated entries in that month remain included.
- This month runs from the current local month's first day through today. Last month is the complete previous calendar month. Last 3/6 months include the current month and end today. Year to date starts January 1 and ends today.
- Custom dates are inclusive, validated for real calendar dates and start ≤ end, and limited to 120 calendar months for readable/bounded history. Results remain on the last applied dates while the user edits invalid/unapplied drafts. Custom ranges can include recorded future entries.
- Range selection is local UI state. Changing the global month or selecting a history row resets to Selected month. Leaving and reopening Analytics also returns to Selected month. Type/category/source filters are preserved separately by the dashboard.
- Date ranges apply to activity cards, category mix, money flow, allocation rates, and history. Selected month retains the original 12-month history context with older/newer navigation; other presets/custom ranges show only the months and exact date boundaries within that range. Partial boundary months are labeled.
- Monthly comparison and cash balance have separate, explicit scopes tied to the global selected month. The available cash balance and allocation actions remain full-month, unfiltered, and include the existing cash-carry choices. They are not recalculated by summing carry across a date range.

## Monthly comparisons

The global selected month is compared to its previous calendar month, using identical type/category/source filters. Completed months compare full calendar months. The current month compares from day 1 through today against day 1 through the same numbered day in the previous month (capped at its last day). The exact date ranges are shown; different month lengths can produce different day counts. Future months do not show a comparison.

Dollar change = selected amount − previous amount. Percent change uses the previous amount only when it is positive. Zero or negative baselines display a dash for percent change. If either period has no matching recorded entries, changes show dashes rather than suggesting verified zero activity. Values describe recorded activity, not proof of complete records or financial improvement.

## Savings/investing rates

- Saving rate = recorded saving contributions / recorded income × 100.
- Investing rate = recorded investing contributions / recorded income × 100.
- Combined allocation rate = (saving + investing contributions) / recorded income × 100.
- Rates use all activity in the applied date range, explicitly ignoring activity filters. This prevents an expense-only filter from erasing the income denominator. Amounts and denominator are displayed.
- Income ≤ 0 yields unavailable rates with visible contribution amounts. Empty periods have an explicit empty message. Rates above 100% are not clamped; the UI explains possible earlier balances or missing income. A negative net activity shows a deficit explanation even when contribution rates are positive.
- Amounts remain integer cents; division is used only for rates, displayed to one decimal place. Multi-month rates use summed amounts, not averages of individual monthly percentages.
- Carry, category rollover, goal starting balances, planned income, and unposted recurring schedules are excluded. These are contribution/allocation rates, not investment returns, account growth, or a claim of actual bank funds.

## Implementation and verification

- `app/analytics-view.tsx` contains the existing Analytics presentation extracted from the dashboard, with focused components for range controls, comparisons, and rates.
- `lib/analytics-periods.ts` contains date validation, presets, period totals, comparisons, and rates. `lib/historical-analytics.ts` supports optional exact range boundaries for history.
- `pnpm test:analytics` passes: original history tests plus date/rate/comparison and real-component rendering tests. Coverage includes inclusive bounds, invalid/leap dates, year transitions, partial/current periods, zero/negative denominators, weighted multi-month rates, filtering, deficits, corrections, carry separation, and empty states.
- `pnpm test:phase2`, `pnpm test:security`, `pnpm exec tsc --noEmit --incremental false`, and `pnpm build:cloudflare` passed. Existing framework import/chunk warnings remain.
- Browser visual/click verification remains outstanding. A fresh browser install was attempted, but the download returned invalid archives. Server-render tests validate real component output, not browser interactions, chart appearance, or responsive layouts.
- Signed-in production verification and dedicated two-account live RLS tests remain outstanding. Automated API tests use synthetic boundaries and are not a complete security audit.

Suggested signed-in review: select each range preset, apply a custom range spanning two partial months, reject reversed dates, reset filters, drill into history, check comparison dates, and check no-income/high-allocation periods. Inspect mobile and light/dark/custom themes. Do not modify real financial data solely for verification without user authorization.

Phase 3 feature implementation is complete, with the verification limitations above. Phase 1 support/contact remains deferred. The next planned phase is admin feedback statuses, user counts, and app health; inspect current main for parallel changes before starting.

# Phase 3, feature 1 — historical analytics

Phase 3 is now implemented. See `docs/phase3-implementation.md` for date ranges, comparisons, rates, and the updated history behavior below. The original selected-month mode retains its twelve-month context; other ranges use their explicit boundaries.

Analytics now includes Monthly history: twelve calendar months ending at the selected month (capped at the current local month), a grouped income/stacked outflow chart, and an accessible table with exact amounts. Older/Newer months page twelve months at a time. Selecting a row opens that month's existing Analytics detail by changing the shared month selector; current filters are preserved. The year window follows the selected month.

## Calculation contract

- Uses all owner-scoped, paginated transactions already returned by the authenticated data API. No new endpoint, persistence, migration, elevated client, or writes.
- Aggregates recorded income, expense, saving, and investing separately in integer cents. Net activity = income − expenses − saving − investing. Deficits remain negative; zero income requires no division.
- Cash carry, category rollover, planned income, goal starting balances, and unposted recurring schedules are excluded. Net activity is not a bank balance or available surplus. Existing selected-month cash-carry calculations are unchanged.
- Existing Analytics type/category/source filters apply to history and selected-month activity via a shared predicate. Filtered net is explicitly labeled; it is not the full month's net.
- Recorded dates control grouping. Current-month totals include future-dated transactions already entered, matching the existing monthly Analytics convention. This is explained alongside the in-progress label. Future months are not included in historical charts.
- Empty calendar gaps remain visible. A month with no matching records displays dashes, with distinct labels for no recorded entries versus no filter matches. Chart gaps are zero-height but are not assertions of verified zero activity.
- Corrections/deletions recalculate from current records. This is not an immutable historical snapshot. Budget limits are not used, avoiding unsupported reconstruction of pre-tracking limits.

## Verification

- `pnpm test:analytics`: 8 tests, including exact cents, deficits/zero income, filters, empty gaps, year/leap-day boundaries, >1,000 records, edits/deletions, and real-component table/empty/navigation rendering.
- `pnpm test:phase2`: 35 tests passed.
- `pnpm test:security`: 51 tests passed (synthetic boundaries, not live RLS verification).
- `pnpm exec tsc --noEmit --incremental false` passed.
- `pnpm build:cloudflare` passed; existing framework import/chunk warnings remain.
- Browser visual/interaction verification could not run: no browser executable was installed and the browser download returned invalid archives. Real React server-render tests do not validate chart layout or browser clicks.
- Signed-in production review and two-account live RLS verification remain outstanding. Suggested manual check: Analytics > Monthly history; check light/dark and narrow layouts, filter by expense/category/recurring, open an older month, and compare its exact values with Transactions. Do not create test financial records in a real account without authorization.

## Phase 3 completion

Date ranges, monthly comparisons, and saving/investing rates are implemented. `docs/phase3-implementation.md` is authoritative for their semantics. Browser visual/click checks, signed-in production review, and live two-account RLS verification remain outstanding. Phase 1 support/contact stays deferred.

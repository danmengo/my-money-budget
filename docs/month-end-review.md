# Month-end review

The Month-end review navigation item opens the previous completed month. The Overview prompt also opens that month, and the existing month arrows select other months.

## Accounting behavior

- Income, expenses, savings, and investments use recorded transactions in the selected calendar month, in integer cents. Planned income and unposted recurring schedules are excluded.
- Monthly surplus is income less expense, saving, and investing transactions.
- Recurring highlights group posted expense transactions by recurring item ID. They do not substitute today's recurring rule for historical amounts.
- Over-budget categories use effective monthly limits including category rollover and the existing Investing category behavior. Zero means no limit unless carried overspending creates a deficit. Months predating plan history use the legacy base and are labeled accordingly.
- Savings/investing actions reuse the existing transaction form and write to the reviewed month. They do not move bank funds or update manually tracked goals.
- Carry-forward uses the full positive balance after activity and incoming carry. It is not income and creates no transaction. It appears separately in Overview, Analytics, Budget, and the review.
- Carry recomputes if earlier transactions or choices change. Deficits never carry automatically; choosing Leave unallocated stops the carry chain. Undoing carry can change later balances, as explained before confirmation.
- Starting the next budget opens the next month with its effective category limits and rollover. It does not reset data. Monthly configuration changes are stored as effective-dated preferences.

## Storage and access

Choices are stored as `settings` rows with key `month_review:YYYY-MM` and value `carry` or `unallocated`. The existing `(owner_id, key)` primary key makes repeated choice saves replace the same preference. Existing settings RLS and account-deletion cascade apply; no migration or elevated key is needed.

The authenticated API validates the completed month and choice before initialization writes, derives the owner from the verified session, and returns no-store responses. Calendar completion uses the browser's validated time zone. Malformed stored preferences are ignored.

Transaction and review-preference reads are paginated with stable ordering, preventing summaries from silently dropping records beyond Supabase's first page. Full data export includes review preferences; CSV remains an export of actual transactions only.

## Verification

- `pnpm test:month-review`: real component rendering, empty/progress states, currency totals, historical recurring activity, deficits, no-limit categories, Investing limits, year transitions, carry chains, corrections/undo, malformed settings, pagination, and authenticated owner-scoped API writes.
- `pnpm test:security`: existing account deletion, API access, and request size protections plus review request validation.
- `pnpm build:cloudflare`: production artifact.
- Live authenticated review interactions require a signed-in user; the automated API tests use synthetic data and a mocked Supabase boundary.

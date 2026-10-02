# Budget Builder

## User flow

Budget → **Help me plan my budget** opens a three-step guided setup:

1. Enter take-home income, choose Balanced (50/30/20), Savings focused (50/20/30), Essentials first, or Build my own. Review recurring commitments and category groups; add missing fixed costs.
2. Adjust category limits and a separate savings reserve. The builder shows income, assigned funds, remaining funds/shortfall, commitment share, and below-commitment warnings.
3. Review old/new base limits, income, and savings reserve. Explicit acknowledgement is required before Apply. Saving errors retain the draft; cancelling writes nothing.

**Adjust with builder** starts in Build my own mode, retaining current category limits. Percentages are editable starting points through the dollar amounts, not requirements. New/unknown categories initially use Wants and can be regrouped for the suggestion. No AI service is used.

## Financial behavior

- All calculations and the batch API payload use integer cents. Dollar inputs reject negatives, exponents, fractional cents, blanks, and values over $1,000,000.
- Balanced and Savings focused reserve entered commitments first, allocate the remaining targets, and reduce extra Wants, then extra Saving, then extra Needs when required. Actual commitments are never reduced automatically. If commitments exceed income, the shortfall remains visible. Missing expense buckets leave their allocation unassigned.
- Essentials first assigns only commitments and leaves the remainder for the user. Build my own retains current category base limits.
- Extra future allocation starts in the savings reserve. Users can move it to the Investing category. Investing commitments consume the future allocation once. Debt payments belong in the user's expense categories; no debt payoff schedule is invented.
- Recurring suggestions combine posted recurring transactions in the selected month and pending scheduled occurrences. Existing schedule logic handles date/count endings, paused items, day clamping, and intervening future occurrences. Posted payments are not counted twice. Suggestions are editable and do not represent every possible bill.
- Applying changes category base limits from the selected month until each category's next saved change. Prior history, future dated plans, rollover modes, and same-month reset markers are preserved. Rollover may make actual category allowances differ from the builder's base limits.
- Planned income and saving targets follow the same effective-month behavior. Income editor now writes a monthly plan; legacy `monthly_income` is the fallback before the first income plan.
- The savings reserve is included in Budget's assigned/available-to-allocate figures. It is a planning target, not income, a transaction, cash carry, or goal progress. Safe-to-spend continues to use recorded cash and known scheduled outflows; it does not additionally reserve unscheduled budget targets.
- Contributions are recorded through the existing saving/investing transaction forms, where users can link them to goals. Builder does not allocate to individual goals or increment their balances.
- Budget reset also clears the savings reserve from the selected month. Zero category limits retain the existing “No limit set” convention.

## Storage and access

No migrations or new privileged credentials are needed. The existing authenticated, caller-token API and owner-private settings RLS are used.

`budgetBuilder` validates month, integer cent amounts, duplicate/unknown categories, and a complete current set of budget rows. Limits, `plan:income:YYYY-MM`, and `plan:saving:YYYY-MM` are written in one settings upsert statement. Repeated submissions replace the same keys. The builder action skips automatic recurring posting so applying a plan does not create financial transactions. Reads after a successful write may still fail; retrying this idempotent action is safe. Concurrent category edits are checked before the write, not locked across requests.

Full JSON export already includes planning settings. Category-group choices and edited commitment estimates are draft-only; they do not change recurring rules. No separate one-month-only scope or one-click undo is included; users can revise limits/reserve again from the same month.

## Verification

- `pnpm test:budget-builder`: nine calculation/validation tests, four actual-component flow tests, plus ten shared Phase 2 API tests (four new builder/income cases).
- `pnpm test:security`: existing checks plus six malformed builder requests rejected before database access.
- `pnpm test:phase2` and `pnpm test:analytics`: regression suites.
- `pnpm exec tsc --noEmit --incremental false` and `pnpm build:cloudflare`.

The component tests use a deterministic hook harness to exercise the actual event handlers. They verify preview, acknowledgement, exact payload, invalid input, failure retention, cancel, empty categories, and busy state. They do not replace browser rendering/focus/mobile checks. API tests use a synthetic Supabase boundary; they do not replace live two-account RLS testing.

Browser visual verification was unavailable because both browser downloads returned an unavailable-site response. Signed-in production verification remains: open Budget Builder; review a template; cancel and confirm no changes; apply a desired plan; reload; inspect previous/next months, rollover, reserve, and the JSON export.

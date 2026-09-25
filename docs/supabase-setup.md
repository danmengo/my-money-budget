# Supabase setup for My Money

Project URL: `https://wpsugoslgaarnmxvuenj.supabase.co`

The publishable key is in `.env.example`. It can be exposed to the browser; database passwords, connection strings, and `sb_secret_` keys must remain private.

## Database

Applied `supabase/migrations/20260925000000_budget_schema.sql` in the project's SQL Editor on September 25, 2026. It created empty budget tables with row level security and owner policies. A verification query confirmed all four tables have RLS enabled, one owner policy each, and no anonymous SELECT privilege. Do not run the create-table script again; this SQL Editor execution is not recorded in Supabase CLI migration history.

## Authentication

1. Under Authentication > URL Configuration, set **Site URL** to the final app origin (for example `https://budget.danmengo.com`). Add the exact local and preview origins as redirect URLs when those URLs exist.
2. Keep **Confirm email** enabled. For email codes, edit both **Confirm signup** and **Magic Link** email templates to display `{{ .Token }}`; the app calls `signInWithOtp` and `verifyOtp` with `type: 'email'`. Configure custom SMTP before inviting real users; the default mail service is intended for testing and has restrictions.
3. Under Authentication > Providers > Google, enable Google and enter the OAuth client ID and secret created in Google Cloud Console. In Google's OAuth client, the **authorized redirect URI** is `https://wpsugoslgaarnmxvuenj.supabase.co/auth/v1/callback`. Store the client secret in Supabase, never in GitHub.
4. Protect your Supabase account with MFA. Leave signups open if the app is intended for multiple users; each budget table has a policy limiting access to `auth.uid()`.

## Deployment and migration

The existing private Site remains on its managed D1 database and ChatGPT sign-in. The GitHub copy contains a separate Supabase auth/data path that activates only with the `NEXT_PUBLIC_SUPABASE_*` variables. The standalone Worker builds with `pnpm build:cloudflare`; its output is `dist/server/wrangler.json` and `dist/client`. A Cloudflare Git build must set both public variables from `.env.example` in its build environment and run `pnpm build:cloudflare` followed by `pnpm exec wrangler deploy --config dist/server/wrangler.json`. Deploy initially to a preview URL, then set the exact origin in Supabase Authentication > URL Configuration before sign-in testing.

As checked on September 25, 2026, the current D1 contains 14 unclaimed demo transactions, 8 unclaimed demo budgets, 2 unclaimed demo goals, and one demo initialization marker. It contains no personal user-owned records. Therefore there is no personal data migration to run now. The new Supabase account starts with empty transactions and goals and the standard eight category budgets. If personal data is added to the old Site before cutover, export all four tables again, map the old owner's records to the new `auth.users.id`, import with preserved cent amounts, and verify totals and ownership before moving the domain. Do not paste a database export into GitHub.

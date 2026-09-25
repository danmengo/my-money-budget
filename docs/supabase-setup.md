# Supabase setup for My Money

Project URL: `https://wpsugoslgaarnmxvuenj.supabase.co`

The publishable key is in `.env.example`. It can be exposed to the browser; database passwords, connection strings, and `sb_secret_` keys must remain private.

## Database

Run `supabase/migrations/20260925000000_budget_schema.sql` once in the project's SQL Editor. It creates the budget tables with row level security, owner policies, and no anonymous table privileges. This migration creates empty tables; it does not import records from the current Site.

## Authentication

1. Under Authentication > URL Configuration, set **Site URL** to the final app origin (for example `https://budget.danmengo.com`). Add the exact local and preview origins as redirect URLs when those URLs exist.
2. Keep **Confirm email** enabled. For email codes, edit both **Confirm signup** and **Magic Link** email templates to display `{{ .Token }}`; the app calls `signInWithOtp` and `verifyOtp` with `type: 'email'`. Configure custom SMTP before inviting real users; the default mail service is intended for testing and has restrictions.
3. Under Authentication > Providers > Google, enable Google and enter the OAuth client ID and secret created in Google Cloud Console. In Google's OAuth client, the **authorized redirect URI** is `https://wpsugoslgaarnmxvuenj.supabase.co/auth/v1/callback`. Store the client secret in Supabase, never in GitHub.
4. Protect your Supabase account with MFA. Leave signups open if the app is intended for multiple users; each budget table has a policy limiting access to `auth.uid()`.

## Deployment and migration

The existing private Site remains on its managed D1 database and ChatGPT sign-in. The GitHub copy contains a separate Supabase auth/data path that activates only with the `NEXT_PUBLIC_SUPABASE_*` variables. Provision a standalone Cloudflare Worker build before linking the repo for automatic deploys. Export existing records from D1 and import them for the matching Supabase user after that user signs up. Verify the imported totals and ownership before moving the domain. Do not paste a database export into GitHub.

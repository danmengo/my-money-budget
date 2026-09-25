# My Money

Budgeting app for income, expenses, category limits, and savings goals.

## Status

The existing private [live Site](https://daniel-budget-tracker.danmengo.chatgpt.site) still uses ChatGPT sign-in and its managed Cloudflare D1 database. GitHub changes do not automatically deploy to that Site.

The Supabase login and data path is prepared in source. The schema was applied to Daniel's Supabase project on September 25, 2026, and all four tables were checked for RLS and anonymous access. Google OAuth, email templates, and standalone Cloudflare hosting still need setup. The old database contains only unclaimed demo records, so there is no personal data to migrate. Follow [the Supabase setup guide](docs/supabase-setup.md). Do not place budget records, database passwords, or secret keys in GitHub.

## Local development

Node.js 22+ and pnpm. Run `pnpm install` and `pnpm dev`; `pnpm build` checks the current Sites build. `pnpm build:cloudflare` builds the standalone Worker with the two public Supabase environment variables configured.

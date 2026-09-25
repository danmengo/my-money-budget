# My Money

Budgeting app for income, expenses, category limits, and savings goals.

## Status

The existing private [live Site](https://daniel-budget-tracker.danmengo.chatgpt.site) still uses ChatGPT sign-in and its managed Cloudflare D1 database. GitHub changes do not automatically deploy to that Site.

The Supabase login and data path is prepared in source. It activates when both `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` are set in a standalone deployment. The new database schema has **not** been applied; Google OAuth, email templates, standalone Cloudflare hosting, and existing data migration still need setup. Follow [the Supabase setup guide](docs/supabase-setup.md). Do not place budget records, database passwords, or secret keys in GitHub.

## Local development

Node.js 22+ and pnpm. Run `pnpm install` and `pnpm dev`; `pnpm build` checks the current Sites build. The standalone Cloudflare deployment configuration remains to be prepared before connecting GitHub automatic deployments.

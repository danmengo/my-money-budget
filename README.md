# My Money

A clean personal-finance dashboard for tracking income, expenses, monthly budgets, savings, and investing goals.

**Live app:** https://budget.danmengo.com

## Features

- Google OAuth and passwordless email sign-in with Supabase Auth
- Private, per-user financial data protected by PostgreSQL Row Level Security
- Income and expense tracking with editable categories
- Monthly category budgets and progress
- Savings and investing goals
- Monthly analytics and spending breakdowns
- CSV transaction export
- Responsive desktop and mobile UI

## Tech stack

- Next.js 16 + React 19 + TypeScript
- Supabase Auth + PostgreSQL
- Cloudflare Workers
- Tailwind CSS / shadcn UI
- Recharts

## Security

Every financial row has an authenticated owner. Supabase RLS policies restrict select, insert, update, and delete operations to that owner. The application uses the signed-in user's access token and a public Supabase publishable key; it does not use a service-role key in the browser or API route.

Never commit database passwords, OAuth client secrets, Supabase secret/service-role keys, or real financial data.

## Local development

Requirements: Node.js 22+ and pnpm.

1. Copy `.env.example` to `.env.local`.
2. Add your Supabase project URL and publishable key.
3. Run `pnpm install`.
4. Run `pnpm dev`.

For a Cloudflare production build, run `pnpm build:cloudflare`.

## Database setup

The schema and RLS policies live in `supabase/migrations/20260925000000_budget_schema.sql`. Apply the migration to your Supabase project before using the app.

## Deployment

The production app is deployed to Cloudflare Workers and served at https://budget.danmengo.com.

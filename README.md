# My Money

A budgeting app for tracking income, expenses, category limits, savings goals, and investing contributions.

## Current state

The live app is hosted privately at [My Money](https://daniel-budget-tracker.danmengo.chatgpt.site). Its source currently runs on ChatGPT Sites using a Cloudflare Worker and D1. This GitHub repository is a private copy of the application source; pushing here does not automatically update the live Site.

The app currently uses Sign in with ChatGPT. The planned move to your own Cloudflare account will use a new Worker and D1 database, with Google OAuth and email-code sign-in through an identity provider. The existing records must be migrated separately and associated with the new identity. **Do not put budget records or authentication secrets in this repository.**

## Source layout

- `app/` — dashboard and API
- `db/schema.ts` and `drizzle/` — D1 schema and migrations
- `components/` — UI components
- `public/` — static assets

## Local development

Use Node.js 22+, then run `pnpm install` and `pnpm dev`. The current Sites-specific build and D1 setup are documented in the starter tooling; the Cloudflare-owned deployment configuration will be added during the hosting migration.


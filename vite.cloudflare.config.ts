import vinext from 'vinext';
import { defineConfig } from 'vite';
import { cloudflare } from '@cloudflare/vite-plugin';

// Standalone Worker: the new app reads Supabase instead of binding the old Site's D1.
export default defineConfig({
  plugins: [
    vinext(),
    cloudflare({
      viteEnvironment: { name: 'rsc', childEnvironments: ['ssr'] },
      config: {
        name: 'my-money-budget',
        main: 'vinext/server/fetch-handler',
        compatibility_date: '2026-09-25',
        compatibility_flags: ['nodejs_compat'],
      },
    }),
  ],
});

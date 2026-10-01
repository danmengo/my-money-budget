import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import ts from 'typescript';
import * as monthReview from '../lib/month-review.ts';
import { readAllPages } from '../lib/read-all-pages.ts';
import { readJsonObject } from '../lib/request-json.ts';

// Execute the actual handlers, replacing only framework/SDK boundaries.
async function loadHandler(path, createClient) {
  const source = await readFile(new URL(path, import.meta.url), 'utf8');
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  });
  const dependencies = {
    '@supabase/supabase-js': { createClient },
    'next/server': { NextResponse: Response },
    '@/lib/request-json': { readJsonObject },
    '@/lib/month-review': monthReview,
    '@/lib/read-all-pages': { readAllPages },
  };
  const exports = {};
  new Function('require', 'exports', outputText)((name) => {
    assert.ok(name in dependencies, `Unexpected dependency: ${name}`);
    return dependencies[name];
  }, exports);
  return exports;
}

process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = 'test-publishable-key';
const verifiedId = 'verified-user';

for (const scenario of ['anonymous', 'invalid', 'regular', 'admin', 'lookup-error']) {
  test(`admin feedback access: ${scenario}`, async () => {
    const tables = [];
    const handler = await loadHandler('../app/api/admin/feedback/route.ts', (_url, key, options) => {
      assert.equal(key, 'test-publishable-key');
      assert.equal(options.global.headers.Authorization, 'Bearer test-token');
      return {
        auth: { getUser: async (token) => {
          assert.equal(token, 'test-token');
          return { data: { user: scenario === 'invalid' ? null : { id: verifiedId } }, error: null };
        } },
        from(table) {
          tables.push(table);
          return { select: () => ({
            eq(column, value) {
              assert.equal(table, 'admin_users');
              assert.equal(column, 'user_id');
              assert.equal(value, verifiedId);
              return { maybeSingle: async () => ({
                data: scenario === 'admin' ? { user_id: verifiedId } : null,
                error: scenario === 'lookup-error' ? { message: 'test lookup failure' } : null,
              }) };
            },
            order: async () => ({ data: [{ id: 1, message: 'Synthetic feedback' }], error: null }),
          }) };
        },
      };
    });
    const response = await handler.GET(new Request('https://example.test/api/admin/feedback', {
      headers: scenario === 'anonymous' ? {} : { Authorization: 'Bearer test-token' },
    }));
    const expected = { anonymous: 401, invalid: 401, regular: 403, admin: 200, 'lookup-error': 500 };
    assert.equal(response.status, expected[scenario]);
    assert.match(response.headers.get('cache-control'), /no-store/);
    assert.equal(tables.includes('feedback'), scenario === 'admin');
    if (scenario === 'anonymous' || scenario === 'invalid') assert.deepEqual(tables, []);
    if (scenario !== 'admin') assert.equal('feedback' in await response.json(), false);
  });
}

for (const [body, status] of [['null', 400], ['[]', 400], ['{', 400], ['x'.repeat(16385), 413]]) {
  test(`data API rejects malformed/oversized input before database work (${status}, ${body.length} bytes)`, async () => {
    let queries = 0;
    const handler = await loadHandler('../app/api/data/supabase.ts', () => ({
      auth: { getUser: async () => ({ data: { user: { id: verifiedId } }, error: null }) },
      from() { queries++; throw new Error('No database calls expected'); },
    }));
    const response = await handler.handleSupabase(new Request('https://example.test/api/data', {
      method: 'POST', headers: { Authorization: 'Bearer test-token' }, body,
    }));
    assert.equal(response.status, status);
    assert.equal(queries, 0);
    assert.match(response.headers.get('cache-control'), /no-store/);
  });
}

for (const payload of [
  { action: 'monthReview', month: '2026-13', choice: 'carry' },
  { action: 'monthReview', month: '2199-01', choice: 'carry' },
  { action: 'monthReview', month: '2025-09', choice: 'expense' },
]) {
  test(`invalid month-end choice is rejected before writes: ${JSON.stringify(payload)}`, async () => {
    const handler = await loadHandler('../app/api/data/supabase.ts', () => ({
      auth: { getUser: async () => ({ data: { user: { id: verifiedId } }, error: null }) },
      from() { throw new Error('No database writes expected'); },
    }));
    const response = await handler.handleSupabase(new Request('https://example.test/api/data', {
      method: 'POST', headers: { Authorization: 'Bearer test-token' }, body: JSON.stringify(payload),
    }));
    assert.equal(response.status, 400);
  });
}

for (const choice of ['carry', 'unallocated']) {
  test(`month-end ${choice} uses verified owner and existing private settings`, async () => {
    const writes = [];
    const handler = await loadHandler('../app/api/data/supabase.ts', (_url, key, options) => {
      assert.equal(key, 'test-publishable-key');
      assert.equal(options.global.headers.Authorization, 'Bearer test-token');
      return {
        auth: { getUser: async () => ({ data: { user: { id: verifiedId } }, error: null }) },
        from(table) {
          const filters = {};
          let mutation;
          const query = {
            select() { return query; }, eq(key, value) { filters[key] = value; return query; },
            like() { return query; }, order() { return query; }, range() { return query; },
            single() { return query; }, maybeSingle() { return query; },
            upsert(row, options) { mutation = row; assert.equal(options.onConflict, 'owner_id,key'); return query; },
            then(resolve, reject) {
              try {
                if (mutation) {
                  assert.equal(table, 'settings');
                  assert.deepEqual(mutation, { owner_id: verifiedId, key: 'month_review:2025-09', value: choice });
                  writes.push(mutation);
                  return Promise.resolve({ data: null, error: null }).then(resolve, reject);
                }
                assert.equal(filters[table === 'admin_users' ? 'user_id' : 'owner_id'], verifiedId);
                let data = [];
                if (table === 'settings') {
                  data = filters.key === 'initialized' ? { value: 'personal' } :
                    filters.key ? null : [{ key: 'month_review:2025-09', value: choice }];
                }
                if (table === 'admin_users') data = null;
                return Promise.resolve({ data, error: null }).then(resolve, reject);
              } catch (error) { return Promise.reject(error).then(resolve, reject); }
            },
          };
          return query;
        },
      };
    });
    const response = await handler.handleSupabase(new Request('https://example.test/api/data', {
      method: 'POST', headers: { Authorization: 'Bearer test-token' },
      body: JSON.stringify({ action: 'monthReview', month: '2025-09', choice, owner_id: 'another-user', amount: 999999 }),
    }));
    assert.equal(response.status, 200);
    assert.match(response.headers.get('cache-control'), /no-store/);
    assert.deepEqual((await response.json()).monthReviews, { '2025-09': choice });
    assert.equal(writes.length, 1);
  });
}

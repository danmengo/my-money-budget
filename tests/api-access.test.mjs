import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import ts from 'typescript';
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

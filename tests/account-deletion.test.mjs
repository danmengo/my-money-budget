import assert from 'node:assert/strict';
import test from 'node:test';
import { deleteAccount } from '../lib/account-deletion.ts';

const config = { url: 'https://test.supabase.co', publishableKey: 'public-test', secretKey: 'secret-test' };
const owner = '11111111-1111-4111-8111-111111111111';
const otherOwner = '22222222-2222-4222-8222-222222222222';

function request(body = '{"confirmation":"DELETE"}', headers = {}) {
  return new Request('https://budget.example/api/account/delete', {
    method: 'POST', body,
    headers: { authorization: 'Bearer test-token', 'content-type': 'application/json', ...headers },
  });
}

function fakeSupabase({ invalidUser = false, authThrows = false, deleteFails = false, deleteThrows = false } = {}) {
  const calls = [];
  const factory = (url, key, options) => {
    calls.push({ operation: 'createClient', url, key, options });
    return { auth: {
      async getUser(token) {
        calls.push({ operation: 'getUser', token });
        if (authThrows) throw Error('private upstream information');
        return { data: { user: invalidUser ? null : { id: owner } }, error: invalidUser ? Error('invalid') : null };
      },
      admin: { async deleteUser(id, softDelete) {
        calls.push({ operation: 'deleteUser', id, softDelete });
        if (deleteThrows) throw Error('private upstream information');
        return { error: deleteFails ? Error('private upstream information') : null };
      } },
    } };
  };
  return { calls, factory };
}

async function checkResponse(response, status) {
  assert.equal(response.status, status);
  assert.equal(response.headers.get('cache-control'), 'no-store, max-age=0');
  const body = await response.json();
  if (status !== 200) {
    assert.equal(typeof body.error, 'string');
    assert.equal(body.ok, undefined);
    assert.doesNotMatch(body.error, /private upstream|secret-test/);
  }
  return body;
}

for (const authorization of ['', 'Basic test', 'Bearer ']) {
  test(`rejects missing or malformed bearer token: ${JSON.stringify(authorization)}`, async () => {
    const mock = fakeSupabase();
    await checkResponse(await deleteAccount(request(undefined, { authorization }), config, mock.factory), 401);
    assert.equal(mock.calls.length, 0);
  });
}

test('fails closed when the server secret is missing', async () => {
  const mock = fakeSupabase();
  await checkResponse(await deleteAccount(request(), { ...config, secretKey: undefined }, mock.factory), 503);
  assert.equal(mock.calls.length, 0);
});

for (const body of ['null', '[]', '"DELETE"', '{}', '{', '', '{"confirmation":"delete"}', '{"confirmation":true}']) {
  test(`rejects invalid confirmation without contacting Supabase: ${JSON.stringify(body)}`, async () => {
    const mock = fakeSupabase();
    await checkResponse(await deleteAccount(request(body), config, mock.factory), 400);
    assert.equal(mock.calls.length, 0);
  });
}

for (const headers of [{}, { 'content-length': '1' }, { 'content-length': '4096' }]) {
  test(`rejects oversized body with headers ${JSON.stringify(headers)}`, async () => {
    const mock = fakeSupabase();
    const body = JSON.stringify({ confirmation: 'DELETE', padding: 'x'.repeat(2048) });
    await checkResponse(await deleteAccount(request(body, headers), config, mock.factory), 413);
    assert.equal(mock.calls.length, 0);
  });
}

test('counts UTF-8 bytes across chunks and cancels an oversized stream', async () => {
  const mock = fakeSupabase();
  let cancelled = false;
  const body = new ReadableStream({
    start(controller) {
      controller.enqueue(new TextEncoder().encode('{"confirmation":"DELETE","padding":"'));
      controller.enqueue(new TextEncoder().encode('🌱'.repeat(600)));
    },
    cancel() { cancelled = true; },
  });
  const req = new Request('https://budget.example/api/account/delete', {
    method: 'POST', body, duplex: 'half', headers: { authorization: 'Bearer test-token' },
  });
  await checkResponse(await deleteAccount(req, config, mock.factory), 413);
  assert.equal(cancelled, true);
  assert.equal(mock.calls.length, 0);
});

test('rejects invalid or deleted users before creating a privileged client', async () => {
  const mock = fakeSupabase({ invalidUser: true });
  await checkResponse(await deleteAccount(request(), config, mock.factory), 401);
  assert.deepEqual(mock.calls.map(c => c.operation), ['createClient', 'getUser']);
  assert.equal(mock.calls[0].key, config.publishableKey);
});

test('deletes only the verified caller, ignoring all client-supplied target IDs', async () => {
  const mock = fakeSupabase();
  const req = request(JSON.stringify({ confirmation: 'DELETE', owner_id: otherOwner, user_id: otherOwner, id: otherOwner }));
  const result = await checkResponse(await deleteAccount(req, config, mock.factory), 200);
  assert.deepEqual(result, { ok: true });
  assert.deepEqual(mock.calls.map(c => c.operation), ['createClient', 'getUser', 'createClient', 'deleteUser']);
  assert.equal(mock.calls[0].key, config.publishableKey);
  assert.equal(mock.calls[0].options.global.headers.Authorization, 'Bearer test-token');
  assert.equal(mock.calls[1].token, 'test-token');
  assert.equal(mock.calls[2].key, config.secretKey);
  assert.deepEqual(mock.calls[2].options.auth, { persistSession: false, autoRefreshToken: false });
  assert.equal(mock.calls[2].options.global, undefined);
  assert.deepEqual(mock.calls[3], { operation: 'deleteUser', id: owner, softDelete: false });
});

for (const failure of ['authThrows', 'deleteFails', 'deleteThrows']) {
  test(`returns a generic, non-cacheable error on ${failure}`, async () => {
    const mock = fakeSupabase({ [failure]: true });
    await checkResponse(await deleteAccount(request(), config, mock.factory), 500);
    if (failure === 'authThrows') assert.equal(mock.calls.some(c => c.operation === 'deleteUser'), false);
  });
}

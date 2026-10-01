import assert from 'node:assert/strict';
import test from 'node:test';
import { readJsonObject } from '../lib/request-json.ts';

const request = (body, headers = {}) => new Request('https://example.test/api/data', {
  method: 'POST', body, headers,
});
const limit = 16384;

test('accepts a transaction without changing its values', async () => {
  const value = { action: 'transaction', name: 'Lunch 🍜', amount: 12.50, type: 'expense' };
  assert.deepEqual(await readJsonObject(request(JSON.stringify(value)), limit), { ok: true, value });
});

for (const body of [undefined, '', '{', 'null', '[]', 'true', '12', '"transaction"']) {
  test(`rejects invalid JSON object: ${body}`, async () => {
    const result = await readJsonObject(request(body), limit);
    assert.equal(result.ok, false);
    assert.equal(result.status, 400);
  });
}

test('accepts exactly the byte limit, rejects one extra byte', async () => {
  const body = JSON.stringify({ name: 'x'.repeat(limit - 11) });
  assert.equal(Buffer.byteLength(body), limit);
  assert.equal((await readJsonObject(request(body), limit)).ok, true);
  assert.equal((await readJsonObject(request(body + ' '), limit)).status, 413);
});

for (const headers of [{}, { 'content-length': '1' }, { 'content-length': '20000' }]) {
  test(`bounds oversized requests with headers ${JSON.stringify(headers)}`, async () => {
    assert.equal((await readJsonObject(request(JSON.stringify({ name: 'x'.repeat(limit) }), headers), limit)).status, 413);
  });
}

test('counts UTF-8 bytes across chunks and cancels without waiting for EOF', async () => {
  let cancelled = false;
  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(new TextEncoder().encode('{"name":"'));
      controller.enqueue(new TextEncoder().encode('🍜'.repeat(4100)));
      // Deliberately never close: rejection must not wait for the sender.
    },
    cancel() { cancelled = true; },
  });
  const req = new Request('https://example.test', { method: 'POST', body: stream, duplex: 'half' });
  assert.equal((await readJsonObject(req, limit)).status, 413);
  assert.equal(cancelled, true);
});

test('handles a multibyte character split between chunks', async () => {
  const value = { name: '🍜' };
  const bytes = new TextEncoder().encode(JSON.stringify(value));
  const stream = new ReadableStream({ start(controller) {
    for (const byte of bytes) controller.enqueue(Uint8Array.of(byte));
    controller.close();
  } });
  assert.deepEqual(await readJsonObject(new Request('https://example.test', {
    method: 'POST', body: stream, duplex: 'half',
  }), limit), { ok: true, value });
});

test('returns a generic 400 for a broken stream', async () => {
  const stream = new ReadableStream({ start(controller) { controller.error(new Error('private details')); } });
  const result = await readJsonObject(new Request('https://example.test', {
    method: 'POST', body: stream, duplex: 'half',
  }), limit);
  assert.deepEqual(result, { ok: false, status: 400, error: 'Send a valid JSON object.' });
});

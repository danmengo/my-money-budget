import type { createClient } from '@supabase/supabase-js';

type Configuration = {
  url?: string;
  publishableKey?: string;
  secretKey?: string;
};

const maxBodyBytes = 2048;
const json = (body: unknown, status = 200) => Response.json(body, {
  status,
  headers: { 'Cache-Control': 'no-store, max-age=0' },
});

// Count actual streamed bytes: Content-Length can be missing or inaccurate.
async function readConfirmation(request: Request) {
  if (Number(request.headers.get('content-length')) > maxBodyBytes) {
    return { tooLarge: true };
  }
  const reader = request.body?.getReader();
  if (!reader) return { confirmed: false };
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maxBodyBytes) {
        // Do not wait for the sender to finish an oversized request.
        void reader.cancel().catch(() => {});
        return { tooLarge: true };
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  try {
    const body: unknown = JSON.parse(new TextDecoder().decode(bytes));
    return { confirmed: typeof body === 'object' && body !== null &&
      !Array.isArray(body) && 'confirmation' in body && body.confirmation === 'DELETE' };
  } catch {
    return { confirmed: false };
  }
}

// Server-only entry point. The factory argument lets tests exercise the real
// request handler without creating or deleting live Supabase accounts.
export async function deleteAccount(
  request: Request,
  config: Configuration,
  clientFactory: typeof createClient,
) {
  const { url, publishableKey, secretKey } = config;
  const token = request.headers.get('authorization')?.match(/^Bearer (.+)$/i)?.[1];
  if (!url || !publishableKey || !token) return json({ error: 'Sign in required.' }, 401);
  if (!secretKey) return json({ error: 'Account deletion is not configured yet.' }, 503);

  try {
    const body = await readConfirmation(request);
    if (body.tooLarge) return json({ error: 'Request is too large.' }, 413);
    if (!body.confirmed) return json({ error: 'Type DELETE to confirm account deletion.' }, 400);

    const userClient = clientFactory(url, publishableKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: { user }, error } = await userClient.auth.getUser(token);
    if (error || !user) return json({ error: 'Your session expired. Please sign in again.' }, 401);

    const admin = clientFactory(url, secretKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    // Never accept a target user ID from the request. A hard auth-user deletion
    // cascades through the user-owned tables in one database operation.
    const { error: deletionError } = await admin.auth.admin.deleteUser(user.id, false);
    if (deletionError) throw deletionError;
    return json({ ok: true });
  } catch {
    // Do not expose SDK errors, credentials, or account details in the response.
    return json({ error: 'Could not delete your account. Please try again or contact support.' }, 500);
  }
}

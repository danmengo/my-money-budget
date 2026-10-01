type JsonResult =
  | { ok: true; value: Record<string, unknown> }
  | { ok: false; status: 400 | 413; error: string };

// Bound actual bytes, including chunked requests with no Content-Length.
export async function readJsonObject(request: Request, maxBytes: number): Promise<JsonResult> {
  const invalid = { ok: false, status: 400, error: 'Send a valid JSON object.' } as const;
  const tooLarge = { ok: false, status: 413, error: 'Request is too large.' } as const;
  if (Number(request.headers.get('content-length')) > maxBytes) {
    void request.body?.cancel().catch(() => {});
    return tooLarge;
  }
  const reader = request.body?.getReader();
  if (!reader) return invalid;
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maxBytes) {
        void reader.cancel().catch(() => {});
        return tooLarge;
      }
      chunks.push(value);
    }
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.byteLength;
    }
    const value: unknown = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
    if (typeof value !== 'object' || value === null || Array.isArray(value)) return invalid;
    return { ok: true, value: value as Record<string, unknown> };
  } catch {
    return invalid;
  } finally {
    reader.releaseLock();
  }
}

// Supabase limits each response. A monthly review must include records beyond
// the first page, using a stable ordering supplied by the caller.
export async function readAllPages<T>(query: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>): Promise<{ data: T[]; error: null }> {
  const data: T[] = [];
  const pageSize = 500;
  for (let offset = 0; ; offset += pageSize) {
    const page = await query(offset, offset + pageSize - 1);
    if (page.error) throw page.error;
    data.push(...(page.data ?? []));
    if (!page.data || page.data.length < pageSize) return { data, error: null };
  }
}

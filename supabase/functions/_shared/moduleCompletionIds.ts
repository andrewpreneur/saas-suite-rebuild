const USER_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Ids safe to send as module_completion.user_id=in.(...).
 * An empty list means skip the query. PostgREST otherwise sends a sentinel
 * such as in.(none), and Postgres rejects that because user_id is a uuid.
 */
export function moduleCompletionUserIds(
  ids: ReadonlyArray<string | null | undefined> | null | undefined,
): string[] {
  const seen = new Set<string>();
  const real: string[] = [];
  for (const raw of ids ?? []) {
    const id = raw?.trim();
    if (!id || seen.has(id) || !USER_ID.test(id)) continue;
    seen.add(id);
    real.push(id);
  }
  return real;
}

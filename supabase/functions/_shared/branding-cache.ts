// Shared helper: purge the pre-generated branding artifacts for an agency so the
// next request to dynamic-styles rebuilds CSS/JS from the current DB state.
// Used whenever an account changes billing state (past due <-> active), because
// branding/menu-link-removals are applied conditionally on that state.

const BUCKET = "branding-cache";

export function agencyIdsFromUser(user: Record<string, unknown> | null | undefined): string[] {
  if (!user) return [];
  const ids = [
    user.agency_id,
    user.agency_id_basic,
    user.agency_id_advanced,
    user.agency_id_elite,
  ];
  return ids
    .filter((v): v is string => typeof v === "string" && v.trim().length > 0)
    .map((v) => v.trim());
}

export async function purgeBrandingCache(supabase: any, agencyIds: string[]): Promise<void> {
  const paths = agencyIds.flatMap((id) => [`${id}.css`, `${id}.js`]);
  if (paths.length === 0) return;
  try {
    const { error } = await supabase.storage.from(BUCKET).remove(paths);
    if (error) console.error("[BRANDING-CACHE] purge failed", error);
  } catch (e) {
    console.error("[BRANDING-CACHE] purge exception", e);
  }
}

export async function purgeBrandingCacheForEmail(supabase: any, email: string): Promise<string[]> {
  const { data } = await supabase
    .from("saas_suite_users")
    .select("agency_id, agency_id_basic, agency_id_advanced, agency_id_elite")
    .ilike("email", email)
    .maybeSingle();
  const ids = agencyIdsFromUser(data as Record<string, unknown> | null);
  await purgeBrandingCache(supabase, ids);
  return ids;
}

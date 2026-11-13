// Client Hub links are theme-specific: /v<ui_version>/<agencyId>.
// Version comes from agency_ui_versions (one row per onboarding link); no row = V2.
export const HUB_ORIGIN = "https://yoursoftwareonboarding.com";
export const DEFAULT_HUB_VERSION = 2;

export async function hubVersionFor(supabase: any, agencyId: string): Promise<number> {
  try {
    const { data } = await supabase
      .from("agency_ui_versions")
      .select("ui_version")
      .eq("agency_id", agencyId)
      .maybeSingle();
    return Number(data?.ui_version) || DEFAULT_HUB_VERSION;
  } catch {
    return DEFAULT_HUB_VERSION;
  }
}

export async function resolveHubUrl(supabase: any, agencyId: string, origin = HUB_ORIGIN): Promise<string> {
  const v = await hubVersionFor(supabase, agencyId);
  return `${origin.replace(/\/$/, "")}/v${v}/${agencyId}`;
}

export async function loadHubVersionMap(supabase: any): Promise<Map<string, number>> {
  const map = new Map<string, number>();
  try {
    const { data } = await supabase.from("agency_ui_versions").select("agency_id, ui_version");
    for (const r of data ?? []) map.set(String(r.agency_id), Number(r.ui_version) || DEFAULT_HUB_VERSION);
  } catch { /* default to v2 */ }
  return map;
}

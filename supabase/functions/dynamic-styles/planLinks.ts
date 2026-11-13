import { discoverPlanLinks, type PlanLink } from "../_shared/connectedPlans.ts";
import { connectionAgency, loadClient } from "../_shared/ghl.ts";
import { resolveHubUrl } from "../_shared/hub-url.ts";

export async function loadConnectedPlanLinks(sb: any, agencyId: string): Promise<{ connected: boolean; links: PlanLink[] }> {
  try {
    const rootId = await connectionAgency(sb, agencyId);
    const { data: conn, error: connError } = await sb.from("ghl_connections").select("status").eq("agency_id", rootId).maybeSingle();
    if (connError) return { connected: true, links: [] }; // Unknown access fails closed.
    if (!conn || conn.status === "disconnected") return { connected: false, links: [] };
    const { data: owner, error } = await sb.from("saas_suite_users").select("agency_id,agency_id_basic,agency_id_advanced,agency_id_elite,custom_domain,custom_domain_live").eq("agency_id", rootId).maybeSingle();
    if (error || !owner) return { connected: true, links: [] };
    const read = () => sb.from("ghl_custom_menus_cache").select("menu_id,url,all_locations,location_ids,synced_at").eq("agency_id", rootId);
    let { data: menus, error: menuError } = await read();
    if (menuError) return { connected: true, links: [] };
    if (!menus?.length || menus.some((m: any) => !m.synced_at || Date.now() - Date.parse(m.synced_at) > 15 * 60 * 1000)) {
      const c = await loadClient(sb, rootId);
      if (!c) return { connected: true, links: [] };
      const fresh = await c.api.customMenus();
      // Use the verified read immediately; never fall back to stale assignments on error.
      menus = fresh.map((m: any) => ({ menu_id: String(m.id), url: m.url, all_locations: m.showToAllLocations, location_ids: m.locations ?? m.locationIds ?? [] }));
    }
    const ids = [owner.agency_id_basic || owner.agency_id, owner.agency_id_advanced, owner.agency_id_elite];
    const origin = owner.custom_domain_live && owner.custom_domain ? `https://${String(owner.custom_domain).replace(/^https?:\/\//, "").replace(/\/$/, "")}` : undefined;
    const urls: Record<string, string> = {};
    await Promise.all(ids.filter(Boolean).map(async id => { urls[id] = await resolveHubUrl(sb, id, origin); }));
    return { connected: true, links: discoverPlanLinks(ids, menus || [], urls).links };
  } catch (error) {
    console.error("Connected plan menu lookup failed", error instanceof Error ? error.message : "lookup error");
    return { connected: true, links: [] };
  }
}
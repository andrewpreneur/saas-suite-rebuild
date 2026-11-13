import { discoverPlanLinks, PLAN_RUNTIME_REV, inspectInstalledAsset } from "../_shared/connectedPlans.ts";
import { resolveHubUrl } from "../_shared/hub-url.ts";

export async function setupPlanMenus(sb: any, agencyId: string) {
  const { data: owner, error: ownerError } = await sb.from("saas_suite_users")
    .select("agency_id,agency_id_basic,agency_id_advanced,agency_id_elite,custom_domain,custom_domain_live")
    .eq("agency_id", agencyId).maybeSingle();
  if (ownerError || !owner) throw new Error("Unable to read this account's plan URLs.");
  const ids = [owner.agency_id_basic || owner.agency_id, owner.agency_id_advanced, owner.agency_id_elite].filter(Boolean) as string[];
  const { data: menus, error } = await sb.from("ghl_custom_menus_cache").select("menu_id,url,all_locations,location_ids,title").eq("agency_id", agencyId);
  if (error) throw new Error("Unable to read HighLevel menu links.");
  const origin = owner.custom_domain_live && owner.custom_domain ? `https://${String(owner.custom_domain).replace(/^https?:\/\//, "").replace(/\/$/, "")}` : undefined;
  const urls: Record<string, string> = {};
  await Promise.all(ids.map(async id => { urls[id] = await resolveHubUrl(sb, id, origin); }));
  const result = discoverPlanLinks(ids, menus || [], urls);
  // One existing row per plan; no third ad-hoc id or new table is needed.
  // Patch only menu_link_id. Existing launchpad, redirect and hidden-menu settings stay intact.
  for (const link of result.links) {
    const { data: existing, error: readError } = await sb.from("agency_menu_config").select("agency_id,menu_link_id").eq("agency_id", link.agencyId).maybeSingle();
    if (readError) throw new Error("Unable to read plan installation settings.");
    if (existing?.menu_link_id === link.menuId) continue;
    const write = existing
      ? sb.from("agency_menu_config").update({ menu_link_id: link.menuId }).eq("agency_id", link.agencyId)
      : sb.from("agency_menu_config").insert({ agency_id: link.agencyId, menu_link_id: link.menuId, auto_navigate_on_login: true });
    const { error: writeError } = await write;
    if (writeError) throw new Error("Couldn't save a discovered plan menu link.");
  }
  return result;
}

export async function auditPlanInstall(api: any, companyId: string, agencyId: string, links: Array<{ menuId: string }>) {
  // Never return company response data (it may contain sensitive account fields).
  let company: any = null;
  try { const response = await api.company(companyId); company = response?.company || response; } catch { /* unknown is not installed */ }
  const css = company?.customCss ?? company?.customCSS ?? company?.whitelabel?.customCss;
  const js = company?.customJs ?? company?.customJS ?? company?.whitelabel?.customJs;
  const readAsset = async (type: string) => {
    try {
      const response = await fetch(`https://auth.saassuite.ai/functions/v1/dynamic-styles?agency_id=${encodeURIComponent(agencyId)}&type=${type}`, { signal: AbortSignal.timeout(8000) });
      const text = await response.text();
      return { reachable: response.ok, runtimeCurrent: response.ok && text.includes(PLAN_RUNTIME_REV), allLinksPresent: response.ok && links.every(link => text.includes(link.menuId)) };
    } catch { return { reachable: false, runtimeCurrent: false, allLinksPresent: false }; }
  };
  const [servedJs, servedCss] = await Promise.all([readAsset("js"), readAsset("css")]);
  return { checkedAt: new Date().toISOString(), installedJs: inspectInstalledAsset(js, agencyId, "js"), installedCss: inspectInstalledAsset(css, agencyId, "css"), servedJs, servedCss, browserVerified: false };
}
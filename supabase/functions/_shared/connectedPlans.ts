export type PlanMenu = { menu_id: string; url?: string | null; title?: string | null; all_locations?: boolean | null; location_ids?: string[] | null };
export type PlanLink = { agencyId: string; menuId: string; url: string; allLocations: boolean; locationIds: string[] };
export const PLAN_RUNTIME_REV = "connected-plans-2";
// Ordering is harmless for configured external links; redirects remain Hub-only.
export function menuOrderIds(links: PlanLink[], configured: unknown[] = []): string[] {
  return [...new Set([...links.map(link => link.menuId), ...configured].filter((id): id is string => typeof id === "string" && /^[A-Za-z0-9_-]{1,100}$/.test(id)))];
}
export function inspectInstalledAsset(value: unknown, agencyId: string, type: "js" | "css"): boolean | null {
  if (typeof value !== "string") return null;
  const decoded = value.replace(/&amp;/g, "&");
  const urls = decoded.match(/https:\/\/[^\s"'<>]+/g) || [];
  return urls.some(raw => {
    try { const u = new URL(raw); return u.hostname === "auth.saassuite.ai" && u.pathname === "/functions/v1/dynamic-styles" && u.searchParams.get("agency_id") === agencyId && u.searchParams.get("type") === type; }
    catch { return false; }
  });
}
export function multiPlanAllowed(slot: string, advanced: boolean, connected: boolean): boolean {
  return slot === "plan1" || (advanced && connected);
}
export function discoverPlanLinks(ids: Array<string | null | undefined>, menus: PlanMenu[], urls?: Record<string, string>): { links: PlanLink[]; unresolved: string[] } {
  const links: PlanLink[] = [], unresolved: string[] = [];
  for (const agencyId of [...new Set(ids.filter((id): id is string => !!id))]) {
    const matches = menus.filter(menu => {
      try {
        const u = new URL(menu.url || "");
        if (urls?.[agencyId]) {
          const expected = new URL(urls[agencyId]);
          if (u.origin === expected.origin && u.pathname.replace(/\/$/, "") === expected.pathname.replace(/\/$/, "")) return true;
        }
        if (u.hostname !== "yoursoftwareonboarding.com") return false;
        const path = u.pathname.split("/").filter(Boolean);
        return (path.length === 2 && /^v[123]$/.test(path[0]) && decodeURIComponent(path[1]) === agencyId) || (path.length === 1 && decodeURIComponent(path[0]) === agencyId);
      } catch { return false; }
    });
    if (matches.length !== 1) { unresolved.push(agencyId); continue; }
    const menu = matches[0];
    if (!menu || !/^[A-Za-z0-9_-]{1,100}$/.test(menu.menu_id)) { unresolved.push(agencyId); continue; }
    links.push({ agencyId, menuId: menu.menu_id, url: menu.url || "", allLocations: menu.all_locations === true, locationIds: (menu.location_ids || []).filter(id => /^[A-Za-z0-9_-]{1,64}$/.test(id)) });
  }
  return { links, unresolved };
}
export function eligiblePlanLink(links: PlanLink[], locationId: string, visibleIds: string[]): PlanLink | null {
  const eligible = links.filter(link => visibleIds.includes(link.menuId) && (link.allLocations || link.locationIds.includes(locationId)));
  return eligible.length === 1 ? eligible[0] || null : null;
}
export function planMenuCSS(links: PlanLink[], configured: unknown[] = []): string {
  const ids = menuOrderIds(links, configured);
  if (!ids.length) return `/* ${PLAN_RUNTIME_REV} no matched plan links */\n`;
  return `/* ${PLAN_RUNTIME_REV} */\n#sidebar-v2 nav { display:flex; flex-direction:column; align-items:stretch; }\n${ids.flatMap(id => [`#sidebar-v2 nav a[meta="${id}"]`, `#sidebar-v2 nav a[href*="custom-menu-link/${id}"]`]).join(",\n")} { order:-1 !important; }\n`;
}
export function planMenuJS(links: PlanLink[], autoNavigate: boolean, configured: unknown[] = []): string {
  // Only public ids, URLs and assignment location ids; never connection tokens or customer data.
  return `/* ${PLAN_RUNTIME_REV} */
(function(){
  var LINKS=${JSON.stringify(links)}, ORDER_IDS=${JSON.stringify(menuOrderIds(links, configured))}, AUTO=${autoNavigate};
  var scheduled=false;
  function visible(a){var s=getComputedStyle(a);return a.getClientRects().length>0 && s.display!=='none' && s.visibility!=='hidden' && a.getAttribute('aria-hidden')!=='true';}
  function matches(a,l){
    if(a.getAttribute('meta')===l.menuId)return true;
    try{var u=new URL(a.getAttribute('href')||'',location.origin);return u.pathname.split('/').includes('custom-menu-link') && u.pathname.split('/').at(-1)===l.menuId || u.href===l.url;}catch(e){return false;}
  }
  function apply(){
    var side=document.getElementById('sidebar-v2');if(!side)return;
    var anchors=Array.from(side.querySelectorAll('nav a'));
    ORDER_IDS.forEach(function(id){var l=LINKS.find(function(link){return link.menuId===id;})||{menuId:id};anchors.filter(function(a){return matches(a,l);}).forEach(function(a){
      var nav=a.closest('nav');if(nav){if(nav.style.display!=='flex')nav.style.display='flex';if(nav.style.flexDirection!=='column')nav.style.flexDirection='column';if(nav.style.alignItems!=='stretch')nav.style.alignItems='stretch';}
      if(a.style.getPropertyValue('order')!=='-1')a.style.setProperty('order','-1','important');
    });});
    if(!AUTO)return;
    var match=location.pathname.match(/\\/location\\/([A-Za-z0-9_-]{1,64})\\/(dashboard|launchpad)(?:\\/|$)/i);if(!match)return;
    var loc=match[1];
    var eligible=LINKS.filter(function(l){return (l.allLocations||l.locationIds.indexOf(loc)!==-1) && anchors.some(function(a){return matches(a,l)&&visible(a);});});
    if(eligible.length!==1)return;
    var chosen=eligible[0],key='ss-plan-login:'+loc+':'+chosen.menuId;
    try{if(sessionStorage.getItem(key))return;sessionStorage.setItem(key,'1');}catch(e){return;}
    location.replace(location.origin+'/v2/location/'+loc+'/custom-menu-link/'+chosen.menuId);
  }
  function schedule(){if(scheduled)return;scheduled=true;requestAnimationFrame(function(){scheduled=false;apply();});}
  apply();document.addEventListener('DOMContentLoaded',schedule);window.addEventListener('popstate',schedule);
  var root=document.documentElement;if(root)new MutationObserver(schedule).observe(root,{childList:true,subtree:true,attributes:true,attributeFilter:['href','meta','style','class','aria-hidden']});
  ['pushState','replaceState'].forEach(function(k){var original=history[k];history[k]=function(){var r=original.apply(this,arguments);schedule();return r;};});
  setInterval(schedule,1000);
})();\n`;
}
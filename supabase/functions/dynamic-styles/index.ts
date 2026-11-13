import { buildBrandingThemeJS, cachedThemeScriptNeedsFreshGrant, themeUserCaptureJS, THEME_RUNTIME_REV } from "../_shared/brandingTheme.ts";
import { buildFaviconJS } from "../_shared/brandingFavicon.ts";
import { signThemeSaveToken } from "../_shared/themeSaveAuth.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { buildTopNavWidgetJS } from "./top-nav-widget.ts";
import { sanitizeTopNavWidgetConfig } from "../_shared/topNavWidgetOptions.ts";
import { resolveTopNavWidgetColor } from "../_shared/topNavWidgetColor.ts";
import { popupHostUserRuntimeJS } from "../_shared/popupHostIdentity.ts";
import { logoSlotCSS } from "./logo-slot.ts";
import { popupFrameRuntimeJS } from "../_shared/popupFrame.ts";
import { resolveHubUrl } from "../_shared/hub-url.ts";
import { connectionAgency, loadClient } from "../_shared/ghl.ts";
import { xxiAdditionalCSS } from "./xxidesigns-additions.ts";
import { buildMobileCSS, buildMobileJS } from "./mobile-customization.ts";
import { menuLinkRemovalCss, safeMenuLinkSelector } from "../_shared/sitesTopNav.ts";
import { buildV2SidebarHeightFix } from "./sidebar-height.ts";
import { loadConnectedPlanLinks } from "./planLinks.ts";
import { PLAN_RUNTIME_REV, planMenuCSS, planMenuJS } from "../_shared/connectedPlans.ts";

const MENU_CACHE_TTL_MS = 15 * 60 * 1000;

// Which sub-accounts can see each menu link, from the owner's HighLevel
// connection. Returns null when HighLevel isn't connected (legacy behaviour).
async function menuLinkAccess(sb: any, agencyId: string, menuIds: string[]): Promise<Record<string, "*" | string[]> | null> {
  if (!menuIds.length) return null;
  try {
    const connId = await connectionAgency(sb, agencyId);
    const { data: conn } = await sb.from("ghl_connections").select("agency_id, status").eq("agency_id", connId).maybeSingle();
    if (!conn || conn.status === "disconnected") return null;
    const read = () => sb.from("ghl_custom_menus_cache").select("menu_id, location_ids, all_locations, synced_at").eq("agency_id", connId);
    let { data: rows } = await read();
    const oldest = Math.min(...(rows ?? []).map((r: any) => Date.parse(r.synced_at) || 0), Date.now());
    const missing = menuIds.some((id) => !(rows ?? []).find((r: any) => r.menu_id === id));
    if (!rows?.length || missing || Date.now() - oldest > MENU_CACHE_TTL_MS) {
      try {
        const c = await loadClient(sb, connId);
        if (c) {
          const menus = await c.api.customMenus();
          const now = new Date().toISOString();
          await sb.from("ghl_custom_menus_cache").delete().eq("agency_id", connId);
          if (menus.length) await sb.from("ghl_custom_menus_cache").insert(menus.map((m: any) => ({
            agency_id: connId, menu_id: String(m.id), title: m.title ?? m.name ?? null, url: m.url ?? null,
            show_on_company: m.showOnCompany ?? null, location_ids: m.locations ?? m.locationIds ?? [],
            all_locations: m.showToAllLocations ?? null, user_roles: m.userRole ?? m.userRoles ?? null, synced_at: now,
          })));
          rows = (await read()).data;
        }
      } catch (e) { console.error("menu cache refresh failed:", e); }
    }
    const out: Record<string, "*" | string[]> = {};
    for (const id of menuIds) {
      const r = (rows ?? []).find((x: any) => x.menu_id === id);
      out[id] = !r ? [] : r.all_locations ? "*" : ((r.location_ids ?? []) as any[]).map(String).filter((l) => /^[A-Za-z0-9_-]{1,64}$/.test(l));
    }
    return out;
  } catch (e) {
    console.error("menuLinkAccess failed:", e);
    return null;
  }
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const BUCKET = "branding-cache";

// How long a pre-generated artifact is considered fresh before we regenerate.
// Browsers + Cloudflare cache the response for the same duration so repeat
// loads are instant.
// The edge function still reuses a fresh artifact for a minute. The response
// itself must revalidate so the first refresh after Save & apply is not a
// stale browser or CDN copy.
const STYLE_RUNTIME_REV = "settings-full-height-3";
const FRESH_MS = 60 * 1000; // 1 minute
const CACHE_SECONDS = Math.floor(FRESH_MS / 1000);

function userFilter(agencyId: string): string {
  return `agency_id.eq.${agencyId},agency_id_basic.eq.${agencyId},agency_id_advanced.eq.${agencyId},agency_id_elite.eq.${agencyId}`;
}

// Changes when Design saves a new stylesheet. A fresh storage file is not
// enough: Save & apply can land while the previous artifact is still inside
// the one-minute window.
function cssStamp(css: string): string {
  let hash = 2166136261;
  for (let i = 0; i < css.length; i++) {
    hash ^= css.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return `${(hash >>> 0).toString(16)}.${css.length}`;
}

function styleHeaders(contentType: string, revision: string): Record<string, string> {
  return {
    ...corsHeaders,
    "Content-Type": contentType,
    "Cache-Control": "public, max-age=0, must-revalidate",
    "CDN-Cache-Control": "max-age=0",
    ETag: `"${revision}"`,
  };
}
let cacheBucketReady = false;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const agencyId = url.searchParams.get("agency_id")?.trim();
    const type = url.searchParams.get("type"); // 'css' or 'js'
    const force = url.searchParams.get("force") === "1";

    if (!agencyId) {
      return new Response("/* Missing agency_id parameter */", {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "text/plain" },
      });
    }

    if (!type || !["css", "js"].includes(type)) {
      return new Response("/* Missing or invalid type parameter. Use type=css or type=js */", {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "text/plain" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const objectPath = `${agencyId}.${type}`;
    const contentType = type === "css" ? "text/css" : "application/javascript";
    const publicUrl = `${supabaseUrl}/storage/v1/object/public/${BUCKET}/${objectPath}`;
    const { data: stampRow } = await supabase
      .from("saas_suite_users")
      .select("generated_css")
      .or(userFilter(agencyId))
      .maybeSingle();
    const revision = cssStamp(String(stampRow?.generated_css || ""));
    const marker = type === "js" ? `/* brand:${revision} rt:${THEME_RUNTIME_REV} plans:${PLAN_RUNTIME_REV} style:${STYLE_RUNTIME_REV} */` : `/* brand:${revision} plans:${PLAN_RUNTIME_REV} style:${STYLE_RUNTIME_REV} */`;

    // Temporary direct-delivery test for Mysterious Inc: no storage lookup,
    // no redirects, no stale cache windows — just generate and return the file
    // at the requested dynamic-styles URL.
    if (agencyId.toLowerCase() === "mysterious") {
      const body = type === "css"
        ? await buildCSS(supabase, "mysterious")
        : await buildJS(supabase, "mysterious");

      return new Response(body, {
        headers: {
          ...corsHeaders,
          "Content-Type": contentType,
          "Cache-Control": "no-store, no-cache, must-revalidate",
          "X-SaaSSuite-Delivery": "direct-mysterious-no-redirect",
        },
      });
    }

    // 1) Try to serve the pre-generated artifact directly from storage.
    //    This is a single ~50-100ms fetch — no DB list, no redirect.
    if (!force) {
      const cached = await fetchCached(publicUrl);
      if (cached && cached.body.startsWith(marker)) {
        const grantStale = type === "js" && !!Deno.env.get("THEME_SAVE_SECRET") && cachedThemeScriptNeedsFreshGrant(cached.body);
        if (!grantStale) {
          const ageMs = cached.lastModified ? Date.now() - cached.lastModified : 0;
          if (ageMs >= FRESH_MS) {
            // Branding matches. Refresh menu rules in the background.
            // @ts-ignore EdgeRuntime is available in Supabase Edge Functions
            (globalThis as any).EdgeRuntime?.waitUntil?.(
              regenerate(supabase, agencyId, type, contentType).catch((e) =>
                console.error("background regenerate failed:", e),
              ),
            );
          }
          return new Response(cached.body, { headers: styleHeaders(contentType, revision) });
        }
      }
    }

    // 2) Nothing cached (or force=1): generate inline, upload, and return.
    await ensureCacheBucket(supabase);
    const body = await regenerate(supabase, agencyId, type, contentType);
    return new Response(body, { headers: styleHeaders(contentType, revision) });
  } catch (error) {
    console.error("Error in dynamic-styles:", error);
    const message = error instanceof Error ? error.message : String(error);
    return new Response(`/* Error generating styles: ${message} */`, {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "text/plain" },
    });
  }
});

async function fetchCached(
  publicUrl: string,
): Promise<{ body: string; lastModified: number | null } | null> {
  try {
    const res = await fetch(publicUrl, { cache: "no-store" });
    if (!res.ok) {
      await res.body?.cancel();
      return null;
    }
    const body = await res.text();
    const lm = res.headers.get("last-modified");
    const lastModified = lm ? new Date(lm).getTime() : null;
    return { body, lastModified };
  } catch (e) {
    console.error("fetchCached error:", e);
    return null;
  }
}

// Some accounts pasted the whole HighLevel custom-menu-link URL instead of the
// bare id. Extract the id so generated selectors always match.
// IMPORTANT: only strip when the value is a URL/path. Never slice a bare id —
// HighLevel ids are hyphenated UUIDs and partial matches break the selector.
function normalizeMenuLinkId(value: unknown): string | null {
  const raw = typeof value === "string" ? value.trim() : "";
  if (!raw) return null;
  const fromUrl = raw.match(/custom-menu-link\/([^/?#\s]+)/i);
  if (fromUrl) return fromUrl[1].trim() || null;
  if (/^https?:\/\//i.test(raw) || raw.includes("/")) {
    const lastSegment = raw.split(/[?#]/)[0].split("/").filter(Boolean).pop();
    return (lastSegment || raw).trim() || null;
  }
  return raw;
}


// Old agency slugs (renamed accounts) may still be installed inside a client's
// HighLevel account. Resolve them forward so their branding keeps working.

async function resolveAgencyId(supabase: any, agencyId: string): Promise<string> {
  const { data: existing } = await supabase
    .from("saas_suite_users")
    .select("agency_id")
    .or(
      `agency_id.eq.${agencyId},agency_id_basic.eq.${agencyId},agency_id_advanced.eq.${agencyId},agency_id_elite.eq.${agencyId}`,
    )
    .limit(1);

  if (existing && existing.length > 0) return agencyId;

  let current = agencyId;
  for (let hop = 0; hop < 3; hop++) {
    const { data: migration } = await supabase
      .from("agency_id_migrations")
      .select("new_agency_id")
      .eq("old_agency_id", current)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!migration?.new_agency_id || migration.new_agency_id === current) break;
    current = migration.new_agency_id;

    const { data: rows } = await supabase
      .from("saas_suite_users")
      .select("agency_id")
      .or(
        `agency_id.eq.${current},agency_id_basic.eq.${current},agency_id_advanced.eq.${current},agency_id_elite.eq.${current}`,
      )
      .limit(1);
    if (rows && rows.length > 0) return current;
  }

  return agencyId;
}

// Every address (slug) that belongs to the same account as `agencyId`:
// all tier columns plus any older slugs recorded by renames.
async function siblingAgencyIds(supabase: any, agencyId: string): Promise<string[]> {
  const ids = new Set<string>([agencyId]);

  const { data: user } = await supabase
    .from("saas_suite_users")
    .select("agency_id, agency_id_basic, agency_id_advanced, agency_id_elite")
    .or(
      `agency_id.eq.${agencyId},agency_id_basic.eq.${agencyId},agency_id_advanced.eq.${agencyId},agency_id_elite.eq.${agencyId}`,
    )
    .maybeSingle();

  for (const key of ["agency_id", "agency_id_basic", "agency_id_advanced", "agency_id_elite"]) {
    const v = (user as any)?.[key];
    if (typeof v === "string" && v.trim()) ids.add(v.trim());
  }

  const known = Array.from(ids);
  const { data: migrations } = await supabase
    .from("agency_id_migrations")
    .select("old_agency_id, new_agency_id")
    .in("new_agency_id", known);

  for (const m of migrations || []) {
    if (typeof m?.old_agency_id === "string" && m.old_agency_id.trim()) ids.add(m.old_agency_id.trim());
  }

  return Array.from(ids);
}

// Menu settings are saved per address, but an account's hub can be served under
// a different tier address (e.g. `foo-2`) or a renamed address. Prefer the exact
// row; when it carries no menu link id, borrow the id(s) from a sibling address
// so the "move to top" rule always ships. Never removes anything.
async function loadMenuConfig(supabase: any, agencyId: string): Promise<any> {
  const { data: exact } = await supabase
    .from("agency_menu_config")
    .select("*")
    .eq("agency_id", agencyId)
    .maybeSingle();

  const hasId = (row: any) =>
    !!(String(row?.menu_link_id || "").trim() || String(row?.menu_link_id_2 || "").trim());
  // Collect all explicitly configured links for ordering, even when the exact
  // row has duplicate IDs. External links are not Hub redirect candidates.
  const siblings = (await siblingAgencyIds(supabase, agencyId)).filter((id) => id !== agencyId);
  if (siblings.length === 0) return exact;

  const { data: rows } = await supabase
    .from("agency_menu_config")
    .select("*")
    .in("agency_id", siblings)
    .order("updated_at", { ascending: false });

  const reorder_menu_ids = [exact, ...(rows || [])].flatMap((r: any) =>
    [normalizeMenuLinkId(r?.menu_link_id), normalizeMenuLinkId(r?.menu_link_id_2)].filter(Boolean));
  const donor = (rows || []).find((r: any) => hasId(r));
  if (!donor) return exact;

  // Keep every setting from the exact row (launchpad, hidden items, auto-nav);
  // only fill in the missing link ids.
  return {
    ...(exact || {}),
    reorder_menu_ids,
    menu_link_id: String(exact?.menu_link_id || "").trim() || donor.menu_link_id,
    menu_link_id_2: String(exact?.menu_link_id_2 || "").trim() || donor.menu_link_id_2,
    remove_launchpad: exact ? exact.remove_launchpad : donor.remove_launchpad,
    auto_navigate_on_login: exact ? exact.auto_navigate_on_login : donor.auto_navigate_on_login,
    hidden_menu_items: exact?.hidden_menu_items ?? donor.hidden_menu_items,
  };
}

async function regenerate(
  supabase: any,
  agencyId: string,
  type: string,
  contentType: string,
): Promise<string> {
  await ensureCacheBucket(supabase);
  const sourceId = await resolveAgencyId(supabase, agencyId);
  const body = type === "css"
    ? await buildCSS(supabase, sourceId)
    : await buildJS(supabase, sourceId);


  const { error: uploadError } = await supabase
    .storage
    .from(BUCKET)
    .upload(`${agencyId}.${type}`, new Blob([body], { type: contentType }), {
      upsert: true,
      contentType,
      cacheControl: String(CACHE_SECONDS),
    });

  if (uploadError) {
    console.error("Storage upload failed:", uploadError);
  }
  return body;
}

async function ensureCacheBucket(supabase: any): Promise<void> {
  if (cacheBucketReady) return;

  const { data: buckets, error: listError } = await supabase.storage.listBuckets();
  if (!listError && buckets?.some((bucket: any) => bucket.name === BUCKET || bucket.id === BUCKET)) {
    cacheBucketReady = true;
    return;
  }

  const { error: createError } = await supabase.storage.createBucket(BUCKET, {
    public: true,
    fileSizeLimit: 1024 * 1024,
    allowedMimeTypes: ["text/css", "application/javascript", "text/javascript"],
  });

  if (createError && !String(createError.message || createError).toLowerCase().includes("already exists")) {
    console.error("Unable to create branding cache bucket:", createError);
    return;
  }

  cacheBucketReady = true;
}

async function buildCSS(supabase: any, agencyId: string): Promise<string> {
  // Run all 3 reads in parallel — they don't depend on each other.
  const [menuConfig, userDataRes, menuLinkRulesRes] = await Promise.all([
    loadMenuConfig(supabase, agencyId),
    supabase
      .from("saas_suite_users")
      .select("primary_color, secondary_color, tertiary_color, agency_id, generated_css, billing_state, mobile_branding_enabled, mobile_menu_color")
      .or(`agency_id.eq.${agencyId},agency_id_basic.eq.${agencyId},agency_id_advanced.eq.${agencyId},agency_id_elite.eq.${agencyId}`)
      .maybeSingle(),
    supabase
      .from("menu_link_rules")
      .select("*")
      .eq("agency_id", agencyId)
      .eq("is_active", true),
  ]);
  const userData = userDataRes.data;
  const menuLinkRules = menuLinkRulesRes.data;

  let css = `/* brand:${cssStamp(String(userData?.generated_css || ""))} plans:${PLAN_RUNTIME_REV} style:${STYLE_RUNTIME_REV} */\n/* Dynamic styles for agency: ${agencyId} */\n/* Generated: ${new Date().toISOString()} */\n\n`;

  // Past-due accounts (failed payment / canceled subscription) keep their
  // settings saved but nothing branded is applied. Reordering still applies.
  const pastDue = String(userData?.billing_state || "ACTIVE").toUpperCase() === "PAST_DUE";

  if (pastDue) {
    css += `/* Subscription inactive — branding + menu link removals are saved but not applied. */\n\n`;
  }

  // If user has a full generated CSS (V2 branding), serve it first
  if (!pastDue && userData?.generated_css) {
    css += `/* === V2 Branding Stylesheet === */\n${userData.generated_css}\n\n`;
    const scrollbarColor = /^#[0-9a-f]{6}$/i.test(String(userData.primary_color || ""))
      ? String(userData.primary_color)
      : "#6b7280";
    // Classic uses the dark/light templates. Simple uses the V2 stylesheet.
    // Minimalist already has its own Settings footer, so it does not get this pin fix.
    if (/Branding V2 Stylesheet|Dark Mode Stylesheet|Light Mode Stylesheet/.test(userData.generated_css)) {
      css += buildV2SidebarHeightFix(scrollbarColor);
    }
  }

  // Launchpad removal
  if (menuConfig?.remove_launchpad) {
    css += `/* Hide GHL LaunchPad */\n#sb_launchpad,\n#sidebar-v2 a[meta="launchpad"],\n#sidebar-v2 a[href*="/launchpad"] {\n  display: none !important;\n}\n\n`;
  }

  const connectedPlans = await loadConnectedPlanLinks(supabase, agencyId);
  css += planMenuCSS(connectedPlans.links, menuConfig?.reorder_menu_ids || [normalizeMenuLinkId(menuConfig?.menu_link_id), normalizeMenuLinkId(menuConfig?.menu_link_id_2)]);

  // Legacy standalone reorder; connected plans come from verified HighLevel URLs.
  const menuLink1 = normalizeMenuLinkId(menuConfig?.menu_link_id);
  const menuLink2 = normalizeMenuLinkId(menuConfig?.menu_link_id_2);

  if (menuLink1 && !connectedPlans.connected) {
    css += `/* Onboarding Tool Reorder */\n#sidebar-v2 .hl_nav-header > nav {\n  display: flex;\n  flex-direction: column;\n  align-items: stretch;\n}\n\n`;
    css += `#sidebar-v2 .hl_nav-header > nav a[meta="${menuLink1}"],\n#sidebar-v2 .hl_nav-header > nav a[href*="custom-menu-link/${menuLink1}"] {\n  order: -1 !important;\n}\n\n`;
  }

  // Second menu link reorder (Basic/Advanced plans)
  if (menuLink2 && !connectedPlans.connected) {
    if (!menuLink1) {
      // Ensure nav is flex if only the second link is set
      css += `#sidebar-v2 .hl_nav-header > nav {\n  display: flex;\n  flex-direction: column;\n  align-items: stretch;\n}\n\n`;
    }
    css += `/* Onboarding Tool Reorder (Second Menu Link) */\n`;
    css += `#sidebar-v2 .hl_nav-header > nav a[meta="${menuLink2}"],\n#sidebar-v2 .hl_nav-header > nav a[href*="custom-menu-link/${menuLink2}"] {\n  order: -1 !important;\n}\n\n`;
  }


  // Hidden menu items from agency_menu_config (legacy)
  if (!pastDue && menuConfig?.hidden_menu_items && Array.isArray(menuConfig.hidden_menu_items)) {
    for (const itemId of menuConfig.hidden_menu_items) {
      css += `#sidebar-v2 .hl_nav-header > nav > a[meta="${itemId}"] {\n  display: none !important;\n}\n\n`;
    }
  }

  // Menu link rules from new table
  // Only emit GLOBAL (no sub_account_id) rules as CSS here — per-sub-account rules
  // are applied via JS in generateJS() because CSS class selectors cannot start with a
  // digit (and GHL does not attach the location id as a class to any parent element).
  if (!pastDue && menuLinkRules && Array.isArray(menuLinkRules) && menuLinkRules.length > 0) {
    const globalRules = menuLinkRules.filter((r: any) => !r.sub_account_id);
    if (globalRules.length > 0) {
      css += `/* === Menu Link Removals (global) === */\n`;
      for (const rule of globalRules) {
        css += menuLinkRemovalCss(rule.hidden_links);
      }
    }
  }

  // Branding colors as CSS variables (fallback if no generated_css)
  if (userData && (pastDue || !userData.generated_css)) {
    const primary = userData.primary_color || "#3b82f6";
    const secondary = userData.secondary_color || "#10b981";
    const tertiary = userData.tertiary_color || "#f59e0b";
    css += `/* Brand Colors */\n:root {\n  --agency-primary: ${primary};\n  --agency-secondary: ${secondary};\n  --agency-tertiary: ${tertiary};\n}\n`;
  }

  if (!pastDue) css += `\n${logoSlotCSS()}\n`;

  if (agencyId === "xxidesigns" && !pastDue) css += `\n${xxiAdditionalCSS}\n`;
  else if (!pastDue && userData?.mobile_branding_enabled) css += `\n/* === Mobile Branding (beta) === */\n${buildMobileCSS(userData.mobile_menu_color)}\n`;
  return css;
}

async function buildJS(supabase: any, agencyId: string): Promise<string> {
  // Run all 3 reads in parallel — they don't depend on each other.
  const [menuConfig, menuLinkRulesRes, userDataRes] = await Promise.all([
    loadMenuConfig(supabase, agencyId),
    supabase
      .from("menu_link_rules")
      .select("sub_account_id, hidden_links")
      .eq("agency_id", agencyId)
      .eq("is_active", true),
    supabase
      .from("saas_suite_users")
      .select("generated_css, popup_enabled, mobile_branding_enabled, mobile_zoom_enabled, primary_color, secondary_color, tertiary_color, billing_state, top_nav_widget_enabled, top_nav_widget_label, top_nav_widget_color_mode, top_nav_widget_custom_color, top_nav_widget_icon_color_mode, top_nav_widget_icon_custom_color, top_nav_widget_tile_color_mode, top_nav_widget_tile_custom_color")
      .or(`agency_id.eq.${agencyId},agency_id_basic.eq.${agencyId},agency_id_advanced.eq.${agencyId},agency_id_elite.eq.${agencyId}`)
      .maybeSingle(),
  ]);
  const menuLinkRules = menuLinkRulesRes.data;
  const userData = userDataRes.data;

  let js = `/* brand:${cssStamp(String(userData?.generated_css || ""))} rt:${THEME_RUNTIME_REV} plans:${PLAN_RUNTIME_REV} style:${STYLE_RUNTIME_REV} */\n/* Dynamic JS for agency: ${agencyId} */\n/* Generated: ${new Date().toISOString()} */\n${themeUserCaptureJS()}\n\n`;

  // Auto-navigate on login — enabled for ALL plans by default
  const menuLinkId = normalizeMenuLinkId(menuConfig?.menu_link_id);
  const menuLinkId2 = normalizeMenuLinkId(menuConfig?.menu_link_id_2);

  // Disable page navigation for the Mysterious direct-delivery test so the
  // dynamic-styles response cannot trigger any redirect-like browser behavior.
  const autoNavigate = agencyId !== "mysterious" && (menuConfig?.auto_navigate_on_login ?? true); // Default to true for all plans

  const connectedPlans = await loadConnectedPlanLinks(supabase, agencyId);
  js += planMenuJS(connectedPlans.links, autoNavigate, menuConfig?.reorder_menu_ids || [menuLinkId, menuLinkId2]);

  const redirectIds = [menuLinkId, menuLinkId2].filter((m: any) => typeof m === "string" && m.length > 0) as string[];
  if (autoNavigate && redirectIds.length && !connectedPlans.connected) {
    // With HighLevel connected, only redirect on sub-accounts that can see the
    // link, and send each sub-account to the first link it actually has.
    const access = await menuLinkAccess(supabase, agencyId, redirectIds);
    const links = access ? redirectIds : [menuLinkId].filter(Boolean);
    if (links.length) js += `(function() {
  var LINKS = ${JSON.stringify(links)};
  var ACCESS = ${JSON.stringify(access)};
  function pick(loc) {
    for (var i = 0; i < LINKS.length; i++) {
      if (!ACCESS) return LINKS[i];
      var a = ACCESS[LINKS[i]];
      if (a === '*' || (a && a.indexOf(loc) !== -1)) return LINKS[i];
    }
    return null;
  }
  function maybeRedirect() {
    var url = new URL(window.location.href);
    var match = url.pathname.match(/\\/location\\/([^/]+)\\/(dashboard|launchpad)/i);
    if (!match) return;
    var locationId = match[1];
    var link = pick(locationId);
    if (!link) return;
    var visibleLink = Array.from(document.querySelectorAll('#sidebar-v2 nav a')).some(function(a) {
      var matches = a.getAttribute('meta') === link || (a.getAttribute('href') || '').split('/').pop() === link;
      var style = getComputedStyle(a);
      return matches && a.getClientRects().length > 0 && style.display !== 'none' && style.visibility !== 'hidden';
    });
    if (!visibleLink) return;
    var desiredPath = 'custom-menu-link/' + link;
    var REDIRECT_KEY = 'ghl_initial_redirect_done:${agencyId}:' + link + ':' + locationId;
    if (sessionStorage.getItem(REDIRECT_KEY) === 'true') return;
    if (url.pathname.includes(desiredPath)) return;
    sessionStorage.setItem(REDIRECT_KEY, 'true');
    window.location.replace(url.origin + '/v2/location/' + locationId + '/' + desiredPath);
  }

  document.addEventListener('DOMContentLoaded', maybeRedirect);
  if (!history.__ssRedirect) {
    history.__ssRedirect = true;
    ['pushState', 'replaceState'].forEach(function (m) {
      var orig = history[m];
      history[m] = function () { var r = orig.apply(this, arguments); setTimeout(maybeRedirect, 0); return r; };
    });
    window.addEventListener('popstate', function () { setTimeout(maybeRedirect, 0); });
  }
  setInterval(maybeRedirect, 2000);
})();\n\n`;
  }

  // Menu link reorder — JS fallback that applies an inline order to the link.
  // CSS `order:-1` is unreliable because GHL renders
  // the sidebar/nav after our stylesheet loads and sometimes applies inline
  // layout that overrides flex order until the user refreshes.
  const reorderMetas = connectedPlans.connected ? [] : [menuLinkId, menuLinkId2].filter((m: any) => typeof m === 'string' && m.length > 0);
  if (reorderMetas.length > 0 || menuConfig?.remove_launchpad) {
    js += `(function() {
  var METAS = ${JSON.stringify(reorderMetas)};
  var REMOVE_LAUNCHPAD = ${menuConfig?.remove_launchpad === true};

  function applyMenuSettings() {
    if (REMOVE_LAUNCHPAD) {
      var launchpads = document.querySelectorAll('#sb_launchpad, #sidebar-v2 a[meta="launchpad"], #sidebar-v2 a[href*="/launchpad"]');
      for (var h = 0; h < launchpads.length; h++) {
        try { launchpads[h].style.setProperty('display', 'none', 'important'); } catch (e) {}
      }
    }

    var navs = document.querySelectorAll('#sidebar-v2 .hl_nav-header nav, #sidebar-v2 nav');
    for (var i = 0; i < navs.length; i++) {
      var nav = navs[i];
      // Ensure the parent nav is a flex container so order takes effect.
      try {
        var cs = window.getComputedStyle(nav);
        if (cs && cs.display.indexOf('flex') === -1) {
          nav.style.display = 'flex';
        }
        nav.style.flexDirection = 'column';
        nav.style.alignItems = 'stretch';
      } catch (e) {}
      for (var k = 0; k < METAS.length; k++) {
        var links = nav.querySelectorAll('a[meta="' + METAS[k] + '"], a[href*="custom-menu-link/' + METAS[k] + '"]');
        for (var j = 0; j < links.length; j++) {
          try { links[j].style.setProperty('order', '-1', 'important'); } catch (e) {}
        }
      }
    }
  }

  applyMenuSettings();
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', applyMenuSettings);
  }
  var scheduled = false;
  function watchMenu() {
    var side = document.getElementById('sidebar-v2');
    var root = side || document.body;
    if (!root || window.__ssMenuRoot === root) return;
    window.__ssMenuRoot = root;
    if (window.__ssMenuObs) window.__ssMenuObs.disconnect();
    window.__ssMenuObs = new MutationObserver(function () {
      if (scheduled) return;
      scheduled = true;
      requestAnimationFrame(function () {
        scheduled = false;
        applyMenuSettings();
        if (!side) watchMenu();
      });
    });
    try { window.__ssMenuObs.observe(root, { childList: true, subtree: !!side }); } catch (e) {}
  }
  watchMenu();
  setInterval(function () { watchMenu(); applyMenuSettings(); }, 1000);
})();\n\n`;
  }


  // Per-sub-account menu link removal — scoped by location id in the URL
  const jsPastDue = String((userData as any)?.billing_state || "ACTIVE").toUpperCase() === "PAST_DUE";
  const perSubRules = jsPastDue ? [] : (menuLinkRules || []).filter((r: any) => r.sub_account_id);
  // Turn a stored menu selector into a safe CSS selector. Sidebar ids (#sb_...)
  // and the Sites top-navigation catalog (#tb_...) are allowed; ids with spaces
  // become [id="..."].
  const safeSelector = (s: string): string | null => safeMenuLinkSelector(s);
  const LOC_RE = /^[A-Za-z0-9_\-]{1,64}$/;
  const rulesMap: Record<string, string[]> = {};
  for (const r of perSubRules) {
    const loc = String(r.sub_account_id || "").trim();
    if (!LOC_RE.test(loc)) continue;
    const links = (Array.isArray(r.hidden_links) ? r.hidden_links : [])
      .filter((l: any) => typeof l === "string").map(safeSelector).filter(Boolean) as string[];
    rulesMap[loc] = Array.from(new Set([...(rulesMap[loc] || []), ...links]));
  }
  // Scoped CSS: every rule requires the exact location attribute on <html>.
  const scopedCss = Object.entries(rulesMap)
    .filter(([, sels]) => sels.length)
    .map(([loc, sels]) => sels.map((s) => `html[data-ss-location="${loc}"] ${s}`).join(",\n") + " { display: none !important; }")
    .join("\n");
  if (scopedCss) {
    js += `(function() {
  var STYLE_ID = 'saassuite-menu-link-removals';
  var CSS = ${JSON.stringify(scopedCss)};
  function currentLocationId() {
    var m = window.location.pathname.match(/\\/location\\/([A-Za-z0-9_-]{1,64})(\\/|$)/i);
    return m ? m[1] : null;
  }
  function apply() {
    var root = document.documentElement;
    var locId = currentLocationId();
    if (locId) { if (root.getAttribute('data-ss-location') !== locId) root.setAttribute('data-ss-location', locId); }
    else if (root.hasAttribute('data-ss-location')) root.removeAttribute('data-ss-location');
    if (!document.getElementById(STYLE_ID)) {
      var style = document.createElement('style');
      style.id = STYLE_ID;
      style.appendChild(document.createTextNode(CSS));
      (document.head || root).appendChild(style);
    }
  }
  apply();
  document.addEventListener('DOMContentLoaded', apply);
  window.addEventListener('popstate', apply);
  setInterval(apply, 1000);
})();\n\n`;
  }

  // Top Navigation Help Widget — available to every account that enables it.
  if ((userData as any)?.top_nav_widget_enabled) {
    const u: any = userData;
    const palette = {
      primary: u.primary_color,
      secondary: u.secondary_color,
      tertiary: u.tertiary_color,
    };
    const color = resolveTopNavWidgetColor(u.top_nav_widget_color_mode, u.top_nav_widget_custom_color, palette, "#1d1d1f");
    const iconColor = resolveTopNavWidgetColor(u.top_nav_widget_icon_color_mode, u.top_nav_widget_icon_custom_color, palette, "#d4a843");
    const tileColor = resolveTopNavWidgetColor(u.top_nav_widget_tile_color_mode, u.top_nav_widget_tile_custom_color, palette, "#d4a843");
    const label = String(u.top_nav_widget_label || "Help & Support").slice(0, 40);
    const hubUrl = await resolveHubUrl(supabase, agencyId);
    // Separate read so a missing column (migration not applied yet) does not
    // break the rest of the injected script. Null uses the three built-in options.
    let rawOptions: unknown = null;
    const optRes = await supabase
      .from("saas_suite_users")
      .select("top_nav_widget_options")
      .or(`agency_id.eq.${agencyId},agency_id_basic.eq.${agencyId},agency_id_advanced.eq.${agencyId},agency_id_elite.eq.${agencyId}`)
      .maybeSingle();
    if (optRes.error) console.warn("top_nav_widget_options unavailable:", optRes.error.message);
    else rawOptions = (optRes.data as { top_nav_widget_options?: unknown } | null)?.top_nav_widget_options;
    const menu = sanitizeTopNavWidgetConfig(rawOptions);
    js += buildTopNavWidgetJS(label, color, {
      iconColor,
      tileColor,
      hubUrl,
      hideInEmbed: true,
      options: menu.options,
      title: menu.title,
      subtitle: menu.subtitle,
      showOn: menu.showOn,
      agencyId,
    });
  }

  // Popup launcher — opens the agency's Client Hub in a floating panel
  if (userData?.popup_enabled) {
    const brand = (userData.primary_color || "#3B82F6").replace(/"/g, "");
    const safeAgencyId = agencyId.replace(/"/g, "");
    js += `(function () {
  if (window.__saassuitePopupLoaded) return;
  window.__saassuitePopupLoaded = true;

  var AGENCY_ID = ${JSON.stringify(safeAgencyId)};
  var BRAND = ${JSON.stringify(brand)};
  var ORIGIN = "https://yoursoftwareonboarding.com";
  ${popupFrameRuntimeJS()}
  ${popupHostUserRuntimeJS()}

  function init() {
    if (!document.body) { setTimeout(init, 200); return; }
    if (document.querySelector('.lvb-launcher') || document.querySelector('.lvb-panel')) return;

    var css = ""
      + ".lvb-launcher{position:fixed;right:20px;bottom:20px;width:56px;height:56px;border-radius:9999px;"
      + "background:" + BRAND + ";color:#fff;display:flex;align-items:center;justify-content:center;"
      + "box-shadow:0 8px 24px rgba(0,0,0,.2);cursor:grab;border:0;z-index:2147483646;"
      + "padding:0;margin:0;line-height:0;font-size:0;box-sizing:border-box;-webkit-appearance:none;appearance:none;"
      + "touch-action:none;transition:transform .2s ease, opacity .2s ease;}"
      + ".lvb-launcher > svg{display:block;width:24px;height:24px;flex:none;pointer-events:none;}"
      + ".lvb-launcher:hover{transform:scale(1.06);}"
      + ".lvb-launcher.lvb-dragging{cursor:grabbing;transform:scale(1.04);transition:none;}"
      + ".lvb-launcher.lvb-hidden{transform:scale(.85);opacity:0;pointer-events:none;}"
      + ".lvb-panel{position:fixed;right:20px;bottom:20px;width:400px !important;height:640px !important;max-width:calc(100vw - 40px) !important;max-height:calc(100vh - 40px) !important;"
      + "background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 20px 50px rgba(0,0,0,.25);"
      + "z-index:2147483647;transform-origin:bottom right;box-sizing:border-box;"
      + "transform:translateY(16px) scale(.95);opacity:0;pointer-events:none;"
      + "transition:transform .25s cubic-bezier(.2,.8,.2,1), opacity .25s ease;}"
      + ".lvb-panel.lvb-open{transform:translateY(0) scale(1);opacity:1;pointer-events:auto;}"
      + ".lvb-panel iframe{width:100% !important;height:100% !important;max-width:none !important;max-height:none !important;border:0;display:block;}"
      + ".lvb-close{position:absolute;top:8px;right:8px;width:28px;height:28px;border-radius:9999px;"
      + "background:rgba(0,0,0,.5);color:#fff;border:0;cursor:pointer;font-size:16px;line-height:28px;"
      + "display:flex;align-items:center;justify-content:center;z-index:2;}";

    var style = document.createElement('style');
    style.textContent = css;
    document.head.appendChild(style);

    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'lvb-launcher';
    btn.setAttribute('aria-label', 'Open client hub');
    btn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:block;margin:auto"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>';

    var panel = document.createElement('div');
    panel.className = 'lvb-panel';
    panel.innerHTML =
      '<button class="lvb-close" type="button" aria-label="Close">\u2715</button>' +
      '<iframe src="' + ORIGIN + '/popup/' + AGENCY_ID + '" allow="clipboard-write; microphone; autoplay; fullscreen" allowfullscreen></iframe>';

    document.body.appendChild(btn);
    document.body.appendChild(panel);
    applyPopupFrameSize(panel);

    // Keep the panel anchored to wherever the bubble currently sits.
    function syncPanel(){
      var box = applyPopupFrameSize(panel) || { width: 400, height: 640 };
      if (!moved) return;
      var r = btn.getBoundingClientRect();
      var pw = box.width;
      var ph = box.height;
      var left = Math.min(Math.max(10, r.left + r.width / 2 - pw / 2), window.innerWidth - pw - 10);
      var top = r.top - ph - 12;
      if (top < 10) top = Math.min(r.bottom + 12, window.innerHeight - ph - 10);
      panel.style.right = 'auto';
      panel.style.bottom = 'auto';
      panel.style.left = left + 'px';
      panel.style.top = Math.max(10, top) + 'px';
    }

    function applyTab(detail) {
      if (!detail || (!detail.tab && !detail.path)) return;
      var raw = String(detail.tab || detail.path || '');
      var tab = raw.split('?')[0].split('#')[0].split('/').filter(Boolean).pop() || '';
      if (!tab) return;
      var frame = panel.querySelector('iframe');
      if (!frame) return;
      var payload = { type: 'saassuite:popup-open', source: 'saassuite-host', tab: tab, tabName: detail.tabName || '', path: detail.path || ('/' + tab) };
      var hostUser = ssPopupHostUser();
      if (hostUser) payload.user = hostUser;
      try { if (frame.contentWindow) frame.contentWindow.postMessage(payload, ORIGIN); } catch (err) {}
      if (frame.getAttribute('data-ss-tab') !== tab) {
        frame.setAttribute('data-ss-tab', tab);
        frame.src = ORIGIN + '/popup/' + AGENCY_ID + '?tab=' + encodeURIComponent(tab);
      }
    }
    function openPanel(detail){ syncPanel(); applyTab(detail); panel.classList.add('lvb-open'); btn.classList.add('lvb-hidden'); }
    function closePanel(){ panel.classList.remove('lvb-open'); btn.classList.remove('lvb-hidden'); }
    window.SaaSSuitePopup = {
      open: function (detail) { openPanel(detail || null); },
      close: closePanel
    };
    panel.querySelector('.lvb-close').addEventListener('click', closePanel);

    // --- Drag to reposition (not persisted: reloading restores the default spot) ---
    var dragging = false, moved = false, startX = 0, startY = 0, originX = 0, originY = 0, pid = null;

    btn.addEventListener('pointerdown', function(e){
      if (e.button && e.button !== 0) return;
      var r = btn.getBoundingClientRect();
      dragging = true; moved = false; pid = e.pointerId;
      startX = e.clientX; startY = e.clientY; originX = r.left; originY = r.top;
      try { btn.setPointerCapture(pid); } catch (_e) {}
    });

    btn.addEventListener('pointermove', function(e){
      if (!dragging) return;
      var dx = e.clientX - startX, dy = e.clientY - startY;
      if (!moved && Math.abs(dx) < 4 && Math.abs(dy) < 4) return;
      if (!moved) { moved = true; btn.classList.add('lvb-dragging'); }
      var size = btn.offsetWidth || 56;
      var left = Math.min(Math.max(4, originX + dx), window.innerWidth - size - 4);
      var top = Math.min(Math.max(4, originY + dy), window.innerHeight - size - 4);
      btn.style.right = 'auto';
      btn.style.bottom = 'auto';
      btn.style.left = left + 'px';
      btn.style.top = top + 'px';
      e.preventDefault();
    });

    function endDrag(e){
      if (!dragging) return;
      dragging = false;
      btn.classList.remove('lvb-dragging');
      try { btn.releasePointerCapture(pid); } catch (_e) {}
      if (!moved) { openPanel(); }
      else if (e) { e.preventDefault(); e.stopPropagation(); }
    }
    btn.addEventListener('pointerup', endDrag);
    btn.addEventListener('pointercancel', endDrag);
    btn.addEventListener('click', function(e){ e.preventDefault(); e.stopPropagation(); });
    window.addEventListener('resize', function(){ if (panel.classList.contains('lvb-open')) syncPanel(); });


    window.addEventListener('message', function(e){
      var data = e && e.data;
      if (!data || !data.type) return;
      if (data.type === 'lvb-popup-close') closePanel();
      else if (data.type === 'lvb-popup-preferred-size') rememberPopupSize(data, e, panel);
      else if (data.type === 'saassuite:popup-open' && e.source === window) openPanel(data);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();\n\n`;
  }

  if (agencyId === "xxidesigns" && !jsPastDue) js += `\n${buildMobileJS(userData?.mobile_zoom_enabled)}\n`;
  else if (!jsPastDue && userDataRes.data?.mobile_branding_enabled) js += `\n/* Mobile Branding (beta) */\n${buildMobileJS(userData?.mobile_zoom_enabled)}\n`;
  if (!jsPastDue) {
    js += buildFaviconJS(userData?.generated_css || "");
    const saveSecret = Deno.env.get("THEME_SAVE_SECRET") || "";
    const saveToken = saveSecret ? await signThemeSaveToken(agencyId, saveSecret) : "";
    js += buildBrandingThemeJS(userData?.generated_css || "", agencyId, saveToken);
  }
  return js;
}

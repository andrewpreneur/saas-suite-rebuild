// Agency HighLevel connection + menu automation management (owner/admin only).
import { requireAuthedUser, json, corsHeaders } from "../_shared/user-auth.ts";
import { resolveHubUrl } from "../_shared/hub-url.ts";
import { setupPlanMenus, auditPlanInstall } from "./planSetup.ts";
import {
  encryptToken, ghlClient, loadClient, GhlError, serviceClient, sha256Hex, randomSecret,
  processEvent, locationBelongs, connectionAgency, tokenPrefix, planMenuId, normalizeMenuId, setMenuLocation,
} from "../_shared/ghl.ts";
import { isPlatformAdminEmail } from "../_shared/platformAdmins.ts";
const WRITE = new Set([
  "invite_portal", "connect", "disconnect", "sync", "setup_plans", "audit_installation", "rotate_secret", "revoke_secret", "update_automation", "resolve", "retry", "assign_menu",
]);

async function authorize(sb: any, email: string, agencyId: string, write: boolean) {
  if (isPlatformAdminEmail(email)) return true;
  const { data: owner } = await sb.from("saas_suite_users").select("email")
    .or(`agency_id.eq.${agencyId},agency_id_basic.eq.${agencyId},agency_id_advanced.eq.${agencyId},agency_id_elite.eq.${agencyId}`)
    .maybeSingle();
  if (!owner) return false;
  const ownerEmail = String(owner.email).toLowerCase();
  if (ownerEmail === email) return true;
  const { data: admin } = await sb.from("account_admins").select("permissions")
    .ilike("owner_email", ownerEmail).ilike("admin_email", email).eq("status", "accepted").maybeSingle();
  if (!admin) return false;
  const level = (admin.permissions ?? {}).settings ?? "edit";
  return write ? level === "edit" : level !== "none";
}

async function loggedInEmails(sb: any, agencyId: string): Promise<Set<string>> {
  const { data: owner } = await sb.from("saas_suite_users").select("agency_id, agency_id_basic, agency_id_advanced, agency_id_elite")
    .or(`agency_id.eq.${agencyId},agency_id_basic.eq.${agencyId},agency_id_advanced.eq.${agencyId},agency_id_elite.eq.${agencyId}`).maybeSingle();
  const ids = owner ? [owner.agency_id, owner.agency_id_basic, owner.agency_id_advanced, owner.agency_id_elite].filter(Boolean) : [agencyId];
  const { data } = await sb.from("user_progress").select("email").in("agency_id", ids).limit(20000);
  return new Set((data ?? []).map((r: any) => String(r.email ?? "").trim().toLowerCase()).filter(Boolean));
}

async function portalUrl(sb: any, agencyId: string): Promise<string> {
  const { data: u } = await sb.from("saas_suite_users").select("custom_domain, custom_domain_live")
    .or(`agency_id.eq.${agencyId},agency_id_basic.eq.${agencyId},agency_id_advanced.eq.${agencyId},agency_id_elite.eq.${agencyId}`).maybeSingle();
  const origin = u?.custom_domain && u?.custom_domain_live
    ? `https://${String(u.custom_domain).replace(/^https?:\/\//, "").replace(/\/$/, "")}`
    : undefined;
  return resolveHubUrl(sb, agencyId, origin);
}

async function sanitizeConn(c: any) {
  if (!c) return { connected: false };
  return {
    connected: c.status !== "disconnected", status: c.status, company_id: c.company_id,
    company_name: c.company_name, capabilities: c.capabilities, last_error: c.last_error,
    last_sync_at: c.last_sync_at, updated_at: c.updated_at,
    token_prefix: c.status === "disconnected" ? null : await tokenPrefix(c),
  };
}

async function probe(api: ReturnType<typeof ghlClient>, companyId: string) {
  const caps: Record<string, boolean | string> = {};
  let name: string | null = null;
  try {
    const company = await api.company(companyId);
    name = company?.company?.name ?? company?.name ?? null;
    caps.company = true;
  } catch (e) { caps.company = e instanceof GhlError ? e.message : "failed"; }
  for (const [k, fn] of [
    ["locations", () => api.req(`/locations/search?companyId=${encodeURIComponent(companyId)}&skip=0&limit=1`)],
    ["custom_menus", () => api.req(`/custom-menus/?skip=0&limit=1`)],
    ["users", () => api.req(`/users/search?companyId=${encodeURIComponent(companyId)}&skip=0&limit=1`)],
  ] as const) {
    try { await fn(); caps[k] = true; } catch (e) { caps[k] = e instanceof GhlError ? e.message : "failed"; }
  }
  return { name, caps };
}

// Company ID is discovered from any sub-account: GET /locations/{id} -> location.companyId
async function discoverCompanyId(api: ReturnType<typeof ghlClient>, locationId: string) {
  let loc: any;
  try { loc = await api.location(locationId); } catch (e) {
    if (e instanceof GhlError && (e.status === 403 || e.status === 400 || e.status === 404))
      throw new GhlError(e.status, `HighLevel wouldn't open sub-account ${locationId} with this token. Make sure the sub-account ID is from the same agency the token was created in. (${e.message})`);
    throw e;
  }
  const cid = (loc?.location ?? loc)?.companyId;
  if (!cid) throw new GhlError(400, "Couldn't read the company from that sub-account");
  return String(cid);
}

async function sync(sb: any, agencyId: string) {
  const c = await loadClient(sb, agencyId);
  if (!c) throw new GhlError(400, "Not connected");
  const [locs, menus] = await Promise.all([c.api.locations(c.conn.company_id), c.api.customMenus()]);
  const now = new Date().toISOString();
  // Full success only — replace caches atomically-ish after both lists loaded.
  await sb.from("ghl_locations_cache").delete().eq("agency_id", agencyId);
  if (locs.length) await sb.from("ghl_locations_cache").insert(
    locs.map((l: any) => ({
      agency_id: agencyId, location_id: String(l.id), name: l.name ?? null, synced_at: now,
      email: l.email ? String(l.email).trim().toLowerCase() : null, phone: l.phone ?? null,
      company_name: l.business?.name ?? l.companyName ?? l.name ?? null,
    })));
  await sb.from("ghl_custom_menus_cache").delete().eq("agency_id", agencyId);
  if (menus.length) await sb.from("ghl_custom_menus_cache").insert(menus.map((m: any) => ({
    agency_id: agencyId, menu_id: String(m.id), title: m.title ?? m.name ?? null, url: m.url ?? null,
    show_on_company: m.showOnCompany ?? null, location_ids: m.locations ?? m.locationIds ?? [],
    all_locations: m.showToAllLocations ?? null, user_roles: m.userRole ?? m.userRoles ?? null, synced_at: now,
  })));
  await sb.from("ghl_connections").update({ last_sync_at: now, last_error: null, status: "connected", updated_at: now })
    .eq("agency_id", agencyId);
  return { locations: locs.length, menus: menus.length };
}

async function getAutomation(sb: any, agencyId: string) {
  const { data } = await sb.from("menu_automations").select("*").eq("agency_id", agencyId)
    .order("created_at").limit(1).maybeSingle();
  if (data) return data;
  const { data: created } = await sb.from("menu_automations").insert({ agency_id: agencyId }).select("*").single();
  return created;
}
const sanitizeAuto = (a: any) => a && ({
  id: a.id, name: a.name, has_secret: !!a.secret_hash, secret_prefix: a.secret_prefix,
  secret_rotated_at: a.secret_rotated_at, product_presets: a.product_presets, allow_any_preset: a.allow_any_preset,
  allow_single_location_email: a.allow_single_location_email, legacy_until: a.legacy_until,
});

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const auth = await requireAuthedUser(req);
  if (!auth.ok) return auth.res;
  let body: any;
  try { body = await req.json(); } catch { return json({ error: "Invalid JSON" }, 400); }
  const action = String(body?.action ?? "");
  const requestedId = typeof body?.agency_id === "string" ? body.agency_id.trim() : "";
  if (!requestedId || requestedId.length > 100 || !/^[A-Za-z0-9_-]+$/.test(requestedId)) return json({ error: "agency_id required" }, 400);
  const sb = serviceClient();
  if (!(await authorize(sb, auth.email, requestedId, WRITE.has(action)))) return json({ error: "Not allowed" }, 403);
  // All plan IDs of one owner share a single HighLevel connection.
  const agencyId = await connectionAgency(sb, requestedId);

  try {
    // Older caches lack sub-account emails; refresh once in the background of a read.
    if (["locations", "portal_stats", "invite_portal", "menus"].includes(action)) {
      const { data: sample } = await sb.from("ghl_locations_cache").select("email, synced_at").eq("agency_id", agencyId).limit(50);
      const stale = (sample ?? []).length > 0 && (sample ?? []).every((r: any) => !r.email);
      if (stale) { try { await sync(sb, agencyId); } catch { /* keep old cache */ } }
    }
    switch (action) {
      case "setup_plans":
      case "audit_installation": {
        const c = await loadClient(sb, agencyId);
        if (!c) return json({ error: "Connect HighLevel in Settings before setting up multiple plans." }, 409);
        await sync(sb, agencyId);
        const result = await setupPlanMenus(sb, agencyId);
        if (action === "setup_plans") return json(result);
        const audit = await auditPlanInstall(c.api, c.conn.company_id, agencyId, result.links);
        return json({ ...result, audit });
      }
      case "status": {
        const { data } = await sb.from("ghl_connections").select("*").eq("agency_id", agencyId).maybeSingle();
        return json({ connection: await sanitizeConn(data), automation: sanitizeAuto(await getAutomation(sb, agencyId)) });
      }
      case "connect": {
        const token = String(body.token ?? "").trim();
        const locationId = String(body.location_id ?? "").trim();
        if (token.length < 20 || token.length > 4000) return json({ error: "Token looks invalid" }, 400);
        if (!/^[A-Za-z0-9_-]{6,64}$/.test(locationId)) return json({ error: "Sub-account (location) ID looks invalid" }, 400);
        const api = ghlClient(token);
        const companyId = await discoverCompanyId(api, locationId);
        const { data: prev } = await sb.from("ghl_connections").select("company_id, status").eq("agency_id", agencyId).maybeSingle();
        if (prev && prev.status !== "disconnected" && prev.company_id !== companyId && !body.confirm_company_change)
          return json({ error: "That token belongs to a different HighLevel company than the one connected. Disconnect first to switch." }, 409);
        const { name, caps } = await probe(api, companyId);
        const e = await encryptToken(token, agencyId);
        const now = new Date().toISOString();
        const { error } = await sb.from("ghl_connections").upsert({
          agency_id: agencyId, company_id: companyId, token_ciphertext: e.ciphertext, token_nonce: e.nonce,
          key_version: e.key_version, status: "connected", company_name: name, capabilities: caps,
          last_error: null, connected_by: auth.email, updated_at: now,
        });
        if (error) return json({ error: "Could not save connection" }, 500);
        let synced = null;
        try { synced = await sync(sb, agencyId); } catch (err) {
          await sb.from("ghl_connections").update({ last_error: err instanceof GhlError ? err.message : "Sync failed" }).eq("agency_id", agencyId);
        }
        const { data } = await sb.from("ghl_connections").select("*").eq("agency_id", agencyId).maybeSingle();
        return json({ connection: await sanitizeConn(data), synced });
      }
      case "test": {
        const c = await loadClient(sb, agencyId);
        if (!c) return json({ error: "Not connected" }, 400);
        const { name, caps } = await probe(c.api, c.conn.company_id);
        await sb.from("ghl_connections").update({ company_name: name, capabilities: caps, last_error: null, status: "connected" }).eq("agency_id", agencyId);
        return json({ ok: true, company_name: name, capabilities: caps });
      }
      case "disconnect": {
        // Keeps existing menu rules; stops future HighLevel lookups.
        await sb.from("ghl_connections").update({
          status: "disconnected", token_ciphertext: "", token_nonce: "", updated_at: new Date().toISOString(),
        }).eq("agency_id", agencyId);
        return json({ ok: true });
      }
      case "sync":
        return json({ ok: true, ...(await sync(sb, agencyId)) });
      case "locations": {
        const { data } = await sb.from("ghl_locations_cache").select("location_id, name, email, phone, company_name").eq("agency_id", agencyId).order("name").limit(5000);
        return json({ locations: data ?? [] });
      }
      case "portal_stats": {
        const { data: locs } = await sb.from("ghl_locations_cache").select("email").eq("agency_id", agencyId).limit(5000);
        const loggedIn = await loggedInEmails(sb, requestedId);
        const emails = (locs ?? []).map((l: any) => l.email).filter(Boolean);
        return json({
          total_accounts: (locs ?? []).length,
          logged_in: loggedIn.size,
          not_logged_in_with_email: emails.filter((e: string) => !loggedIn.has(e)).length,
          portal_url: await portalUrl(sb, requestedId),
        });
      }
      case "invite_portal": {
        const inviteLink = await portalUrl(sb, requestedId);
        return json({ emailed: false, invite_link: inviteLink, portal_url: inviteLink });
      }
      case "menus": {
        const { data } = await sb.from("ghl_custom_menus_cache").select("*").eq("agency_id", agencyId);
        return json({ menus: data ?? [] });
      }
      case "plan_menu": {
        const menuId = await planMenuId(sb, requestedId);
        if (!menuId) return json({ menu_id: null });
        const { data } = await sb.from("ghl_custom_menus_cache").select("menu_id, title, location_ids, all_locations")
          .eq("agency_id", agencyId).eq("menu_id", menuId).maybeSingle();
        return json({ menu_id: menuId, menu: data ?? null });
      }
      case "create_menu": {
        const ICONS = new Set(["arrow-right", "arrow-up", "rocket", "star", "question", "circle-question", "graduation-cap", "book", "play", "house", "bolt", "life-ring", "circle-info", "gift", "flag", "compass"]);
        const title = String(body.title ?? "").trim().slice(0, 60);
        const url = String(body.url ?? "").trim();
        const icon = String(body.icon ?? "");
        const scope = body.scope === "one" ? "one" : "all";
        const loc = String(body.location_id ?? "").trim();
        if (!title) return json({ error: "Give the menu link a name" }, 400);
        if (!/^https:\/\/[^\s]+$/.test(url) || url.length > 1000) return json({ error: "Menu link URL must start with https://" }, 400);
        if (!ICONS.has(icon)) return json({ error: "Pick an icon" }, 400);
        const c = await loadClient(sb, agencyId);
        if (!c) return json({ error: "Connect HighLevel first" }, 400);
        if (scope === "one") {
          if (!/^[A-Za-z0-9_-]{4,64}$/.test(loc)) return json({ error: "Pick a sub-account" }, 400);
          if (!(await locationBelongs(sb, agencyId, loc, c))) return json({ error: "That sub-account isn't in your HighLevel agency" }, 403);
        }
        let created: any;
        try {
          created = await c.api.createCustomMenu({
            title, url, icon: { name: icon, fontFamily: "fas" },
            showOnCompany: false, showOnLocation: true, showToAllLocations: scope === "all",
            locations: scope === "one" ? [loc] : [], openMode: "iframe", userRole: "all",
            allowCamera: false, allowMicrophone: false,
          });
        } catch (e) {
          const m = e instanceof GhlError ? e.message : "HighLevel error";
          return json({ error: e instanceof GhlError && (e.status === 401 || e.status === 403) ? `${m} HighLevel only applies newly added permissions to a freshly generated token, so turn on "Custom Menu Links (edit)" and create a new Private Integration token, then reconnect.` : m }, 502);
        }
        const menu = created?.customMenu ?? created?.customMenuLink ?? created;
        const menuId = menu?.id ? String(menu.id) : null;
        if (menuId) {
          await sb.from("agency_menu_config").upsert({ agency_id: requestedId, menu_link_id: menuId }, { onConflict: "agency_id" });
          try { await sync(sb, agencyId); } catch { /* cache refresh is best-effort */ }
        }
        return json({ ok: true, menu_link_id: menuId });
      }
      case "assign_menu": {
        const loc = String(body.location_id ?? "").trim();
        const mode = body.mode === "remove" ? "remove" : "add";
        const menuId = normalizeMenuId(body.menu_link_id) ?? (await planMenuId(sb, requestedId));
        if (!loc || !/^[A-Za-z0-9_-]{4,64}$/.test(loc)) return json({ error: "location_id required" }, 400);
        if (!menuId) return json({ error: "No menu link is saved for this plan yet" }, 400);
        const c = await loadClient(sb, agencyId);
        if (!c) return json({ error: "Connect HighLevel first" }, 400);
        if (!(await locationBelongs(sb, agencyId, loc, c))) return json({ error: "That sub-account isn't in your HighLevel agency" }, 403);
        const known = Array.isArray(body.known_location_ids) ? body.known_location_ids.map((id: unknown) => String(id)) : [];
        const r = await setMenuLocation(sb, c, menuId, loc, mode, { knownLocationIds: known, restrict: body.restrict === true });
        if (!r.ok) return json({ error: r.error }, r.status);
        return json({ status: mode === "add" ? "added" : "removed", menu_link_id: menuId, location_id: loc, changed: r.changed, reason: r.reason ?? null, location_ids: r.location_ids });
      }
      case "validate_location": {
        const loc = String(body.location_id ?? "").trim();
        if (!loc) return json({ error: "location_id required" }, 400);
        const c = await loadClient(sb, agencyId);
        return json({ valid: c ? await locationBelongs(sb, agencyId, loc, c) : null });
      }
      case "rotate_secret": {
        const a = await getAutomation(sb, agencyId);
        const secret = randomSecret();
        await sb.from("menu_automations").update({
          secret_hash: await sha256Hex(secret), secret_prefix: secret.slice(0, 8), secret_rotated_at: new Date().toISOString(),
          is_active: true, legacy_until: a.secret_hash ? a.legacy_until : new Date(Date.now() + 30 * 864e5).toISOString(),
        }).eq("id", a.id);
        return json({ secret, automation: sanitizeAuto({ ...a, secret_hash: "x", secret_prefix: secret.slice(0, 8) }) });
      }
      case "revoke_secret": {
        const a = await getAutomation(sb, agencyId);
        await sb.from("menu_automations").update({ secret_hash: null, secret_prefix: null }).eq("id", a.id);
        return json({ ok: true });
      }
      case "update_automation": {
        const a = await getAutomation(sb, agencyId);
        const patch: any = { updated_at: new Date().toISOString() };
        if (body.product_presets && typeof body.product_presets === "object") {
          const clean: Record<string, string> = {};
          for (const [k, v] of Object.entries(body.product_presets).slice(0, 100))
            if (typeof v === "string" && k.trim() && v.trim()) clean[k.trim().slice(0, 100)] = v.trim().slice(0, 100);
          patch.product_presets = clean;
        }
        if (typeof body.allow_any_preset === "boolean") patch.allow_any_preset = body.allow_any_preset;
        if (typeof body.allow_single_location_email === "boolean") patch.allow_single_location_email = body.allow_single_location_email;
        await sb.from("menu_automations").update(patch).eq("id", a.id);
        return json({ automation: sanitizeAuto({ ...a, ...patch }) });
      }
      case "events": {
        const { data } = await sb.from("menu_automation_events")
          .select("id, event_id, email, preset_name, product_id, status, attempts, location_ids, candidate_location_ids, error, created_at, updated_at")
          .eq("agency_id", agencyId).order("created_at", { ascending: false }).limit(100);
        return json({ events: data ?? [] });
      }
      case "resolve": {
        const id = String(body.id ?? "");
        const loc = String(body.location_id ?? "").trim();
        const { data: ev } = await sb.from("menu_automation_events").select("*").eq("id", id).eq("agency_id", agencyId).maybeSingle();
        if (!ev || !loc) return json({ error: "Event or location missing" }, 400);
        const c = await loadClient(sb, agencyId);
        if (c && !(await locationBelongs(sb, agencyId, loc, c))) return json({ error: "Location is not in your HighLevel company" }, 400);
        if (body.save_mapping) {
          const key = ev.subscription_id ? ["subscription", ev.subscription_id] : ev.email ? ["email", ev.email] : null;
          if (key) await sb.from("location_mappings").upsert({
            agency_id: agencyId, key_type: key[0], key_value: key[1], location_id: loc, created_by: auth.email,
          });
        }
        await sb.from("menu_automation_events").update({ explicit_location_id: loc }).eq("id", ev.id);
        return json({ result: await processEvent(sb, { ...ev, explicit_location_id: loc }) });
      }
      case "retry": {
        const { data: ev } = await sb.from("menu_automation_events").select("*").eq("id", String(body.id ?? "")).eq("agency_id", agencyId).maybeSingle();
        if (!ev) return json({ error: "Event not found" }, 404);
        return json({ result: await processEvent(sb, ev) });
      }
      default:
        return json({ error: "Unknown action" }, 400);
    }
  } catch (e) {
    const msg = e instanceof GhlError ? e.message : "Something went wrong";
    console.error("[ghl-connection]", action, e instanceof Error ? e.message : "error");
    return json({ error: msg }, e instanceof GhlError && e.status >= 400 && e.status < 500 ? 400 : 502);
  }
});

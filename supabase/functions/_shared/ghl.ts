// Shared HighLevel (LeadConnector) integration: token encryption, one API
// client, location resolution and preset application. Server-only.
import { createClient } from "npm:@supabase/supabase-js@2.45.0";
import { planMenuAssignment, type MenuSnapshot } from "./menuAssignment.ts";

export const GHL_BASE = "https://services.leadconnectorhq.com";
// HighLevel's documented API version header value.
export const GHL_VERSION = Deno.env.get("GHL_API_VERSION") || "2021-07-28";
export const KEY_VERSION = 1;

// ---------- crypto ----------
const enc = new TextEncoder();
const b64 = (u: Uint8Array) => btoa(String.fromCharCode(...u));
const unb64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

async function aesKey(): Promise<CryptoKey> {
  const raw = Deno.env.get("GHL_TOKEN_ENC_KEY");
  if (!raw) throw new Error("Encryption key not configured");
  const digest = await crypto.subtle.digest("SHA-256", enc.encode(raw));
  return crypto.subtle.importKey("raw", digest, "AES-GCM", false, ["encrypt", "decrypt"]);
}

export async function encryptToken(token: string, agencyId: string) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = new Uint8Array(
    await crypto.subtle.encrypt(
      { name: "AES-GCM", iv, additionalData: enc.encode(`ghl:${agencyId}`) },
      await aesKey(),
      enc.encode(token),
    ),
  );
  return { ciphertext: b64(ct), nonce: b64(iv), key_version: KEY_VERSION };
}

export async function decryptToken(row: { token_ciphertext: string; token_nonce: string; agency_id: string }) {
  const pt = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: unb64(row.token_nonce), additionalData: enc.encode(`ghl:${row.agency_id}`) },
    await aesKey(),
    unb64(row.token_ciphertext),
  );
  return new TextDecoder().decode(pt);
}

export async function sha256Hex(s: string) {
  const d = new Uint8Array(await crypto.subtle.digest("SHA-256", enc.encode(s)));
  return Array.from(d).map((b) => b.toString(16).padStart(2, "0")).join("");
}

// Only authorized connection status receives this short fingerprint.
export async function tokenPrefix(row: { token_ciphertext: string; token_nonce: string; agency_id: string }): Promise<string | null> {
  if (!row.token_ciphertext || !row.token_nonce) return null;
  try { return (await decryptToken(row)).slice(0, 6); }
  catch { return null; }
}

export function randomSecret() {
  const b = crypto.getRandomValues(new Uint8Array(32));
  return "ssw_" + Array.from(b).map((x) => x.toString(16).padStart(2, "0")).join("");
}

// ---------- API client ----------
export class GhlError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export function ghlClient(token: string) {
  async function req(path: string, attempt = 0, init: { method?: string; body?: unknown; version?: string } = {}): Promise<any> {
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), 15000);
    let res: Response;
    try {
      res = await fetch(GHL_BASE + path, {
        method: init.method ?? "GET",
        headers: {
          Authorization: `Bearer ${token}`, Version: init.version ?? GHL_VERSION, Accept: "application/json",
          ...(init.body !== undefined ? { "Content-Type": "application/json" } : {}),
        },
        body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
        signal: ctl.signal,
      });
    } catch (e) {
      clearTimeout(t);
      if (attempt < 3) {
        await sleep(500 * 2 ** attempt + Math.random() * 400);
        return req(path, attempt + 1, init);
      }
      throw new GhlError(0, "HighLevel did not respond");
    }
    clearTimeout(t);
    if ((res.status === 429 || res.status >= 500) && attempt < 3) {
      const ra = Number(res.headers.get("retry-after")) || 0;
      await sleep(Math.max(ra * 1000, 600 * 2 ** attempt) + Math.random() * 500);
      return req(path, attempt + 1, init);
    }
    const text = await res.text();
    if (!res.ok) {
      let detail = "";
      try { const j = JSON.parse(text); detail = String(j?.message ?? j?.error ?? "").slice(0, 200); } catch { detail = text.slice(0, 200); }
      console.error(`[ghl] ${init.method ?? "GET"} ${path.split("?")[0]} -> ${res.status}: ${detail}`);
      const base =
        res.status === 401 ? "Token rejected by HighLevel"
        : res.status === 403 ? "HighLevel denied access"
        : res.status === 404 ? "Not found in HighLevel"
        : `HighLevel error ${res.status}`;
      throw new GhlError(res.status, detail ? `${base}: ${detail}` : base);
    }
    try { return JSON.parse(text); } catch { throw new GhlError(502, "Unreadable HighLevel response"); }
  }

  // Pages through list endpoints; throws (never returns partial) on failure.
  async function pageAll(build: (skip: number) => string, key: string, max = 5000) {
    const out: any[] = [];
    for (let skip = 0; skip < max; skip += 100) {
      const data = await req(build(skip));
      const items = (data?.[key] ?? []) as any[];
      out.push(...items);
      if (items.length < 100) break;
    }
    return out;
  }

  return {
    req,
    company: (companyId: string) => req(`/companies/${encodeURIComponent(companyId)}`),
    locations: (companyId: string) =>
      pageAll((s) => `/locations/search?companyId=${encodeURIComponent(companyId)}&skip=${s}&limit=100`, "locations"),
    location: (id: string) => req(`/locations/${encodeURIComponent(id)}`),
    customMenus: () => pageAll((s) => `/custom-menus/?skip=${s}&limit=100`, "customMenus"),
    usersByEmail: (companyId: string, email: string) =>
      pageAll(
        (s) => `/users/search?companyId=${encodeURIComponent(companyId)}&query=${encodeURIComponent(email)}&skip=${s}&limit=100`,
        "users",
      ),
    user: (id: string) => req(`/users/${encodeURIComponent(id)}`),
    customMenu: (id: string) => req(`/custom-menus/${encodeURIComponent(id)}`),
    // Create Custom Menu Link is documented on API version "v3"; fall back to the default version.
    createCustomMenu: async (body: unknown) => {
      try { return await req(`/custom-menus/`, 0, { method: "POST", body, version: "v3" }); }
      catch (e) {
        if (e instanceof GhlError && [400, 401, 422].includes(e.status)) return req(`/custom-menus/`, 0, { method: "POST", body });
        throw e;
      }
    },
    // Updates are full replacements. v3 matches create; fall back if the token rejects it.
    updateCustomMenu: async (id: string, body: unknown) => {
      try { return await req(`/custom-menus/${encodeURIComponent(id)}`, 0, { method: "PUT", body, version: "v3" }); }
      catch (e) {
        if (e instanceof GhlError && [400, 401, 422].includes(e.status)) return req(`/custom-menus/${encodeURIComponent(id)}`, 0, { method: "PUT", body });
        throw e;
      }
    },
  };
}

export function serviceClient() {
  return createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
    auth: { persistSession: false },
  });
}

// One HighLevel connection serves every plan ID of the same owner.
export async function connectionAgency(sb: any, agencyId: string): Promise<string> {
  const { data: direct } = await sb.from("ghl_connections").select("agency_id").eq("agency_id", agencyId).maybeSingle();
  if (direct) return agencyId;
  const { data: owner } = await sb.from("saas_suite_users")
    .select("agency_id, agency_id_basic, agency_id_advanced, agency_id_elite")
    .or(`agency_id.eq.${agencyId},agency_id_basic.eq.${agencyId},agency_id_advanced.eq.${agencyId},agency_id_elite.eq.${agencyId}`)
    .maybeSingle();
  const ids = owner ? [owner.agency_id, owner.agency_id_basic, owner.agency_id_advanced, owner.agency_id_elite].filter(Boolean) : [];
  if (!ids.length) return agencyId;
  const { data: rows } = await sb.from("ghl_connections").select("agency_id, status").in("agency_id", ids);
  const live = (rows ?? []).find((r: any) => r.status !== "disconnected") ?? (rows ?? [])[0];
  return live?.agency_id ?? agencyId;
}

// Tokens are bound to the agency ID they were saved under; an agency rename moves
// the row but not the binding. Try previous IDs from agency_id_migrations and
// re-encrypt under the current ID so later reads are direct.
async function decryptWithRenames(sb: any, row: any): Promise<string> {
  try { return await decryptToken(row); } catch (first) {
    const tried = new Set<string>([row.agency_id]);
    let frontier = [row.agency_id];
    for (let depth = 0; depth < 10 && frontier.length; depth++) {
      const { data: moves } = await sb.from("agency_id_migrations").select("old_agency_id").in("new_agency_id", frontier);
      frontier = [];
      for (const m of moves ?? []) {
        const old = m?.old_agency_id;
        if (!old || tried.has(old)) continue;
        tried.add(old); frontier.push(old);
        try {
          const token = await decryptToken({ ...row, agency_id: old });
          const e = await encryptToken(token, row.agency_id);
          await sb.from("ghl_connections").update({ token_ciphertext: e.ciphertext, token_nonce: e.nonce, key_version: e.key_version })
            .eq("agency_id", row.agency_id);
          return token;
        } catch { /* keep walking */ }
      }
    }
    throw first;
  }
}

export async function loadClient(sb: any, agencyIdIn: string) {
  const agencyId = await connectionAgency(sb, agencyIdIn);
  const { data } = await sb.from("ghl_connections").select("*").eq("agency_id", agencyId).maybeSingle();
  if (!data || data.status === "disconnected") return null;
  return { conn: data, api: ghlClient(await decryptWithRenames(sb, data)) };
}

// ---------- location ownership ----------
export async function locationBelongs(sb: any, agencyId: string, locationId: string, c: any): Promise<boolean> {
  const cacheId = c?.conn?.agency_id ?? (await connectionAgency(sb, agencyId));
  if (!c) return false;
  // Never trust the saved list — it goes stale. A location ID the caller gives us is
  // real; ask HighLevel directly whether it belongs to this agency.
  try {
    const loc = await c.api.location(locationId);
    const l = loc?.location ?? loc;
    if (String(l?.companyId ?? "") === String(c.conn.company_id)) {
      await cacheLocation(sb, cacheId, l);
      return true;
    }
  } catch (e) {
    console.log("locationBelongs direct lookup failed", locationId, (e as any)?.message);
  }
  // Fallback: search the company's sub-account list (same call the sync uses).
  try {
    const all = await c.api.locations(c.conn.company_id);
    const l = all.find((x: any) => String(x?.id) === locationId);
    if (l) { await cacheLocation(sb, cacheId, l); return true; }
    console.log("locationBelongs: not in company list", locationId, all.length);
  } catch (e) {
    console.log("locationBelongs list lookup failed", locationId, (e as any)?.message);
  }
  return false;
}

async function cacheLocation(sb: any, agencyId: string, l: any) {
  const id = String(l?.id ?? l?._id ?? "");
  if (!id) return;
  await sb.from("ghl_locations_cache").delete().eq("agency_id", agencyId).eq("location_id", id);
  await sb.from("ghl_locations_cache").insert({
    agency_id: agencyId, location_id: id, name: l.name ?? null, synced_at: new Date().toISOString(),
    email: l.email ? String(l.email).trim().toLowerCase() : null, phone: l.phone ?? null,
    company_name: l.business?.name ?? l.companyName ?? l.name ?? null,
  });
}

// ---------- email -> location ----------
export type Resolution =
  | { kind: "one"; locationId: string }
  | { kind: "none"; reason: string }
  | { kind: "many"; candidates: string[]; reason: string };

export async function resolveByEmail(sb: any, agencyId: string, c: any, emailRaw: string): Promise<Resolution> {
  const email = emailRaw.trim().toLowerCase();
  const users = await c.api.usersByEmail(c.conn.company_id, email);
  const exact = users.filter((u: any) => String(u?.email ?? "").trim().toLowerCase() === email);
  if (exact.length === 0) return { kind: "none", reason: "No HighLevel user with that email yet" };
  if (exact.length > 1) return { kind: "many", candidates: [], reason: "More than one HighLevel user has that email" };
  const full = await c.api.user(exact[0].id);
  const roles = full?.roles ?? {};
  const ids: string[] = Array.from(new Set(((roles.locationIds ?? []) as any[]).map(String).filter(Boolean)));
  if (ids.length === 0) {
    return String(roles.type).toLowerCase() === "agency"
      ? { kind: "many", candidates: [], reason: "Agency-level user — pick the sub-account manually" }
      : { kind: "none", reason: "User has no sub-account yet" };
  }
  const owned: string[] = [];
  for (const id of ids) if (await locationBelongs(sb, agencyId, id, c)) owned.push(id);
  if (owned.length === 0) return { kind: "none", reason: "User's sub-accounts are not in this company yet" };
  if (owned.length > 1) return { kind: "many", candidates: owned, reason: "User has several sub-accounts" };
  return { kind: "one", locationId: owned[0] };
}

// ---------- apply ----------
export async function applyPreset(
  sb: any,
  agencyId: string,
  presetName: string,
  locationId: string,
  automationId: string | null,
): Promise<{ ok: true; hidden: string[] } | { ok: false; error: string }> {
  const { data: presets } = await sb.from("menu_link_rules").select("*")
    .eq("agency_id", agencyId).ilike("preset_name", presetName.trim());
  if (!presets?.length) return { ok: false, error: `No preset named "${presetName}"` };
  const template = presets.find((p: any) => !p.automation_id) ?? presets[0];
  const hidden = template.hidden_links ?? [];

  if (automationId) {
    // Plan change: replace only rules this automation owns on this location.
    await sb.from("menu_link_rules").delete()
      .eq("agency_id", agencyId).eq("sub_account_id", locationId).eq("automation_id", automationId)
      .not("preset_name", "ilike", template.preset_name);
    const { data: own } = await sb.from("menu_link_rules").select("id")
      .eq("agency_id", agencyId).eq("sub_account_id", locationId).eq("automation_id", automationId).maybeSingle();
    const row = { hidden_links: hidden, preset_name: template.preset_name, is_active: true, updated_at: new Date().toISOString() };
    const r = own
      ? await sb.from("menu_link_rules").update(row).eq("id", own.id)
      : await sb.from("menu_link_rules").insert({ ...row, agency_id: agencyId, sub_account_id: locationId, automation_id: automationId });
    if (r.error) return { ok: false, error: "Could not save rule" };
  } else {
    // Legacy behaviour: one rule per location.
    const { data: existing } = await sb.from("menu_link_rules").select("id")
      .eq("agency_id", agencyId).eq("sub_account_id", locationId).is("automation_id", null)
      .ilike("preset_name", template.preset_name).maybeSingle();
    const row = { hidden_links: hidden, preset_name: template.preset_name, is_active: true, updated_at: new Date().toISOString() };
    const r = existing
      ? await sb.from("menu_link_rules").update(row).eq("id", existing.id)
      : await sb.from("menu_link_rules").insert({ ...row, agency_id: agencyId, sub_account_id: locationId });
    if (r.error) return { ok: false, error: "Could not save rule" };
  }

  // Rebuild live CSS/JS immediately.
  const base = `${Deno.env.get("SUPABASE_URL")}/functions/v1/dynamic-styles?agency_id=${encodeURIComponent(agencyId)}&force=1`;
  await Promise.all(["css", "js"].map((t) => fetch(`${base}&type=${t}`).then((r) => r.body?.cancel()).catch(() => {})));
  return { ok: true, hidden };
}

// ---------- event processing ----------
const RETRY_MIN = [1, 5, 15, 60, 240, 720];

export async function processEvent(sb: any, ev: any) {
  const set = (patch: any) =>
    sb.from("menu_automation_events").update({ ...patch, updated_at: new Date().toISOString() }).eq("id", ev.id);
  const { data: auto } = ev.automation_id
    ? await sb.from("menu_automations").select("*").eq("id", ev.automation_id).maybeSingle()
    : { data: null };
  const c = await loadClient(sb, ev.agency_id).catch(() => null);
  let locationId: string | null = null;

  try {
    if (ev.explicit_location_id) {
      if (c && !(await locationBelongs(sb, ev.agency_id, ev.explicit_location_id, c))) {
        await set({ status: "failed", error: "Location is not in your connected HighLevel company" });
        return { status: "failed" };
      }
      locationId = ev.explicit_location_id;
    }
    if (!locationId) {
      for (const [type, val] of [["subscription", ev.subscription_id], ["email", ev.email?.toLowerCase()]]) {
        if (!val) continue;
        const { data: m } = await sb.from("location_mappings").select("location_id")
          .eq("agency_id", ev.agency_id).eq("key_type", type).eq("key_value", val).maybeSingle();
        if (m) { locationId = m.location_id; break; }
      }
    }
    if (!locationId) {
      if (!ev.email) {
        await set({ status: "failed", error: "No location_id or email provided" });
        return { status: "failed" };
      }
      if (!c) {
        await set({ status: "needs_review", error: "Connect HighLevel in Settings to look up buyers by email" });
        return { status: "needs_review" };
      }
      const r = await resolveByEmail(sb, ev.agency_id, c, ev.email);
      if (r.kind === "many") {
        await set({ status: "needs_review", error: r.reason, candidate_location_ids: r.candidates });
        return { status: "needs_review" };
      }
      if (r.kind === "none") {
        const attempts = (ev.attempts ?? 0) + 1;
        if (attempts > RETRY_MIN.length) {
          await set({ status: "needs_review", attempts, error: r.reason });
          return { status: "needs_review" };
        }
        await set({
          status: "retrying", attempts, error: r.reason,
          next_run_at: new Date(Date.now() + RETRY_MIN[attempts - 1] * 60000).toISOString(),
        });
        return { status: "queued" };
      }
      if (auto && !auto.allow_single_location_email) {
        await set({ status: "needs_review", error: "Email matched one sub-account; confirm it", candidate_location_ids: [r.locationId] });
        return { status: "needs_review" };
      }
      locationId = r.locationId;
    }

    // Ordering guard: a newer applied event for the same buyer wins.
    const keyCol = ev.subscription_id ? "subscription_id" : ev.email ? "email" : null;
    if (keyCol) {
      const { data: newer } = await sb.from("menu_automation_events").select("id")
        .eq("agency_id", ev.agency_id).eq(keyCol, ev[keyCol]).eq("status", "applied")
        .gt("created_at", ev.created_at).neq("preset_name", ev.preset_name).limit(1);
      if (newer?.length) {
        await set({ status: "needs_review", error: "A newer purchase event already set a different preset" });
        return { status: "needs_review" };
      }
    }

    const a = await applyPreset(sb, ev.agency_id, ev.preset_name, locationId!, ev.automation_id);
    if (!a.ok) {
      await set({ status: "failed", error: a.error });
      return { status: "failed" };
    }
    await set({ status: "applied", location_ids: [locationId], error: null });
    return { status: "applied", location_ids: [locationId] };
  } catch (e) {
    const attempts = (ev.attempts ?? 0) + 1;
    const msg = e instanceof GhlError ? e.message : "Temporary error";
    if (attempts > RETRY_MIN.length) {
      await set({ status: "failed", attempts, error: msg });
      return { status: "failed" };
    }
    await set({ status: "retrying", attempts, error: msg, next_run_at: new Date(Date.now() + RETRY_MIN[attempts - 1] * 60000).toISOString() });
    return { status: "queued" };
  }
}

// ---------- add / remove a sub-account on one custom menu link ----------
export function normalizeMenuId(v: unknown): string | null {
  const raw = typeof v === "string" ? v.trim() : "";
  if (!raw) return null;
  const m = raw.match(/custom-menu-link\/([^/?#\s]+)/i);
  if (m) return m[1];
  if (raw.includes("/")) return raw.split(/[?#]/)[0].split("/").filter(Boolean).pop() ?? null;
  return /^[A-Za-z0-9_-]{4,64}$/.test(raw) ? raw : null;
}

/** Menu link saved for a plan's agency ID (first link wins). */
export async function planMenuId(sb: any, planAgencyId: string): Promise<string | null> {
  const { data } = await sb.from("agency_menu_config").select("menu_link_id, menu_link_id_2")
    .eq("agency_id", planAgencyId).maybeSingle();
  return normalizeMenuId(data?.menu_link_id) ?? normalizeMenuId(data?.menu_link_id_2);
}

export async function setMenuLocation(
  sb: any, c: any, menuId: string, locationId: string, mode: "add" | "remove",
  options: { knownLocationIds?: string[]; restrict?: boolean } = {},
): Promise<{ ok: true; changed: boolean; location_ids: string[]; reason?: string } | { ok: false; error: string; status: number }> {
  let menu: any;
  try { const r = await c.api.customMenu(menuId); menu = r?.customMenu ?? r?.customMenuLink ?? r; }
  catch (e: any) { return { ok: false, status: e?.status === 404 ? 404 : 502, error: e?.status === 404 ? "Menu link not found in your HighLevel agency" : e.message }; }
  const plan = planMenuAssignment(menu as MenuSnapshot, locationId, mode, options);
  if (!plan.changed || !plan.body) {
    return { ok: true, changed: false, location_ids: plan.locationIds, reason: plan.reason };
  }
  try {
    await c.api.updateCustomMenu(menuId, plan.body);
  } catch (e: any) {
    return { ok: false, status: 502, error: e?.status === 403 ? "Token needs the Custom Menu Links (edit) scope: custom-menu-link.write" : e.message };
  }
  await sb.from("ghl_custom_menus_cache").update({ location_ids: plan.locationIds, all_locations: false, synced_at: new Date().toISOString() })
    .eq("agency_id", c.conn.agency_id).eq("menu_id", menuId);
  return { ok: true, changed: true, location_ids: plan.locationIds };
}

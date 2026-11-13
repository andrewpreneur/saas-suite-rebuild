// Adds or removes one sub-account on a HighLevel custom menu link, called from
// HighLevel workflows. Authenticated by X-SaaSSuite-Webhook-Secret (same hashed
// per-agency secret as apply-menu-preset). The menu link defaults to the one
// saved for the plan's agency_id; the buyer must resolve to exactly one
// validated sub-account.
import {
  serviceClient, sha256Hex, loadClient, connectionAgency, locationBelongs, resolveByEmail,
  planMenuId, normalizeMenuId, setMenuLocation,
} from "../_shared/ghl.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-saassuite-webhook-secret",
};
const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
const str = (v: unknown, max = 200) => {
  if (typeof v !== "string") return null;
  const t = v.trim();
  if (!t || ["null", "undefined"].includes(t.toLowerCase()) || /^\{\{.*\}\}$/.test(t)) return null;
  return t.slice(0, max);
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "POST only" }, 405);
  let body: any;
  try { body = await req.json(); } catch { return json({ error: "Invalid JSON body" }, 400); }

  const secret = req.headers.get("x-saassuite-webhook-secret")?.trim();
  if (!secret) return json({ error: "Missing X-SaaSSuite-Webhook-Secret header" }, 401);
  const sb = serviceClient();
  const { data: auto } = await sb.from("menu_automations").select("agency_id")
    .eq("secret_hash", await sha256Hex(secret)).eq("is_active", true).maybeSingle();
  if (!auto) return json({ error: "Invalid webhook secret" }, 401);

  const planId = str(body.agency_id, 100);
  if (!planId || !/^[A-Za-z0-9_-]+$/.test(planId)) return json({ error: "agency_id is required" }, 400);
  if ((await connectionAgency(sb, planId)) !== auto.agency_id) return json({ error: "agency_id does not match this secret" }, 403);

  const rawAction = String(body.action ?? "add").trim().toLowerCase();
  const mode = ["remove", "remove from sub account", "remove_from_sub_account"].includes(rawAction) ? "remove"
    : ["add", "add to sub account", "add_to_sub_account"].includes(rawAction) ? "add" : null;
  if (!mode) return json({ error: 'action must be "add" or "remove"' }, 400);

  const menuId = normalizeMenuId(body.menu_link_id) ?? (await planMenuId(sb, planId));
  if (!menuId) return json({ error: "No menu link saved for this agency_id — add one in SaaS Suite or send menu_link_id" }, 400);

  const c = await loadClient(sb, auto.agency_id);
  if (!c) return json({ error: "HighLevel is not connected" }, 400);

  let loc = str(body.location_id, 64);
  const email = str(body.email, 254)?.toLowerCase() ?? null;
  if (loc) {
    if (!/^[A-Za-z0-9_-]{4,64}$/.test(loc) || !(await locationBelongs(sb, auto.agency_id, loc, c)))
      return json({ error: "location_id is not in your HighLevel agency" }, 403);
  } else if (email) {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json({ error: "email is invalid" }, 400);
    const r = await resolveByEmail(sb, auto.agency_id, c, email);
    if (r.kind !== "one") return json({ error: r.reason }, 422);
    loc = r.locationId;
  } else return json({ error: "location_id or email is required" }, 400);

  const { data: knownRows } = await sb.from("ghl_locations_cache").select("location_id").eq("agency_id", auto.agency_id);
  const known = (knownRows ?? []).map((row: { location_id?: string }) => String(row.location_id || "")).filter(Boolean);
  const r = await setMenuLocation(sb, c, menuId, loc, mode, { knownLocationIds: known });
  if (!r.ok) return json({ error: r.error }, r.status);
  if (r.reason === "missing_roster") return json({ error: "Refresh sub-accounts in SaaS Suite before removing one. The link is shown everywhere, and an empty list would hide it from every sub-account." }, 409);
  return json({ status: mode === "add" ? "added" : "removed", menu_link_id: menuId, location_id: loc, changed: r.changed, reason: r.reason ?? null });
});

// Purchase-driven menu preset automation, called from HighLevel workflows.
// Authenticated by X-SaaSSuite-Webhook-Secret (hash-matched to one agency).
// Legacy unauthenticated calls (agency_id + location_id + preset_name) are
// accepted only during the transition window.
import { applyPreset, processEvent, serviceClient, sha256Hex } from "../_shared/ghl.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-saassuite-webhook-secret",
};
const LEGACY_CUTOFF = Date.parse("2026-11-06T00:00:00Z");
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
  const sb = serviceClient();
  let body: any;
  try { body = await req.json(); } catch { return json({ error: "Invalid JSON body" }, 400); }

  const secret = req.headers.get("x-saassuite-webhook-secret")?.trim();
  const preset = str(body.preset_name, 100);
  const agencyIdIn = str(body.agency_id, 100);
  const locationIn = str(body.location_id, 64);
  const email = str(body.email, 254)?.toLowerCase() ?? null;

  // ---------- Authenticated path ----------
  if (secret) {
    const { data: auto } = await sb.from("menu_automations").select("*")
      .eq("secret_hash", await sha256Hex(secret)).eq("is_active", true).maybeSingle();
    if (!auto) return json({ error: "Invalid webhook secret" }, 401);
    if (agencyIdIn && agencyIdIn !== auto.agency_id) return json({ error: "agency_id does not match this secret" }, 403);

    const productId = str(body.product_id, 100);
    const map = (auto.product_presets ?? {}) as Record<string, string>;
    let presetName = preset;
    if (productId && map[productId]) {
      if (presetName && presetName.toLowerCase() !== map[productId].toLowerCase())
        return json({ error: "That preset is not allowed for this product" }, 403);
      presetName = map[productId];
    } else if (!auto.allow_any_preset) {
      return json({ error: "Unknown product for this automation" }, 403);
    }
    if (!presetName) return json({ error: "preset_name or a mapped product_id is required" }, 400);
    if (!locationIn && !email) return json({ error: "location_id or email is required" }, 400);
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json({ error: "email is invalid" }, 400);

    const eventId = str(body.event_id, 200) ?? crypto.randomUUID();
    const fields = {
      email, preset_name: presetName, product_id: productId,
      subscription_id: str(body.subscription_id, 200), explicit_location_id: locationIn,
    };
    const payloadHash = await sha256Hex(JSON.stringify(fields));

    const { data: prior } = await sb.from("menu_automation_events").select("*")
      .eq("agency_id", auto.agency_id).eq("automation_id", auto.id).eq("event_id", eventId).maybeSingle();
    if (prior) {
      if (prior.payload_hash !== payloadHash) return json({ error: "event_id was already used with different data" }, 409);
      return json(prior.status === "applied"
        ? { status: "applied", location_ids: prior.location_ids, preset_name: prior.preset_name, duplicate: true }
        : { status: prior.status === "retrying" ? "queued" : prior.status, job_id: prior.id, duplicate: true }, 200);
    }

    const { data: ev, error } = await sb.from("menu_automation_events").insert({
      agency_id: auto.agency_id, automation_id: auto.id, event_id: eventId, payload_hash: payloadHash, ...fields,
    }).select("*").single();
    if (error || !ev) return json({ error: "Could not record the event" }, 500);

    const r: any = await processEvent(sb, ev);
    if (r.status === "applied") return json({ status: "applied", location_ids: r.location_ids, preset_name: presetName });
    if (r.status === "queued") return json({ status: "queued", job_id: ev.id }, 202);
    return json({ status: r.status, job_id: ev.id }, r.status === "failed" ? 422 : 202);
  }

  // ---------- Legacy path (transition only) ----------
  if (!agencyIdIn || !locationIn || !preset) return json({ error: "Missing webhook secret" }, 401);
  const { data: autos } = await sb.from("menu_automations").select("legacy_until, secret_hash").eq("agency_id", agencyIdIn);
  const hasSecret = (autos ?? []).some((a: any) => a.secret_hash);
  const until = hasSecret ? Math.max(...(autos ?? []).map((a: any) => Date.parse(a.legacy_until))) : LEGACY_CUTOFF;
  if (Date.now() > until) return json({ error: "Missing webhook secret — add it in SaaS Suite > Set Up Automation" }, 401);

  const a = await applyPreset(sb, agencyIdIn, preset, locationIn, null);
  if (!a.ok) return json({ error: a.error }, 404);
  await sb.from("menu_automation_events").insert({
    agency_id: agencyIdIn, event_id: `legacy-${crypto.randomUUID()}`, payload_hash: "legacy",
    preset_name: preset, explicit_location_id: locationIn, status: "applied", location_ids: [locationIn],
    error: "Sent without the webhook secret (legacy)",
  });
  return json({
    success: true, status: "applied", location_ids: [locationIn], preset_name: preset,
    warning: "Add the X-SaaSSuite-Webhook-Secret header; unsecured calls stop working soon.",
  });
});

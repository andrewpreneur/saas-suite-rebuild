import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { sendMetaEvent } from "../_shared/meta-capi.ts";
import { logCustomerMessage } from "../_shared/journey-log.ts";
import { urlAllowed } from "../_shared/pixel-host.ts";
import { metaSendPlan, metaTestEventCode, missingIsTestColumn, requestIsTest } from "../_shared/test-traffic.ts";
import { parseTrainingLeadWrite, trainingLeadHasAnswer } from "../_shared/one-feature-lead-body.ts";

let leadIsTestColumn: "unknown" | "no" = "unknown";

const WEBHOOK = "https://services.leadconnectorhq.com/hooks/T69cI1milcirIORef4Ib/webhook-trigger/59f9b039-9653-4e74-bb32-c29e26fecf53";
const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
const s = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");

type LeadRow = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  page: string;
  form: string;
  utm: unknown;
  created_at: string;
};

async function forwardTrainingLead(
  admin: ReturnType<typeof createClient>,
  row: LeadRow,
  has: boolean | null,
  isTest: boolean,
) {
  if (isTest) {
    console.log("one-feature lead webhook skipped test traffic", row.id);
    return false;
  }
  // Bonuses wait until Yes/No so the webhook does not record a guessed answer.
  if (row.form === "bonuses" && has === null) return false;
  const utm = row.utm && typeof row.utm === "object" ? row.utm as Record<string, string> : {};
  const label = has === true ? "Yes" : has === false ? "No" : "";
  try {
    const res = await fetch(WEBHOOK, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        event: "one_feature_optin",
        lead_id: row.id,
        name: row.name,
        email: row.email,
        phone: row.phone || "",
        page: row.page,
        form: row.form,
        utm,
        ...utm,
        first_name: row.name.split(" ")[0],
        last_name: row.name.split(" ").slice(1).join(" "),
        has_highlevel: label,
        opted_in_at: row.created_at,
      }),
      signal: AbortSignal.timeout(5000),
    });
    if (res.ok) {
      await admin.from("one_feature_training_leads").update({ webhook_sent_at: new Date().toISOString() }).eq("id", row.id);
      return true;
    }
    console.error("webhook status", res.status);
  } catch (e) { console.error("webhook failed", e); }
  return false;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") return json({ error: "Invalid body" }, 400);
  if (body.action === "plan") {
    const plan = s(body.plan, 20), id = s(body.lead_id, 40), em = s(body.email, 255).toLowerCase();
    if (!["97", "297", "497", "none", "not_sure"].includes(plan) || !id || !em) return json({ error: "Invalid" }, 400);
    const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    await db.from("one_feature_training_leads").update({ selected_plan: plan, plan_selected_at: new Date().toISOString() }).eq("id", id).eq("email", em);
    return json({ ok: true });
  }
  if (body.action === "highlevel") {
    const id = s(body.lead_id, 40), em = s(body.email, 255).toLowerCase();
    const has = trainingLeadHasAnswer(body);
    if (!id || !em || has === null) return json({ error: "Invalid" }, 400);
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const updated = await admin.from("one_feature_training_leads")
      .update({ has_highlevel: has })
      .eq("id", id).eq("email", em)
      .select("id, name, email, phone, page, form, utm, created_at, webhook_sent_at")
      .single();
    if (updated.error || !updated.data) return json({ error: "Could not save" }, 500);
    if (updated.data.webhook_sent_at) return json({ ok: true, lead_id: updated.data.id, forwarded: false });
    const isTest = requestIsTest({ body, cookieHeader: req.headers.get("cookie") });
    const forwarded = await forwardTrainingLead(admin, updated.data, has, isTest);
    return json({ ok: true, lead_id: updated.data.id, forwarded });
  }
  if (body.action === "update") {
    const id = s(body.lead_id, 40), em = s(body.email, 255).toLowerCase();
    const has = trainingLeadHasAnswer(body);
    const plan = s(body.plan, 20);
    const intent = s(body.intent, 20);
    if (!id || !em) return json({ error: "Invalid" }, 400);
    if (plan && !["97", "297", "497", "none", "not_sure"].includes(plan)) return json({ error: "Invalid" }, 400);
    if (intent && !["dfy", "self", "explore"].includes(intent)) return json({ error: "Invalid" }, 400);
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const current = await admin.from("one_feature_training_leads").select("utm").eq("id", id).eq("email", em).maybeSingle();
    if (current.error || !current.data) return json({ error: "Could not save" }, 500);
    const utm = current.data.utm && typeof current.data.utm === "object" ? { ...current.data.utm as Record<string, string> } : {};
    if (intent) utm.intent = intent;
    if (typeof body.via === "string") utm.via = s(body.via, 20);
    if (body.ghl_signup_via_affiliate === true) utm.ghl_signup_via_affiliate = "true";
    if (body.ghl_signup_via_affiliate === false) utm.ghl_signup_via_affiliate = "false";
    const patch: Record<string, unknown> = { utm };
    if (has !== null) patch.has_highlevel = has;
    if (plan) {
      patch.selected_plan = plan;
      patch.plan_selected_at = new Date().toISOString();
    }
    const updated = await admin.from("one_feature_training_leads").update(patch).eq("id", id).eq("email", em);
    if (updated.error) return json({ error: "Could not save" }, 500);
    return json({ ok: true, lead_id: id });
  }
  const parsed = parseTrainingLeadWrite(body);
  if (!parsed) return json({ error: "Check your details and try again." }, 400);
  const { name, email, phone: phoneRaw, page, form, has, earlyBonus } = parsed;
  const utm: Record<string, string> = {};
  if (body.utm && typeof body.utm === "object") {
    for (const [k, v] of Object.entries(body.utm).slice(0, 12)) if (typeof v === "string") utm[k.slice(0, 40)] = v.slice(0, 200);
  }
  const isTest = requestIsTest({ body, cookieHeader: req.headers.get("cookie") });
  if (typeof body.via === "string") utm.via = s(body.via, 20);
  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  // Same email on the same page is a re-submit, not a new opt-in. No Meta Lead.
  const prior = await admin.from("one_feature_training_leads").select("id").eq("email", email).eq("page", page).order("created_at", { ascending: false }).limit(1).maybeSingle();
  if (prior.error) return json({ error: "Could not save" }, 500);
  if (prior.data?.id) {
    const patch: Record<string, unknown> = { name, phone: phoneRaw || null, form, utm };
    if (has !== null) patch.has_highlevel = has;
    const patched = await admin.from("one_feature_training_leads").update(patch).eq("id", prior.data.id).eq("email", email);
    if (patched.error) return json({ error: "Could not save" }, 500);
    return json({ ok: true, lead_id: prior.data.id, created: false, forwarded: false });
  }
  const row: Record<string, unknown> = { name, email, phone: phoneRaw || null, has_highlevel: has, page, form, utm };
  if (isTest && leadIsTestColumn !== "no") row.is_test = true;
  let inserted = await admin.from("one_feature_training_leads").insert(row).select("id, created_at").single();
  if (inserted.error && row.is_test === true && missingIsTestColumn(inserted.error)) {
    leadIsTestColumn = "no";
    const { is_test: _drop, ...rest } = row;
    inserted = await admin.from("one_feature_training_leads").insert(rest).select("id, created_at").single();
  }
  const { data, error } = inserted;
  if (error || !data) return json({ error: "Could not save" }, 500);
  const lead: LeadRow = { id: data.id, name, email, phone: phoneRaw || null, page, form, utm, created_at: data.created_at };
  const skippedEarly = earlyBonus;
  const forwarded = skippedEarly ? false : await forwardTrainingLead(admin, lead, has, isTest);
  await logCustomerMessage({
    userEmail: email,
    channel: "webhook",
    templateKey: "one_feature_optin",
    provider: "ghl",
    status: isTest || skippedEarly ? "suppressed" : forwarded ? "sent" : "failed",
    source: "one-feature-lead",
    detail: isTest ? "test_traffic" : skippedEarly ? "waiting_for_highlevel" : forwarded ? null : "webhook_failed",
  });
  // One Lead per new row. Quiz, plan, and highlevel updates never reach this insert.
  // event_id is always lead_<row id>. The browser fires it only after created: true.
  const m = body.meta && typeof body.meta === "object" ? body.meta : {};
  const pageUrl = s(m.page_url, 500) || `https://saassuite.ai/${page}`;
  const stable = `lead_${data.id}`;
  // New pages omit event_id and fire the returned lead_<row id>. A cached page
  // already fired the id it sent; keep that string so the two copies still match.
  const eventId = s(m.event_id, 80) || stable;
  const trackLead = !parsed.quiz && !m.tracking_optout && urlAllowed(pageUrl);
  const plan = metaSendPlan(isTest, metaTestEventCode(Deno.env.get("META_TEST_EVENT_CODE")));
  if (trackLead && plan.send) {
    await sendMetaEvent({
      event_name: "Lead", event_id: eventId, email, phone: phoneRaw || null,
      first_name: name.split(" ")[0], last_name: name.split(" ").slice(1).join(" ") || null,
      fbp: s(m.fbp, 200) || null, fbc: s(m.fbc, 300) || null, fbclid: s(m.fbclid, 300) || null,
      event_source_url: pageUrl, external_id: String(data.id),
      content_name: page,
      client_ip: (req.headers.get("x-forwarded-for") || "").split(",")[0].trim() || null,
      client_user_agent: req.headers.get("user-agent"),
      is_test: isTest,
    });
  }
  return json({ ok: true, forwarded, lead_id: data.id, created: true, ...(trackLead ? { event_id: eventId } : {}) });
});

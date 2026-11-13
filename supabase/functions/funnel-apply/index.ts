import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { ghlYesNo } from "../_shared/ghl-yes-no.ts";
import { sendMetaEvent } from "../_shared/meta-capi.ts";
import { requestIsTest } from "../_shared/test-traffic.ts";

/**
 * Partial and final saves for /agents, HighLevelers, and /founders-plan.
 * Webhook URLs come from env only and never cross funnels.
 * Agents: GHL_AGENTS_INBOUND_WEBHOOK_URL.
 * HighLevelers posts on step done to GHL_HL_INBOUND_WEBHOOK_URL.
 * Founders Plan posts on step done to GHL_FOUNDERS_PLAN_INBOUND_WEBHOOK_URL.
 * A missing Founders Plan URL still saves the lead. Do not invent one.
 * A HighLevelers row still on optin, ghl_status, or ghl_plan 60 minutes after its last update
 * is posted by this function the next time it runs. There is no clock: a quiet opt-in waits
 * for the next invoke. A scheduled call is still an ops follow-up.
 * A stuck post sets stuck_sent_at only after the webhook returns OK. A failure stays eligible
 * for the next sweep. handoff_sent_at is the done post, so a later done still sends when that
 * timestamp is empty.
 * Work with us is not accepted here.
 */

const AGENTS_SMS_CONSENT_TEXT =
  "By submitting, you agree SaaSSuite may text you about your application and the beta. Msg & data rates may apply. Reply STOP to opt out.";

const FOUNDERS_PLAN_SMS_CONSENT_TEXT =
  "By submitting, you agree we may text you about your bonuses and setup. Msg/data rates may apply. Reply STOP to opt out.";

const FUNNELS = new Set(["agents", "highlevelers", "highlevelers_upgrade", "founders_plan"]);
const AGENT_PLANS = new Set(["starter", "unlimited", "saas_pro", "other", "Starter", "Unlimited", "SaaS Pro"]);
const COUNTS = new Set(["0", "1-5", "6-20", "21+"]);
const STUCK_MS = 60 * 60 * 1000;
const STUCK_STEPS = ["optin", "ghl_status", "ghl_plan"];

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const text = (value: unknown, max: number) => (typeof value === "string" ? value.trim().slice(0, max) : "");

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function bool(value: unknown): boolean | null {
  if (value === true || value === false) return value;
  return null;
}

function toE164(raw: string): string | null {
  const trimmed = raw.trim();
  const digits = trimmed.replace(/\D/g, "");
  if (trimmed.startsWith("+")) {
    const e164 = `+${digits}`;
    return /^\+[1-9]\d{7,14}$/.test(e164) ? e164 : null;
  }
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return null;
}

function utmOf(body: Record<string, unknown>, current: unknown): Record<string, string> {
  const out: Record<string, string> = {};
  const sources = [asRecord(current), asRecord(body.utm)];
  for (const source of sources) {
    for (const [key, value] of Object.entries(source)) {
      if ((key.startsWith("utm_") || key === "fbclid") && typeof value === "string" && value.trim()) {
        out[key.slice(0, 40)] = value.trim().slice(0, 200);
      }
    }
  }
  return out;
}

function flatUtm(utm: Record<string, string>): Record<string, string> {
  const flat: Record<string, string> = {};
  for (const key of ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term", "utm_id", "fbclid"]) {
    flat[key] = utm[key] || "";
  }
  return flat;
}

function agentHasAccount(answers: Record<string, unknown>): boolean | null {
  if (answers.has_ghl === true || answers.has_highlevel === true) return true;
  if (answers.has_ghl === false || answers.has_highlevel === false) return false;
  return null;
}

/** Keep the boolean in the row. Drop ghl_plan on the No path so a Yes→No edit does not leave it behind. */
function normalizeAgentsAnswers(answers: Record<string, unknown>) {
  const has = agentHasAccount(answers);
  delete answers.name;
  if (has === true) {
    answers.has_ghl = true;
    answers.has_highlevel = true;
    answers.path = "yes";
  } else if (has === false) {
    answers.has_ghl = false;
    answers.has_highlevel = false;
    answers.path = "no";
    delete answers.ghl_plan;
  }
}

function agentsPayload(row: { email: string; session_key: string; landing_url: string | null; utm: Record<string, string>; answers: Record<string, unknown>; submitted_at: string }) {
  const has = agentHasAccount(row.answers) === true;
  const plan = has ? text(row.answers.ghl_plan, 40) : "";
  return {
    email: row.email,
    phone: text(row.answers.phone, 20),
    funnel: "agents",
    has_highlevel: ghlYesNo(has),
    ghl_plan: plan,
    sub_account_count: text(row.answers.sub_account_count, 20),
    path: has ? "yes" : "no",
    submitted_at: row.submitted_at,
    session_id: row.session_key,
    ...flatUtm(row.utm),
    landing_url: row.landing_url || "",
    sms_consent: true,
    sms_consent_text: AGENTS_SMS_CONSENT_TEXT,
    sms_consent_at: row.submitted_at,
  };
}

function agentsWebhookUrl() {
  return (Deno.env.get("GHL_AGENTS_INBOUND_WEBHOOK_URL") || Deno.env.get("AGENTS_INBOUND_WEBHOOK_URL") || "").trim();
}

async function postAgentsWebhook(
  admin: ReturnType<typeof createClient>,
  id: string,
  webhook: string,
  outbound: Record<string, unknown>,
  answers: Record<string, unknown>,
  mode: "final" | "stuck" = "final",
) {
  let lastError = "not sent";
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await fetch(webhook, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(outbound),
        signal: AbortSignal.timeout(5000),
      });
      if (res.ok) {
        const sentAt = new Date().toISOString();
        const priorGhl = asRecord(answers._ghl);
        const ghl = { ...priorGhl, status: "sent", attempts: attempt, last_error: "", sent_at: sentAt };
        if (mode === "stuck") {
          // The partial opt-in is recorded. handoff_sent_at stays empty so step done can still post.
          await admin.from("funnel_apply_leads").update({
            handoff_claimed_at: null,
            answers: { ...answers, _ghl: { ...ghl, stuck_sent_at: sentAt } },
          }).eq("id", id);
        } else {
          await admin.from("funnel_apply_leads").update({
            handoff_sent_at: sentAt,
            answers: { ...answers, _ghl: ghl },
          }).eq("id", id);
        }
        return;
      }
      lastError = `status ${res.status}`;
    } catch (error) {
      lastError = error instanceof Error ? error.message : "request failed";
    }
    if (attempt < 3) await new Promise((resolve) => setTimeout(resolve, attempt * 400));
  }
  const priorGhl = asRecord(answers._ghl);
  await admin.from("funnel_apply_leads").update({
    handoff_claimed_at: null,
    answers: { ...answers, _ghl: { ...priorGhl, status: "failed", attempts: 3, last_error: lastError, sent_at: null } },
  }).eq("id", id);
}

function scheduleBackground(task: Promise<unknown>) {
  const runtime = (globalThis as { EdgeRuntime?: { waitUntil?: (promise: Promise<unknown>) => void } }).EdgeRuntime;
  if (runtime?.waitUntil) runtime.waitUntil(task);
  else void task;
}

function highlevelersOutbound(row: {
  email: string | null;
  name: string | null;
  funnel: string;
  session_key: string;
  step: string;
  answers: Record<string, unknown>;
  utm: Record<string, string>;
  landing_url: string | null;
  created_at?: string | null;
  updated_at?: string | null;
}) {
  const pathValue = text(row.answers.path, 20);
  return {
    email: row.email || "",
    name: text(row.name, 60) || text(row.answers.name, 60),
    funnel: row.funnel,
    path: pathValue === "signup" || pathValue === "upgrade" ? pathValue : "unknown",
    ghl_status: text(row.answers.ghl_status, 20),
    ghl_plan: text(row.answers.ghl_plan, 20),
    ghl_link_clicked_at: text(row.answers.ghl_link_clicked_at, 40),
    step: row.step,
    session_id: row.session_key,
    ...flatUtm(row.utm),
    landing_url: row.landing_url || "",
    created_at: text(row.created_at, 40),
    updated_at: text(row.updated_at, 40),
  };
}

function foundersMeta(
  priorAnswers: Record<string, unknown>,
  incoming: Record<string, unknown>,
  utm: Record<string, string>,
  landing: string | null,
  step: string,
  now: string,
  userAgent: string,
) {
  const prior = asRecord(priorAnswers._meta);
  const next = asRecord(incoming._meta);
  const stepTimes = { ...asRecord(prior.step_times), ...asRecord(next.step_times) };
  if ((step === "optin" || step === "done") && !text(stepTimes[step], 40)) stepTimes[step] = now;
  return {
    utm_source: text(next.utm_source, 200) || utm.utm_source || "",
    utm_medium: text(next.utm_medium, 200) || utm.utm_medium || "",
    utm_campaign: text(next.utm_campaign, 200) || utm.utm_campaign || "",
    utm_content: text(next.utm_content, 200) || utm.utm_content || "",
    utm_term: text(next.utm_term, 200) || utm.utm_term || "",
    fbclid: text(next.fbclid, 300) || utm.fbclid || "",
    fbp: text(next.fbp, 200) || text(prior.fbp, 200),
    fbc: text(next.fbc, 300) || text(prior.fbc, 300),
    landing_url: text(next.landing_url, 500) || landing || text(prior.landing_url, 500),
    referrer: text(next.referrer, 500) || text(prior.referrer, 500),
    user_agent: text(next.user_agent, 400) || userAgent || text(prior.user_agent, 400),
    first_seen_at: text(prior.first_seen_at, 40) || text(next.first_seen_at, 40) || now,
    step_times: stepTimes,
  };
}

function foundersOutbound(row: {
  email: string | null;
  name: string | null;
  phone: string;
  session_key: string;
  utm: Record<string, string>;
  landing_url: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  submitted_at: string;
}) {
  return {
    name: text(row.name, 60),
    email: row.email || "",
    phone: text(row.phone, 20),
    funnel: "founders_plan",
    session_id: row.session_key,
    ...flatUtm(row.utm),
    landing_url: row.landing_url || "",
    created_at: text(row.created_at, 40),
    updated_at: text(row.updated_at, 40),
    sms_consent: true,
    sms_consent_text: FOUNDERS_PLAN_SMS_CONSENT_TEXT,
    sms_consent_at: row.submitted_at,
  };
}

async function sweepStuckHighlevelers(admin: ReturnType<typeof createClient>) {
  const cutoff = new Date(Date.now() - STUCK_MS).toISOString();
  const { data: rows, error } = await admin
    .from("funnel_apply_leads")
    .select("id, email, name, funnel, session_key, step, answers, utm, landing_url, created_at, updated_at, status, is_test, handoff_sent_at")
    .in("funnel", ["highlevelers", "highlevelers_upgrade"])
    .in("step", STUCK_STEPS)
    .is("handoff_sent_at", null)
    .lt("updated_at", cutoff)
    .limit(20);
  if (error || !rows) {
    if (error) console.error("stuck highlevelers read", error.message);
    return;
  }
  const webhook = (Deno.env.get("GHL_HL_INBOUND_WEBHOOK_URL") || "").trim();
  for (const row of rows) {
    if (row.is_test || row.status === "submitted" || row.handoff_sent_at) continue;
    const answers = asRecord(row.answers);
    const priorGhl = asRecord(answers._ghl);
    if (typeof priorGhl.stuck_sent_at === "string" && priorGhl.stuck_sent_at) continue;
    const outbound = highlevelersOutbound({
      email: row.email,
      name: row.name,
      funnel: row.funnel,
      session_key: row.session_key,
      step: row.step,
      answers,
      utm: asRecord(row.utm) as Record<string, string>,
      landing_url: row.landing_url,
      created_at: row.created_at,
      updated_at: row.updated_at,
    });
    if (!webhook) {
      console.log("TODO: GHL_HL_INBOUND_WEBHOOK_URL is not set. Stuck HighLevelers opt-in was saved. Do not invent a webhook URL.", row.id);
      answers._ghl = { ...priorGhl, status: "failed", attempts: 0, last_error: "TODO: GHL_HL_INBOUND_WEBHOOK_URL not configured", sent_at: null };
      await admin.from("funnel_apply_leads").update({ answers, handoff_claimed_at: null }).eq("id", row.id).is("handoff_sent_at", null);
      continue;
    }
    const claimedAt = new Date().toISOString();
    const staleClaim = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    let claim = await admin.from("funnel_apply_leads").update({ handoff_claimed_at: claimedAt }).eq("id", row.id).is("handoff_sent_at", null).is("handoff_claimed_at", null).select("id").maybeSingle();
    if (!claim.error && !claim.data) {
      claim = await admin.from("funnel_apply_leads").update({ handoff_claimed_at: claimedAt }).eq("id", row.id).is("handoff_sent_at", null).lt("handoff_claimed_at", staleClaim).select("id").maybeSingle();
    }
    if (claim.error || !claim.data) continue;
    await postAgentsWebhook(admin, row.id, webhook, outbound, answers, "stuck");
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  const body = asRecord(await req.json().catch(() => null));
  const url = Deno.env.get("SUPABASE_URL") || "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  if (!url || !serviceKey) return json({ error: "Could not save" }, 500);
  const admin = createClient(url, serviceKey, { auth: { persistSession: false } });
  const isTest = requestIsTest({ body, cookieHeader: req.headers.get("cookie") });
  if (!isTest) scheduleBackground(sweepStuckHighlevelers(admin));

  const funnel = text(body.funnel, 40);
  const sessionKey = text(body.session_key || body.session_id, 80);
  const step = text(body.step, 40) || "partial";
  if (!FUNNELS.has(funnel) || sessionKey.length < 8) return json({ error: "Invalid" }, 400);

  const incoming = asRecord(body.answers);
  const email = text(body.email ?? incoming.email, 255).toLowerCase();
  const finalStep = body.final === true || step === "submitted";

  const { data: sessionRow, error: readError } = await admin
    .from("funnel_apply_leads")
    .select("id, email, name, answers, utm, landing_url, status, step, handoff_sent_at, is_test, created_at, session_key")
    .eq("funnel", funnel)
    .eq("session_key", sessionKey)
    .maybeSingle();
  if (readError) {
    console.error("funnel apply read", readError.message);
    return json({ error: "Could not save" }, 500);
  }
  let existing = sessionRow;

  if (funnel === "agents" && email) {
    const { data: byEmail, error: emailError } = await admin
      .from("funnel_apply_leads")
      .select("id, email, answers, utm, landing_url, status, handoff_sent_at, is_test")
      .eq("funnel", "agents")
      .eq("email", email)
      .order("updated_at", { ascending: false })
      .limit(5);
    if (emailError) {
      console.error("funnel apply email", emailError.message);
      return json({ error: "Could not save" }, 500);
    }
    const submitted = (byEmail || []).find((row) => row.status === "submitted");
    if (submitted || existing?.status === "submitted") return json({ ok: true, already_applied: true, forwarded: false });
    if (!existing) {
      const partial = (byEmail || []).find((row) => row.status !== "submitted");
      if (partial) existing = partial;
    }
  }
  if (funnel === "agents" && existing?.status === "submitted") {
    return json({ ok: true, already_applied: true, forwarded: false });
  }

  const highlevelers = funnel === "highlevelers" || funnel === "highlevelers_upgrade";
  if (highlevelers && email) {
    const { data: byEmail, error: emailError } = await admin
      .from("funnel_apply_leads")
      .select("id, email, name, answers, utm, landing_url, status, step, handoff_sent_at, is_test, created_at")
      .eq("funnel", funnel)
      .eq("email", email)
      .order("updated_at", { ascending: false })
      .limit(1);
    if (emailError) {
      console.error("funnel apply email", emailError.message);
      return json({ error: "Could not save" }, 500);
    }
    const prior = byEmail?.[0];
    // A finished install is claimed. Later clicks on the same thanks screen
    // (the GHL button) still merge. Only a fresh opt-in is read-only.
    if (prior && step === "optin" && (prior.step === "done" || prior.status === "submitted")) {
      const priorAnswers = asRecord(prior.answers);
      const path = text(priorAnswers.path, 20);
      return json({
        ok: true,
        already_claimed: true,
        first_name: text(prior.name, 60) || text(priorAnswers.name, 60),
        path: path === "signup" || path === "upgrade" ? path : "",
        ghl_status: text(priorAnswers.ghl_status, 20),
        forwarded: false,
      });
    }
    if (prior) existing = prior;
  }

  if (funnel === "founders_plan" && email) {
    const { data: byEmail, error: emailError } = await admin
      .from("funnel_apply_leads")
      .select("id, email, name, answers, utm, landing_url, status, step, handoff_sent_at, is_test, created_at, session_key")
      .eq("funnel", "founders_plan")
      .eq("email", email)
      .order("updated_at", { ascending: false })
      .limit(1);
    if (emailError) {
      console.error("funnel apply email", emailError.message);
      return json({ error: "Could not save" }, 500);
    }
    const prior = byEmail?.[0];
    // A finished opt-in stays claimed. Copy and open clicks still merge onto that row.
    if (prior && step === "optin" && (prior.step === "done" || prior.status === "submitted")) {
      const priorAnswers = asRecord(prior.answers);
      return json({
        ok: true,
        already_claimed: true,
        first_name: text(prior.name, 60) || text(priorAnswers.name, 60),
        forwarded: false,
      });
    }
    if (prior) existing = prior;
  }

  const answers = { ...asRecord(existing?.answers), ...incoming };
  for (const [key, value] of Object.entries(incoming)) {
    if (value === null) delete answers[key];
  }
  if (email) answers.email = email;
  if (funnel === "agents") normalizeAgentsAnswers(answers);
  const utm = utmOf(body, existing?.utm);
  const landing = text(body.landing_url, 500) || text(existing?.landing_url, 500) || null;
  const storedEmail = email || text(existing?.email, 255).toLowerCase();
  const now = new Date().toISOString();

  const highlevelersWrite = funnel === "highlevelers" || funnel === "highlevelers_upgrade";
  const founders = funnel === "founders_plan";
  const givenName = text(body.name ?? answers.name, 60);
  if ((highlevelersWrite || founders) && givenName) answers.name = givenName;
  if (founders && !text(answers.phone, 30)) {
    const kept = text(asRecord(existing?.answers).phone, 30);
    if (kept) answers.phone = kept;
  }
  if (finalStep || highlevelersWrite || founders) {
    const invalid = validateFinal(funnel, storedEmail, answers, step);
    if (invalid) return json({ error: invalid }, 400);
    if (funnel === "agents") {
      answers.phone = toE164(text(answers.phone, 30));
      answers.sms_consent = true;
      answers.sms_consent_text = AGENTS_SMS_CONSENT_TEXT;
      answers.sms_consent_at = now;
    }
    if (founders) {
      const e164 = toE164(text(answers.phone, 30));
      if (e164) answers.phone = e164;
      answers.sms_consent = true;
      answers.sms_consent_text = FOUNDERS_PLAN_SMS_CONSENT_TEXT;
      if (!text(answers.sms_consent_at, 40)) answers.sms_consent_at = now;
      answers.page = "founders-plan";
      answers._meta = foundersMeta(asRecord(existing?.answers), incoming, utm, landing, step, now, text(req.headers.get("user-agent"), 400));
      if (!text(answers.upgrade_link_clicked_at, 40)) delete answers.upgrade_link_clicked_at;
      if (!text(answers.upgrade_link_copied_at, 40)) delete answers.upgrade_link_copied_at;
    }
  }

  const storedSession = founders && text(existing?.session_key, 80).length >= 8 ? text(existing?.session_key, 80) : sessionKey;
  const row = {
    funnel,
    session_key: storedSession,
    email: storedEmail || null,
    name: (highlevelersWrite || founders) ? givenName || text(existing?.name, 60) || null : text(existing?.name, 60) || null,
    step: (highlevelersWrite || founders) ? (finalStep ? "done" : step) : finalStep ? "submitted" : step,
    status: finalStep || existing?.status === "submitted" ? "submitted" : "partial",
    answers,
    utm,
    landing_url: landing,
    is_test: isTest || existing?.is_test === true,
    updated_at: now,
    ...(finalStep ? { submitted_at: now } : {}),
  };

  if (funnel === "agents") {
    Object.assign(row, { phone: text(answers.phone, 20) || null, name: null });
  }
  if (founders) {
    Object.assign(row, { phone: text(answers.phone, 20) || null, name: givenName || text(existing?.name, 60) || null });
  }

  let saved = existing
    ? await admin.from("funnel_apply_leads").update(row).eq("id", existing.id).select("id, handoff_sent_at").single()
    : await admin.from("funnel_apply_leads").insert(row).select("id, handoff_sent_at").single();
  let adoptedExisting = false;
  if ((saved.error || !saved.data) && founders && storedEmail) {
    const { data: raced } = await admin
      .from("funnel_apply_leads")
      .select("id, handoff_sent_at, session_key")
      .eq("funnel", "founders_plan")
      .eq("email", storedEmail)
      .limit(1)
      .maybeSingle();
    if (raced?.id) {
      adoptedExisting = true;
      saved = await admin
        .from("funnel_apply_leads")
        .update({ ...row, session_key: raced.session_key || storedSession })
        .eq("id", raced.id)
        .select("id, handoff_sent_at")
        .single();
    }
  }
  if (saved.error || !saved.data) {
    console.error("funnel apply write", saved.error?.message);
    return json({ error: "Could not save" }, 500);
  }

  // Lead once, with event_id lead_<row id>. HighLevelers and Founders fire when
  // this request inserts the row. Agents fire when the application is submitted
  // for the first time (the row was saved on an earlier step). Re-submits omit
  // event_id so the browser does not fire.
  const meta = asRecord(body.meta);
  // New pages omit event_id. A cached page already fired the id it sent.
  const metaLeadId = text(meta.event_id, 80) || `lead_${saved.data.id}`;
  const leadMatch = {
    fbp: text(meta.fbp, 200) || null,
    fbc: text(meta.fbc, 300) || null,
    fbclid: text(meta.fbclid, 300) || text(utm.fbclid, 300) || null,
    client_ip: (req.headers.get("x-forwarded-for") || "").split(",")[0].trim() || null,
    client_user_agent: req.headers.get("user-agent"),
    is_test: isTest,
  };
  let sendLead = false;
  let leadContent = "";
  const createdRow = !existing && !adoptedExisting;
  if (!isTest && highlevelersWrite && step === "optin" && createdRow) {
    sendLead = true;
    leadContent = funnel === "highlevelers" ? "highlevelers_optin" : "highlevelers_upgrade_optin";
  } else if (!isTest && founders && step === "optin" && createdRow) {
    sendLead = true;
    leadContent = "founders_plan_optin";
  } else if (!isTest && finalStep && funnel === "agents" && asRecord(existing?.answers).lead_sent !== true) {
    sendLead = true;
    leadContent = "agents_beta_apply";
  }
  if (sendLead) {
    answers.lead_sent = true;
    await admin.from("funnel_apply_leads").update({ answers }).eq("id", saved.data.id);
    void sendMetaEvent({
      event_name: "Lead",
      event_id: metaLeadId,
      email: storedEmail,
      phone: text(answers.phone, 20) || null,
      first_name: givenName || null,
      event_source_url: landing,
      external_id: saved.data.id,
      content_name: leadContent,
      ...leadMatch,
    });
  }

  if (!finalStep) {
    const leadAlreadySent = (highlevelersWrite || founders) && step === "optin" && asRecord(existing?.answers).lead_sent === true;
    return json({
      ok: true,
      forwarded: false,
      lead_id: saved.data.id,
      created: createdRow,
      ...(sendLead ? { event_id: metaLeadId } : {}),
      ...(leadAlreadySent ? { lead_already_sent: true } : {}),
    });
  }

  if (founders) {
    if (isTest || row.is_test || existing?.handoff_sent_at) {
      return json({ ok: true, forwarded: false });
    }
    const webhook = (Deno.env.get("GHL_FOUNDERS_PLAN_INBOUND_WEBHOOK_URL") || "").trim();
    const outbound = foundersOutbound({
      email: storedEmail,
      name: givenName || text(existing?.name, 60),
      phone: text(answers.phone, 20),
      session_key: storedSession,
      utm,
      landing_url: landing,
      created_at: text(existing?.created_at, 40) || now,
      updated_at: now,
      submitted_at: text(answers.sms_consent_at, 40) || now,
    });
    if (!webhook) {
      console.log("TODO: GHL_FOUNDERS_PLAN_INBOUND_WEBHOOK_URL is not set. The Founders Plan opt-in was saved. Do not invent a webhook URL.", saved.data.id);
      answers._ghl = { status: "failed", attempts: 0, last_error: "TODO: GHL_FOUNDERS_PLAN_INBOUND_WEBHOOK_URL not configured", sent_at: null };
      await admin.from("funnel_apply_leads").update({ answers }).eq("id", saved.data.id);
      return json({ ok: true, forwarded: false });
    }
    const claim = await admin
      .from("funnel_apply_leads")
      .update({ handoff_claimed_at: now })
      .eq("id", saved.data.id)
      .is("handoff_sent_at", null)
      .select("id")
      .maybeSingle();
    if (claim.error || !claim.data) return json({ ok: true, forwarded: false });
    scheduleBackground(postAgentsWebhook(admin, saved.data.id, webhook, outbound, answers));
    return json({ ok: true, forwarded: false });
  }

  if (highlevelersWrite) {
    // handoff_sent_at is the done webhook. A stuck post leaves it empty so this still sends.
    if (isTest || row.is_test || existing?.handoff_sent_at) {
      return json({ ok: true, forwarded: false });
    }
    const webhook = (Deno.env.get("GHL_HL_INBOUND_WEBHOOK_URL") || "").trim();
    const outbound = highlevelersOutbound({
      email: storedEmail,
      name: givenName || text(existing?.name, 60),
      funnel,
      session_key: sessionKey,
      step: "done",
      answers,
      utm,
      landing_url: landing,
      created_at: text((existing as { created_at?: unknown } | null)?.created_at, 40) || now,
      updated_at: now,
    });
    if (!webhook) {
      console.log("TODO: GHL_HL_INBOUND_WEBHOOK_URL is not set. The HighLevelers request was saved. Do not invent a webhook URL.", saved.data.id);
      answers._ghl = { status: "failed", attempts: 0, last_error: "TODO: GHL_HL_INBOUND_WEBHOOK_URL not configured", sent_at: null };
      await admin.from("funnel_apply_leads").update({ answers }).eq("id", saved.data.id);
      return json({ ok: true, forwarded: false });
    }
    const claim = await admin
      .from("funnel_apply_leads")
      .update({ handoff_claimed_at: now })
      .eq("id", saved.data.id)
      .is("handoff_sent_at", null)
      .select("id")
      .maybeSingle();
    if (claim.error || !claim.data) return json({ ok: true, forwarded: false });
    scheduleBackground(postAgentsWebhook(admin, saved.data.id, webhook, outbound, answers));
    return json({ ok: true, forwarded: false });
  }

  if (isTest || row.is_test) {
    console.log("funnel apply webhook skipped test traffic", saved.data.id);
    return json({ ok: true, forwarded: false });
  }

  const alreadyApplied = existing?.status === "submitted";
  if (funnel === "agents") {
    const webhook = agentsWebhookUrl();
    const payload = agentsPayload({ email: storedEmail, session_key: sessionKey, landing_url: landing, utm, answers, submitted_at: now });
    const outbound = { ...payload, has_highlevel: ghlYesNo(payload.has_highlevel) };
    if (!webhook) {
      // TODO: GHL Dev still has to supply the live URL. Do not invent one.
      console.log("TODO: GHL_AGENTS_INBOUND_WEBHOOK_URL is not set. The agents application was saved. Do not invent a webhook URL. EA handoff waits until GHL Dev supplies GHL_AGENTS_INBOUND_WEBHOOK_URL or AGENTS_INBOUND_WEBHOOK_URL.", saved.data.id);
      answers._ghl = { status: "failed", attempts: 0, last_error: "TODO: GHL_AGENTS_INBOUND_WEBHOOK_URL not configured", sent_at: null };
      await admin.from("funnel_apply_leads").update({ answers }).eq("id", saved.data.id);
      return json({ ok: true, already_applied: alreadyApplied, forwarded: false, ...(sendLead ? { event_id: metaLeadId, lead_id: saved.data.id } : {}) });
    }
    const claim = await admin
      .from("funnel_apply_leads")
      .update({ handoff_claimed_at: now })
      .eq("id", saved.data.id)
      .is("handoff_sent_at", null)
      .select("id")
      .maybeSingle();
    if (claim.error || !claim.data) return json({ ok: true, already_applied: true, forwarded: false, ...(sendLead ? { event_id: metaLeadId, lead_id: saved.data.id } : {}) });
    scheduleBackground(postAgentsWebhook(admin, saved.data.id, webhook, outbound, answers));
    return json({ ok: true, already_applied: alreadyApplied, forwarded: false, ...(sendLead ? { event_id: metaLeadId, lead_id: saved.data.id } : {}) });
  }

  return json({ error: "Invalid" }, 400);
});

function validateFinal(funnel: string, email: string, answers: Record<string, unknown>, step = ""): string | null {
  if (funnel === "founders_plan") {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return "Enter a valid email";
    if (text(answers.name, 60).length < 1) return "Enter your first name";
    if (!toE164(text(answers.phone, 30))) return "Enter a valid phone";
    return null;
  }
  if (funnel === "highlevelers" || funnel === "highlevelers_upgrade") {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return "Enter a valid email";
    if (text(answers.name, 60).length < 1) return "Enter your first name";
    const status = text(answers.ghl_status, 20);
    const plan = text(answers.ghl_plan, 20);
    if (status && !["none", "new", "has_it"].includes(status)) return "Pick one to continue.";
    if (plan && !["starter", "unlimited", "saas_pro", "not_sure", "none"].includes(plan)) return "Pick one to continue.";
    if (step === "done") {
      if (funnel === "highlevelers" && !["none", "new", "has_it"].includes(status)) return "Pick one to continue.";
      if (funnel === "highlevelers" && status === "has_it" && !plan) return "Pick one to continue.";
      if (funnel === "highlevelers_upgrade" && !plan) return "Pick one to continue.";
    }
    return null;
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return "Enter a valid email";
  const has = bool(answers.has_ghl);
  if (has === null) return "Tell us if you have a HighLevel account";
  if (funnel === "agents") {
    if (has && !AGENT_PLANS.has(text(answers.ghl_plan, 40))) return "Choose a plan";
    if (!COUNTS.has(text(answers.sub_account_count, 20))) return "Choose how many sub-accounts";
    if (!toE164(text(answers.phone, 30))) return "Enter a valid phone";
    return null;
  }
  return null;
}

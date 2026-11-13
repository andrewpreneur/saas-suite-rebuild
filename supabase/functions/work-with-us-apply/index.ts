import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { ghlYesNo } from "../_shared/ghl-yes-no.ts";
import { sendMetaEvent } from "../_shared/meta-capi.ts";
import { requestIsTest } from "../_shared/test-traffic.ts";

/**
 * JWT-only writes for /work-with-us. Name and email come from the Google session.
 * Final submit posts to GHL_WWU_INBOUND_WEBHOOK_URL when that secret is set.
 * Not deployed from this preview.
 */

const EMAIL_CONSENT = "By submitting, you agree SaaSSuite may email you about your application.";
const PLANS = new Set(["starter", "unlimited", "saas_pro", "not_sure"]);
const COUNTS = new Set(["0", "1-5", "6-20", "21-50", "51+"]);
const PATHS = new Set(["first_clients", "industry_product", "fix_ghl", "other"]);
const RANK: Record<string, number> = { magic_requested: 0, google: 1, email_verified: 1, has_highlevel: 2, account_count: 3, path: 4, submitted: 5 };

function wwuWebhookUrl() {
  return (Deno.env.get("GHL_WWU_INBOUND_WEBHOOK_URL") || "").trim();
}

function leadOnly(user: { id: string; created_at: string; user_metadata?: Record<string, unknown> }) {
  const meta = user.user_metadata || {};
  const flagged = meta.ss_lead_only === "true" || meta.ss_lead_only === true || meta.signup_source === "work_with_us";
  const created = new Date(user.created_at).getTime();
  const fresh = Number.isFinite(created) && Date.now() - created < 3 * 60 * 1000;
  return { flagged, fresh, created };
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}
function text(value: unknown, max: number) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}
function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}
function googleName(meta: Record<string, unknown>) {
  const full = text(meta.full_name, 120) || text(meta.name, 120);
  if (full) return full;
  return [text(meta.given_name, 60), text(meta.family_name, 60)].filter(Boolean).join(" ").slice(0, 120);
}
function publicAnswers(answers: Record<string, unknown>) {
  return {
    has_highlevel: answers.has_highlevel === true ? true : answers.has_highlevel === false ? false : undefined,
    ghl_plan: text(answers.ghl_plan, 40) || undefined,
    account_count: text(answers.account_count, 20) || undefined,
    path: text(answers.path, 40) || undefined,
    path_other: text(answers.path_other, 500) || undefined,
  };
}

function nextStep(answers: Record<string, unknown>, submitted: boolean) {
  if (submitted) return "submitted";
  if (answers.has_highlevel !== true && answers.has_highlevel !== false) return "has_highlevel";
  if (!COUNTS.has(text(answers.account_count, 20))) return "account_count";
  if (!PATHS.has(text(answers.path, 40))) return "path";
  return "path";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  const url = Deno.env.get("SUPABASE_URL") || "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  const anon = Deno.env.get("SUPABASE_ANON_KEY") || "";
  const header = req.headers.get("Authorization") || "";
  const body = asRecord(await req.json().catch(() => null));
  if (!url || !serviceKey) return json({ error: "Could not save" }, 500);
  const admin = createClient(url, serviceKey, { auth: { persistSession: false } });
  if (text(body.step, 40) === "magic_requested") return magicRequested(admin, body, req);
  if (!anon || !header.toLowerCase().startsWith("bearer ")) return json({ error: "Sign in required" }, 401);

  const userClient = createClient(url, anon, { global: { headers: { Authorization: header } }, auth: { persistSession: false } });
  const { data: userData, error: userError } = await userClient.auth.getUser();
  const user = userData.user;
  const email = user?.email?.trim().toLowerCase() || "";
  if (userError || !user || !email) return json({ error: "Sign in required" }, 401);

  const sessionKey = text(body.session_id, 80);
  const step = text(body.step, 40);
  if (sessionKey.length < 8 || !RANK[step] || step === "magic_requested") return json({ error: "Invalid" }, 400);

  const meta = asRecord(user.user_metadata);
  let name = googleName(meta);
  let nameSource = "google";
  if (!name) {
    const manual = text(body.name, 80);
    if (manual.length >= 2) {
      name = manual;
      nameSource = "manual";
    }
  }
  const firstName = (name || email.split("@")[0]).split(" ")[0];

  if (step === "google" || step === "email_verified") {
    const gate = leadOnly({ id: user.id, created_at: user.created_at, user_metadata: meta });
    if (gate.fresh || gate.flagged) {
      await admin.auth.admin.updateUserById(user.id, { user_metadata: { ss_lead_only: "true", signup_source: "work_with_us" } }).catch(() => null);
      let query = admin.from("saas_suite_users").delete().ilike("email", email).eq("plan", "STARTER").eq("source", "signup").is("stripe_customer_id", null);
      if (gate.flagged && Number.isFinite(gate.created)) {
        query = query.gte("created_at", new Date(gate.created - 60_000).toISOString()).lte("created_at", new Date(gate.created + 5 * 60_000).toISOString());
      } else {
        query = query.gte("created_at", new Date(Date.now() - 3 * 60 * 1000).toISOString());
      }
      await admin.from("saas_suite_users").update({ welcome_ai_email_sent_at: new Date().toISOString() }).ilike("email", email).eq("plan", "STARTER").eq("source", "signup").is("stripe_customer_id", null).gte("created_at", gate.flagged && Number.isFinite(gate.created) ? new Date(gate.created - 60_000).toISOString() : new Date(Date.now() - 3 * 60 * 1000).toISOString());
      await query;
    }
  }

  const { data: rows, error: readError } = await admin
    .from("funnel_apply_leads")
    .select("id, answers, utm, landing_url, status, step, session_key, handoff_sent_at, is_test")
    .eq("funnel", "work_with_us")
    .eq("email", email)
    .order("updated_at", { ascending: false })
    .limit(1);
  if (readError) return json({ error: "Could not save" }, 500);
  const existing = rows?.[0];
  if (existing && (existing.status === "submitted" || existing.handoff_sent_at) && (step === "google" || step === "email_verified")) {
    const path = text(asRecord(existing.answers).path, 40);
    return json({
      ok: true,
      already_applied: true,
      first_name: firstName,
      name,
      email,
      path,
      lead_id: existing.id,
      next_step: "submitted",
      answers: publicAnswers(asRecord(existing.answers)),
    });
  }

  const incoming = asRecord(body.answers_patch);
  const answers = { ...asRecord(existing?.answers) };
  for (const [key, value] of Object.entries(incoming)) {
    if (value === null) delete answers[key];
    else answers[key] = value;
  }
  if (answers.has_highlevel === false) delete answers.ghl_plan;
  if (answers.path && answers.path !== "other") delete answers.path_other;
  if (answers.ghl_plan && !PLANS.has(text(answers.ghl_plan, 40))) return json({ error: "Invalid" }, 400);
  if (answers.account_count && !COUNTS.has(text(answers.account_count, 20))) return json({ error: "Invalid" }, 400);
  if (answers.path && !PATHS.has(text(answers.path, 40))) return json({ error: "Invalid" }, 400);

  const priorMeta = asRecord(answers._meta);
  const ctx = asRecord(body.context);
  const stepTimes = { ...asRecord(priorMeta.step_times), [step]: new Date().toISOString() };
  const appMeta = asRecord(user.app_metadata);
  const signInVia = step === "email_verified" || text(appMeta.provider, 40) === "email" ? "magic_link" : "google";
  answers._meta = {
    ...priorMeta,
    via: signInVia,
    email_verified: signInVia === "magic_link" ? true : priorMeta.email_verified === true,
    auth_uid: user.id,
    google_sub: text(appMeta.provider_id || meta.sub || meta.provider_id, 80),
    name_source: nameSource,
    ...Object.fromEntries(Object.entries(ctx).filter(([, value]) => typeof value === "string" && value !== "").slice(0, 20)),
    step_times: stepTimes,
  };

  const submitted = step === "submitted";
  if (submitted) {
    if (answers.has_highlevel !== true && answers.has_highlevel !== false) return json({ error: "Pick one to continue." }, 400);
    if (!COUNTS.has(text(answers.account_count, 20))) return json({ error: "Pick one to continue." }, 400);
    if (!PATHS.has(text(answers.path, 40))) return json({ error: "Pick one to continue." }, 400);
    if (answers.path === "other" && text(answers.path_other, 500).length < 10) return json({ error: "Tell us a bit more (at least 10 characters)." }, 400);
    if (text(name, 80).length < 2) return json({ error: "Enter your name to continue." }, 400);
    answers.submitted_at = new Date().toISOString();
    answers.email_consent_text = EMAIL_CONSENT;
  }

  const alreadySent = asRecord(existing?.answers).lead_sent === true || Boolean(existing?.handoff_sent_at);
  if (submitted && !alreadySent) answers.lead_sent = true;

  const furthest = existing?.status === "submitted" ? "submitted" : text(existing?.step, 40);
  const storedStep = submitted ? "submitted" : (RANK[furthest] > RANK[step] ? furthest : step);
  const now = new Date().toISOString();
  const isTest = requestIsTest({ body, cookieHeader: req.headers.get("cookie") });
  const utm = { ...asRecord(existing?.utm) };
  for (const [key, value] of Object.entries(asRecord(ctx))) {
    if ((key.startsWith("utm_") || key === "fbclid") && typeof value === "string") utm[key] = value.slice(0, 200);
  }
  const row = {
    funnel: "work_with_us",
    session_key: sessionKey,
    email,
    name: name || null,
    phone: null,
    step: storedStep,
    status: submitted || existing?.status === "submitted" ? "submitted" : "partial",
    answers,
    utm,
    landing_url: text(ctx.landing_url, 500) || text(existing?.landing_url, 500) || null,
    is_test: isTest || existing?.is_test === true,
    updated_at: now,
    ...(submitted ? { submitted_at: now } : {}),
  };

  let saved = existing
    ? await admin.from("funnel_apply_leads").update(row).eq("id", existing.id).select("id, handoff_sent_at").single()
    : await admin.from("funnel_apply_leads").insert(row).select("id, handoff_sent_at").single();
  if (saved.error?.code === "23505") {
    if (existing?.id) {
      saved = await admin.from("funnel_apply_leads").update({ ...row, session_key: existing.session_key }).eq("id", existing.id).select("id, handoff_sent_at").single();
    } else {
      const { data: raced } = await admin.from("funnel_apply_leads").select("id, session_key").eq("funnel", "work_with_us").eq("email", email).limit(1);
      const winner = raced?.[0];
      if (winner?.id) {
        saved = await admin.from("funnel_apply_leads").update({ ...row, session_key: winner.session_key }).eq("id", winner.id).select("id, handoff_sent_at").single();
      } else {
        saved = await admin.from("funnel_apply_leads").insert({ ...row, session_key: crypto.randomUUID() }).select("id, handoff_sent_at").single();
      }
    }
  }
  if (saved.error || !saved.data) return json({ error: "Could not save" }, 500);

  const eventId = `wwu_${saved.data.id}`;
  if (submitted && !alreadySent) {
    const metaIn = asRecord(body.meta);
    void sendMetaEvent({
      event_name: "Lead",
      event_id: eventId,
      email,
      first_name: firstName,
      last_name: name.includes(" ") ? name.split(" ").slice(1).join(" ") : null,
      event_source_url: row.landing_url,
      external_id: user.id,
      content_name: "work_with_us_apply",
      fbp: text(metaIn.fbp, 200) || text(ctx.fbp, 200) || null,
      fbc: text(metaIn.fbc, 300) || text(ctx.fbc, 300) || null,
      fbclid: text(metaIn.fbclid, 300) || text(utm.fbclid, 300) || null,
      client_ip: (req.headers.get("x-forwarded-for") || "").split(",")[0].trim() || null,
      client_user_agent: req.headers.get("user-agent"),
      is_test: isTest,
    });
    const webhook = wwuWebhookUrl();
    const has = answers.has_highlevel === true;
    const metaRow = asRecord(answers._meta);
    const payload = {
      email,
      name,
      funnel: "work_with_us",
      via: text(metaRow.via, 20) || "google",
      has_highlevel: ghlYesNo(has),
      ghl_plan: has ? text(answers.ghl_plan, 40) : "",
      account_count: text(answers.account_count, 20),
      path: text(answers.path, 40),
      path_other: text(answers.path_other, 500),
      submitted_at: now,
      session_id: sessionKey,
      landing_url: row.landing_url || "",
      in_app_browser: text(metaRow.in_app_browser, 40),
      email_consent: true,
      email_consent_text: EMAIL_CONSENT,
      email_consent_at: now,
      utm_source: text(utm.utm_source, 200),
      utm_medium: text(utm.utm_medium, 200),
      utm_campaign: text(utm.utm_campaign, 200),
      utm_content: text(utm.utm_content, 200),
      utm_term: text(utm.utm_term, 200),
      fbclid: text(utm.fbclid, 300),
    };
    if (!webhook) {
      console.log("TODO: GHL_WWU_INBOUND_WEBHOOK_URL is not set. The application was saved. Do not invent a webhook URL. Do not reuse the Agents webhook.", saved.data.id);
      answers._ghl = { status: "failed", attempts: 0, last_error: "TODO: GHL_WWU_INBOUND_WEBHOOK_URL not configured", sent_at: null };
      await admin.from("funnel_apply_leads").update({ answers }).eq("id", saved.data.id);
    } else if (!isTest) {
      const task = postWwuWebhook(admin, saved.data.id, webhook, payload, answers);
      const runtime = (globalThis as { EdgeRuntime?: { waitUntil?: (promise: Promise<unknown>) => void } }).EdgeRuntime;
      if (runtime?.waitUntil) runtime.waitUntil(task);
      else void task;
    }
  }

  const done = submitted || existing?.status === "submitted";
  return json({
    ok: true,
    lead_id: saved.data.id,
    first_name: firstName,
    name,
    email,
    path: text(answers.path, 40),
    event_id: done ? eventId : undefined,
    next_step: nextStep(answers, done),
    already_applied: false,
    answers: publicAnswers(answers),
  });
});

async function magicRequested(admin: SupabaseClient, body: Record<string, unknown>, req: Request) {
  if (text(body.company_website, 200)) return json({ ok: true, ignored: true });
  const email = text(body.email, 255).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json({ error: "That email doesn't look right. Check for typos." }, 400);
  const sessionKey = text(body.session_id, 80);
  if (sessionKey.length < 8) return json({ error: "Invalid" }, 400);
  const ctx = asRecord(body.context);
  const ip = (req.headers.get("x-forwarded-for") || "").split(",")[0].trim().slice(0, 80);
  const hourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const now = new Date().toISOString();
  const { data: rows, error } = await admin
    .from("funnel_apply_leads")
    .select("id, answers, status, step, session_key, utm, landing_url, email")
    .eq("funnel", "work_with_us")
    .eq("email", email)
    .order("updated_at", { ascending: false })
    .limit(1);
  if (error) return json({ error: "Could not save" }, 500);
  let existing = rows?.[0];
  if (!existing) {
    const { data: bySession } = await admin
      .from("funnel_apply_leads")
      .select("id, answers, status, step, session_key, utm, landing_url, email")
      .eq("funnel", "work_with_us")
      .eq("session_key", sessionKey)
      .maybeSingle();
    if (bySession && !bySession.email) existing = bySession;
  }
  const prior = asRecord(existing?.answers);
  const meta = asRecord(prior._meta);
  const times = (Array.isArray(meta.magic_request_times) ? meta.magic_request_times : []).filter((item) => typeof item === "string" && item > hourAgo);
  if (times.length >= 3) return json({ error: "Too many tries. Wait a few minutes and try again." }, 429);
  if (ip) {
    const { data: recent } = await admin.from("funnel_apply_leads").select("answers").eq("funnel", "work_with_us").gte("updated_at", hourAgo).limit(50);
    const hits = (recent || []).filter((row) => text(asRecord(asRecord(row.answers)._meta).last_ip, 80) === ip).length;
    if (hits >= 10) return json({ error: "Too many tries. Wait a few minutes and try again." }, 429);
  }
  times.push(now);
  const locked = existing?.status === "submitted" || meta.email_verified === true;
  const nextMeta = locked
    ? { ...meta, magic_requests: Number(meta.magic_requests || 0) + 1, magic_request_times: times.slice(-8), last_ip: ip }
    : {
        ...meta,
        ...Object.fromEntries(Object.entries(ctx).filter(([, value]) => typeof value === "string" && value).slice(0, 20)),
        via: "magic_link",
        email_verified: false,
        in_app_browser: text(ctx.in_app_browser, 40) || text(meta.in_app_browser, 40),
        magic_requests: Number(meta.magic_requests || 0) + 1,
        magic_request_times: times.slice(-8),
        last_ip: ip,
      };
  const answers = { ...prior, email, _meta: nextMeta };
  const utm = { ...asRecord(existing?.utm) };
  if (!locked) {
    for (const [key, value] of Object.entries(ctx)) {
      if ((key.startsWith("utm_") || key === "fbclid") && typeof value === "string") utm[key] = value.slice(0, 200);
    }
  }
  const row = {
    funnel: "work_with_us",
    session_key: text(existing?.session_key, 80) || sessionKey,
    email,
    step: locked ? text(existing?.step, 40) || "submitted" : "magic_requested",
    status: existing?.status === "submitted" ? "submitted" : "partial",
    answers,
    utm,
    landing_url: text(ctx.landing_url, 500) || text(existing?.landing_url, 500) || null,
    updated_at: now,
  };
  const saved = existing
    ? await admin.from("funnel_apply_leads").update(row).eq("id", existing.id)
    : await admin.from("funnel_apply_leads").insert(row);
  if (saved.error) {
    console.error("magic requested", saved.error.message);
    return json({ error: "Could not save" }, 500);
  }
  return json({ ok: true });
}

async function postWwuWebhook(admin: SupabaseClient, id: string, webhook: string, payload: Record<string, unknown>, answers: Record<string, unknown>) {
  let lastError = "";
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await fetch(webhook, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(5000),
      });
      if (res.ok) {
        const sentAt = new Date().toISOString();
        answers._ghl = { status: "sent", attempts: attempt, last_error: null, sent_at: sentAt };
        await admin.from("funnel_apply_leads").update({ answers, handoff_sent_at: sentAt }).eq("id", id);
        return;
      }
      lastError = `status ${res.status}`;
    } catch (error) {
      lastError = error instanceof Error ? error.message : "fetch failed";
    }
    if (attempt < 3) await new Promise((resolve) => setTimeout(resolve, 400 * attempt));
  }
  answers._ghl = { status: "failed", attempts: 3, last_error: lastError, sent_at: null };
  await admin.from("funnel_apply_leads").update({ answers }).eq("id", id);
  console.error("work-with-us webhook failed", lastError);
}

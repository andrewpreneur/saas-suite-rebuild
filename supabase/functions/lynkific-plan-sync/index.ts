// Forwards SaaSSuite plan changes to the owner's Lynkific GoHighLevel webhook.
// Called by the database trigger (x-webhook-secret) or manually with the service role.
// If LYNKIFIC_PLAN_WEBHOOK_URL is unset, logs and returns 200 without posting.
import { createClient } from "npm:@supabase/supabase-js@2.57.2";
import { buildLynkificPlanPayload, type PlanSyncInput } from "./payload.ts";

const WEBHOOK_TIMEOUT_MS = 8000;
const DEFAULT_BATCH = 15;
const MAX_BATCH = 20;
const GAP_MS = 250;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-webhook-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

function safeEqual(a: string, b: string): boolean {
  if (!a || !b || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function webhookUrl(): string {
  return (Deno.env.get("LYNKIFIC_PLAN_WEBHOOK_URL") ?? "").trim();
}

async function authorized(req: Request, admin: ReturnType<typeof createClient>): Promise<boolean> {
  const serviceKey = (Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "").trim();
  const bearer = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
  const apiKey = (req.headers.get("apikey") ?? "").trim();
  if (serviceKey && (safeEqual(bearer, serviceKey) || safeEqual(apiKey, serviceKey))) return true;

  const provided = (req.headers.get("x-webhook-secret") ?? "").trim();
  if (!provided) return false;

  const { data, error } = await admin
    .from("lynkific_plan_sync_auth")
    .select("secret")
    .eq("id", 1)
    .maybeSingle();
  if (error || !data?.secret) {
    console.error("lynkific plan sync auth lookup failed", error?.message ?? "missing secret");
    return false;
  }
  return safeEqual(provided, String(data.secret));
}

async function postPlan(
  url: string,
  payload: NonNullable<ReturnType<typeof buildLynkificPlanPayload>>,
): Promise<{ ok: boolean; status: number }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), WEBHOOK_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      console.error("lynkific plan webhook failed", {
        saassuite_user_id: payload.saassuite_user_id,
        status: res.status,
        body: text.slice(0, 300),
      });
      return { ok: false, status: res.status };
    }
    return { ok: true, status: res.status };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("lynkific plan webhook error", {
      saassuite_user_id: payload.saassuite_user_id,
      error: message,
    });
    return { ok: false, status: 0 };
  } finally {
    clearTimeout(timer);
  }
}

function inputFromRow(row: Record<string, unknown>, previous: unknown, changedAt: unknown): PlanSyncInput {
  return {
    id: row.id as number | string,
    email: (row.email as string | null) ?? null,
    full_name: (row.full_name as string | null) ?? null,
    bonuses_phone: (row.bonuses_phone as string | null) ?? null,
    plan: (row.plan as string | null) ?? null,
    previous_plan: typeof previous === "string" ? previous : null,
    agency_id: (row.agency_id as string | null) ?? null,
    plan_changed_at: typeof changedAt === "string" ? changedAt : new Date().toISOString(),
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "POST required" }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceKey) {
    console.error("lynkific plan sync missing Supabase env");
    return json({ ok: false, error: "not configured" }, 500);
  }

  const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
  if (!(await authorized(req, admin))) return json({ error: "Unauthorized" }, 401);

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body || typeof body !== "object") return json({ error: "Invalid JSON body" }, 400);

  if (body.mode === "backfill") return backfill(admin, body);
  return syncOne(admin, body);
});

async function syncOne(admin: ReturnType<typeof createClient>, body: Record<string, unknown>) {
  let source: PlanSyncInput;
  if (body.plan == null && body.saassuite_user_id != null) {
    const id = Number(body.saassuite_user_id);
    if (!Number.isSafeInteger(id) || id <= 0) return json({ error: "invalid saassuite_user_id" }, 400);
    const { data, error } = await admin
      .from("saas_suite_users")
      .select("id, email, full_name, bonuses_phone, plan, agency_id")
      .eq("id", id)
      .maybeSingle();
    if (error) {
      console.error("lynkific plan sync user lookup failed", error.message);
      return json({ ok: false, error: "lookup failed" }, 500);
    }
    if (!data) return json({ ok: false, error: "user not found" }, 404);
    source = inputFromRow(data, body.previous_plan, body.plan_changed_at);
  } else {
    source = {
      id: (body.saassuite_user_id ?? body.id) as number | string,
      email: (body.email as string | null) ?? null,
      full_name: (body.full_name as string | null) ?? null,
      bonuses_phone: (body.bonuses_phone as string | null) ?? null,
      plan: (body.plan as string | null) ?? null,
      previous_plan: (body.previous_plan as string | null) ?? null,
      agency_id: (body.agency_id as string | null) ?? null,
      plan_changed_at: (body.plan_changed_at as string | null) ?? new Date().toISOString(),
    };
  }

  const payload = buildLynkificPlanPayload(source);
  if (!payload) {
    console.log("lynkific plan sync skipped: no real plan or email", {
      saassuite_user_id: source.id,
    });
    return json({ ok: true, skipped: "not_eligible" });
  }

  if (body.dry_run === true) return json({ ok: true, dry_run: true, payload });

  const url = webhookUrl();
  if (!url) {
    console.log("lynkific plan sync skipped: LYNKIFIC_PLAN_WEBHOOK_URL is unset");
    return json({ ok: true, skipped: "webhook_url_unset" });
  }

  const result = await postPlan(url, payload);
  if (!result.ok) return json({ ok: false, error: "webhook failed", status: result.status }, 502);
  return json({ ok: true, sent: true });
}

async function backfill(admin: ReturnType<typeof createClient>, body: Record<string, unknown>) {
  const dryRun = body.dry_run !== false;
  const requested = Number(body.batch_size ?? DEFAULT_BATCH);
  const batchSize = Number.isInteger(requested)
    ? Math.min(Math.max(requested, 1), MAX_BATCH)
    : DEFAULT_BATCH;

  let afterId = 0;
  if (body.after_id != null && body.after_id !== 0 && body.after_id !== "0") {
    afterId = Number(body.after_id);
    if (!Number.isSafeInteger(afterId) || afterId < 0) return json({ error: "invalid after_id" }, 400);
  }

  let query = admin
    .from("saas_suite_users")
    .select("id, email, full_name, bonuses_phone, plan, agency_id")
    .in("plan", ["STARTER", "BASIC", "ADVANCED"])
    .not("email", "is", null)
    .order("id", { ascending: true })
    .limit(batchSize);
  if (afterId > 0) query = query.gt("id", afterId);

  const { data, error } = await query;
  if (error) {
    console.error("lynkific plan backfill query failed", error.message);
    return json({ ok: false, error: "query failed" }, 500);
  }

  const rows = data ?? [];
  const url = webhookUrl();
  if (!dryRun && !url) {
    console.log("lynkific plan sync skipped: LYNKIFIC_PLAN_WEBHOOK_URL is unset");
    return json({ ok: true, dry_run: false, skipped: "webhook_url_unset" });
  }

  let eligible = 0;
  let sent = 0;
  let failed = 0;
  let skipped = 0;
  let preview: ReturnType<typeof buildLynkificPlanPayload> = null;

  for (const row of rows) {
    const payload = buildLynkificPlanPayload(
      inputFromRow(row, null, new Date().toISOString()),
    );
    if (!payload) {
      skipped++;
      continue;
    }
    eligible++;
    if (!preview) preview = payload;
    if (dryRun) continue;
    const result = await postPlan(url, payload);
    if (result.ok) sent++;
    else failed++;
    await sleep(GAP_MS);
  }

  const done = rows.length < batchSize;
  const lastId = rows.length ? rows[rows.length - 1].id : null;
  return json({
    ok: failed === 0,
    dry_run: dryRun,
    scanned: rows.length,
    eligible,
    sent: dryRun ? 0 : sent,
    failed,
    skipped,
    next_after_id: done ? null : lastId,
    done,
    ...(dryRun && preview ? { preview } : {}),
  });
}

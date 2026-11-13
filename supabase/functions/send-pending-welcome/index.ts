import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { secretEquals } from "../_shared/meta-capi-policy.ts";
import { resolveHubUrl } from "../_shared/hub-url.ts";
import { logCustomerMessage } from "../_shared/journey-log.ts";
import {
  WELCOME_CLAIM_STALE_MS,
  WELCOME_EMAIL_CUTOVER_ISO,
  WELCOME_MAX_ATTEMPTS,
  WELCOME_QUIET_MS,
  deliverWelcomeBatch,
  postJsonWebhook,
  resolveWelcomeLoginLink,
  welcomeHubAgencyId,
  type WelcomeUserRow,
} from "../_shared/welcome-email.ts";

const FOLLOWUP_WEBHOOK_URL =
  "https://services.leadconnectorhq.com/hooks/T69cI1milcirIORef4Ib/webhook-trigger/0179d008-873e-41a3-abc6-619365dc49af";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-api-key, x-webhook-secret",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const USER_COLUMNS =
  "id, email, full_name, plan, source, agency_name, agency_id, agency_id_basic, agency_id_advanced, agency_id_elite, created_at, welcome_ai_email_sent_at, hub_welcome_email_sent_at, hub_welcome_email_queued_at, welcome_email_attempts, welcome_email_next_attempt_at, welcome_email_claimed_at, welcome_email_force";

function service() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  );
}

async function cronAuthorized(req: Request, supabase: ReturnType<typeof service>): Promise<boolean> {
  const presented = (req.headers.get("x-webhook-secret") ?? "").trim();
  if (!presented) return false;
  const { data, error } = await supabase.from("welcome_email_cron_auth").select("secret").eq("id", 1).maybeSingle();
  if (error || typeof data?.secret !== "string" || !data.secret) {
    console.error("welcome cron auth unavailable", error?.message ?? "missing");
    return false;
  }
  return secretEquals(presented, data.secret);
}

function adminAuthorized(req: Request): boolean {
  const key = Deno.env.get("USER_360_API_KEY") || "";
  return !!key && req.headers.get("x-api-key") === key;
}

async function queueEmails(supabase: ReturnType<typeof service>, emails: string[]) {
  const queued: string[] = [];
  const skipped: string[] = [];
  for (const raw of emails) {
    const email = String(raw || "").trim().toLowerCase();
    if (!email.includes("@")) {
      skipped.push(String(raw || ""));
      continue;
    }
    const { data, error } = await supabase
      .from("saas_suite_users")
      .update({
        welcome_email_force: true,
        welcome_email_attempts: 0,
        welcome_email_next_attempt_at: null,
        welcome_email_last_error: null,
        welcome_email_claimed_at: null,
      })
      .ilike("email", email)
      .is("welcome_ai_email_sent_at", null)
      .select("email");
    if (error || !data?.length) skipped.push(email);
    else queued.push(String(data[0].email || email).toLowerCase());
  }
  return { queued, skipped };
}

async function loadDue(supabase: ReturnType<typeof service>, nowMs: number): Promise<WelcomeUserRow[]> {
  const nowIso = new Date(nowMs).toISOString();
  const quietBefore = new Date(nowMs - WELCOME_QUIET_MS).toISOString();
  const staleClaim = new Date(nowMs - WELCOME_CLAIM_STALE_MS).toISOString();
  const { data, error } = await supabase
    .from("saas_suite_users")
    .select(USER_COLUMNS)
    .is("welcome_ai_email_sent_at", null)
    .is("hub_welcome_email_sent_at", null)
    .is("hub_welcome_email_queued_at", null)
    .lt("welcome_email_attempts", WELCOME_MAX_ATTEMPTS)
    .or(`welcome_email_next_attempt_at.is.null,welcome_email_next_attempt_at.lte."${nowIso}"`)
    .or(`welcome_email_claimed_at.is.null,welcome_email_claimed_at.lt."${staleClaim}"`)
    .or(`and(created_at.gte."${WELCOME_EMAIL_CUTOVER_ISO}",created_at.lte."${quietBefore}"),welcome_email_force.eq.true`)
    .limit(10);
  if (error) throw new Error(error.message);
  return (data ?? []) as WelcomeUserRow[];
}

async function loadQueued(supabase: ReturnType<typeof service>, emails: string[]): Promise<WelcomeUserRow[]> {
  const rows: WelcomeUserRow[] = [];
  for (const email of emails) {
    const { data, error } = await supabase
      .from("saas_suite_users")
      .select(USER_COLUMNS)
      .ilike("email", email)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (data) rows.push(data as WelcomeUserRow);
  }
  return rows;
}

async function runDelivery(supabase: ReturnType<typeof service>, rows: WelcomeUserRow[], dryRun: boolean) {
  const nowMs = Date.now();
  return deliverWelcomeBatch({
    rows,
    nowMs,
    dryRun,
    claim: async (row) => {
      let query = supabase
        .from("saas_suite_users")
        .update({ welcome_email_claimed_at: new Date().toISOString() })
        .eq("id", row.id)
        .is("welcome_ai_email_sent_at", null);
      query = row.welcome_email_claimed_at
        ? query.eq("welcome_email_claimed_at", row.welcome_email_claimed_at)
        : query.is("welcome_email_claimed_at", null);
      const { data, error } = await query.select("id");
      if (error) {
        console.error("welcome claim failed", row.email, error.message);
        return false;
      }
      return (data?.length ?? 0) === 1;
    },
    authStatus: async (email) => {
      const { data, error } = await supabase.rpc("get_user_auth_status_by_email", { user_email: email });
      if (error) {
        console.error("welcome auth status", email, error.message);
        return "error";
      }
      const row = Array.isArray(data) ? data[0] : data;
      return row?.user_id ? "auth" : "none";
    },
    issueLink: (email) => resolveWelcomeLoginLink(supabase.auth.admin, email, false),
    hubUrl: async (row) => {
      const agencyId = welcomeHubAgencyId(row);
      if (!agencyId) return null;
      return resolveHubUrl(supabase, agencyId);
    },
    post: (payload) => postJsonWebhook(fetch, FOLLOWUP_WEBHOOK_URL, payload),
    markSent: async (row, nowIso, payload) => {
      const { data, error } = await supabase
        .from("saas_suite_users")
        .update({
          welcome_ai_email_sent_at: nowIso,
          last_followup_email_sent_at: nowIso,
          welcome_email_claimed_at: null,
          welcome_email_last_error: null,
        })
        .eq("id", row.id)
        .is("welcome_ai_email_sent_at", null)
        .select("id");
      if (error) {
        console.error("welcome stamp failed", row.email, error.message);
        return false;
      }
      const stamped = (data?.length ?? 0) === 1;
      if (!stamped) return false;
      await supabase.from("followup_email_log").insert({
        user_email: row.email,
        email_type: "welcome",
        sent: true,
        subject: payload.subject,
        event_count: 0,
      });
      await logCustomerMessage({
        userEmail: row.email,
        channel: "webhook",
        templateKey: "welcome",
        provider: "ghl",
        status: "sent",
        source: "send-pending-welcome",
      });
      return true;
    },
    markRetry: async (row, plan, error) => {
      console.error("welcome webhook failed", row.email, error, plan.exhausted ? "exhausted" : "retry");
      await supabase
        .from("saas_suite_users")
        .update({
          welcome_email_claimed_at: null,
          welcome_email_attempts: plan.attempts,
          welcome_email_next_attempt_at: new Date(plan.retryAtMs).toISOString(),
          welcome_email_last_error: error.slice(0, 500),
        })
        .eq("id", row.id)
        .is("welcome_ai_email_sent_at", null);
      await supabase.from("followup_email_log").insert({
        user_email: row.email,
        email_type: "welcome",
        sent: false,
        suppressed_reason: error.slice(0, 200),
        event_count: 0,
      });
      await logCustomerMessage({
        userEmail: row.email,
        channel: "webhook",
        templateKey: "welcome",
        provider: "ghl",
        status: "failed",
        source: "send-pending-welcome",
        detail: error.slice(0, 500),
      });
    },
    markTerminal: async (row, update) => {
      await supabase
        .from("saas_suite_users")
        .update({
          welcome_email_attempts: update.attempts,
          welcome_email_last_error: update.lastError,
          welcome_email_claimed_at: null,
        })
        .eq("id", row.id)
        .is("welcome_ai_email_sent_at", null);
    },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "POST required" }, 405);

  const supabase = service();
  const dryRun = Deno.env.get("WELCOME_EMAIL_DISABLE_SEND") === "1";
  let body: { emails?: unknown; sendNow?: unknown; source?: unknown } = {};
  try {
    const raw = await req.text();
    body = raw ? JSON.parse(raw) : {};
  } catch {
    return json({ error: "invalid json" }, 400);
  }

  try {
    if (adminAuthorized(req)) {
      const emails = Array.isArray(body.emails)
        ? body.emails.map((value) => String(value))
        : [];
      if (!emails.length) return json({ error: "emails required" }, 400);
      const queued = await queueEmails(supabase, emails);
      if (body.sendNow !== true) return json({ ok: true, ...queued, sent: false });
      const rows = await loadQueued(supabase, queued.queued);
      const results = await runDelivery(supabase, rows, dryRun);
      return json({ ok: true, ...queued, dryRun, results });
    }

    if (!(await cronAuthorized(req, supabase))) return json({ error: "unauthorized" }, 401);

    const work = (async () => {
      const rows = await loadDue(supabase, Date.now());
      const results = await runDelivery(supabase, rows, dryRun);
      const sent = results.filter((row) => row.status === "sent").length;
      const failed = results.filter((row) => row.status === "failed").length;
      console.log(`pending welcome: candidates ${rows.length}, sent ${sent}, failed ${failed}, dryRun ${dryRun}`);
      return results;
    })();

    // Cron only needs the job to start. The batch keeps going after the response.
    const edgeRuntime = (globalThis as { EdgeRuntime?: { waitUntil?: (p: Promise<unknown>) => void } }).EdgeRuntime;
    if (body.source === "cron" && edgeRuntime?.waitUntil) {
      edgeRuntime.waitUntil(work.catch((error) => console.error("[send-pending-welcome]", error)));
      return json({ ok: true, started: true, dryRun });
    }
    const results = await work;
    return json({ ok: true, dryRun, results });
  } catch (error) {
    console.error("[send-pending-welcome]", error);
    return json({ error: error instanceof Error ? error.message : "welcome send failed" }, 500);
  }
});

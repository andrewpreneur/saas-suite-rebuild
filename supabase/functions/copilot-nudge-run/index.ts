// Proactive CoPilot outreach runner.
//
// Called on a schedule (every 15 minutes). For every owner whose nudge is due
// AND who is inside their own working-hours window, it builds an account
// snapshot, has the CoPilot write a short check-in with recommendations, and
// delivers it on every enabled channel (Slack today; SMS/email webhooks are
// the same code path).
//
// Safety: single-flight lock, bounded batch, idempotent scheduling via
// next_due_at, and a circuit breaker that pauses outreach on AI billing/policy
// failures instead of retrying.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import {
  acquireLock,
  buildSnapshot,
  computeNextDueAt,
  deliver,
  generateNudge,
  inferPreferredHourLocal,
  normalizeSettings,
  releaseLock,
  renderPlainText,
  supabase,
  withinSendWindow,
  type Channel,
  type NudgeSettings,
} from "../_shared/nudge-core.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-api-key, x-cron-key, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const CRON_TOKEN = Deno.env.get("NUDGE_CRON_TOKEN") ?? "";
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const MAX_PER_RUN = 10;
const JOB = "copilot-nudge-run";

const PROJECT_KEYS = [
  Deno.env.get("SUPABASE_ANON_KEY"),
  Deno.env.get("SUPABASE_PUBLISHABLE_KEY"),
].filter((v): v is string => !!v);

// Full trust (allows owner_email / force / dry_run overrides).
function trusted(req: Request): boolean {
  const bearer = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
  const key = (req.headers.get("x-cron-key") ?? req.headers.get("x-api-key") ?? "").trim();
  const presented = key || bearer;
  if (!presented) return false;
  return presented === SERVICE_ROLE || (!!CRON_TOKEN && presented === CRON_TOKEN);
}

// The in-database scheduler authenticates with the project key; those runs may
// only do the ordinary due-work pass, never a targeted or forced send.
function schedulerKey(req: Request): boolean {
  const bearer = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
  const apikey = (req.headers.get("apikey") ?? "").trim();
  return PROJECT_KEYS.some((k) => bearer === k || apikey === k);
}

interface RunOptions {
  owner_email?: string;
  force?: boolean;      // ignore next_due_at + working-hours window
  dry_run?: boolean;    // generate but do not deliver, do not reschedule
  variant?: string;     // tone/angle hint (used for previewing variations)
  channels?: Channel[]; // override the owner's configured channels
}

async function runForOwner(settings: NudgeSettings, opts: RunOptions) {
  const now = new Date();
  const snapshot = await buildSnapshot(settings.owner_email);
  const generated = await generateNudge(snapshot, opts.variant);
  const channels = opts.channels?.length ? opts.channels : settings.channels;
  const preferredHour = await inferPreferredHourLocal(settings.owner_email, settings);

  if (opts.dry_run) {
    return {
      owner_email: settings.owner_email,
      dry_run: true,
      preferred_hour_local: preferredHour,
      channels,
      headline: generated.headline,
      body: generated.body,
      recommendations: generated.recommendations,
      plain_text: renderPlainText(generated),
      snapshot,
    };
  }

  const results = [];
  for (const channel of channels) {
    const { data: row, error: insErr } = await supabase
      .from("copilot_nudges")
      .insert({
        owner_email: settings.owner_email,
        kind: "account_digest",
        channel,
        headline: generated.headline,
        body: generated.body,
        recommendations: generated.recommendations,
        snapshot,
        status: "pending",
      })
      .select("id")
      .single();
    if (insErr) {
      console.error("nudge insert failed:", insErr.message);
      results.push({ channel, ok: false, error: insErr.message });
      continue;
    }

    const d = await deliver(channel, settings, snapshot, generated);
    await supabase
      .from("copilot_nudges")
      .update({
        status: d.ok ? "sent" : "failed",
        error: d.ok ? null : d.error ?? null,
        slack_channel_id: d.slack_channel_id ?? null,
        slack_ts: d.slack_ts ?? null,
        sent_at: d.ok ? new Date().toISOString() : null,
      })
      .eq("id", row.id);
    results.push({ channel, ok: d.ok, error: d.error, nudge_id: row.id, slack_ts: d.slack_ts });
  }

  const anySent = results.some((r) => r.ok);
  await supabase
    .from("copilot_nudge_settings")
    .update({
      last_sent_at: anySent ? now.toISOString() : settings.last_sent_at,
      next_due_at: computeNextDueAt(settings, preferredHour, now).toISOString(),
    })
    .eq("owner_email", settings.owner_email);

  return {
    owner_email: settings.owner_email,
    preferred_hour_local: preferredHour,
    headline: generated.headline,
    recommendations: generated.recommendations.map((r) => r.topic),
    results,
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  const isTrusted = trusted(req);
  if (!isTrusted && !schedulerKey(req)) return json({ error: "Unauthorized" }, 401);

  let opts: RunOptions = {};
  try {
    opts = (await req.json()) ?? {};
  } catch { /* empty body is a plain scheduled run */ }
  if (!isTrusted) opts = {}; // scheduler runs get the plain due-work pass only

  const scoped = !!opts.owner_email;
  if (!scoped && !(await acquireLock(JOB, 300))) {
    return json({ ok: true, skipped: "another run is in progress" });
  }

  try {
    let query = supabase.from("copilot_nudge_settings").select("*").eq("enabled", true);
    if (scoped) query = query.eq("owner_email", opts.owner_email!.toLowerCase().trim());
    else query = query.or(`next_due_at.is.null,next_due_at.lte.${new Date().toISOString()}`).limit(MAX_PER_RUN);

    const { data: rows, error } = await query;
    if (error) return json({ error: error.message }, 500);
    if (!rows?.length) return json({ ok: true, considered: 0, sent: [] });

    const sent: unknown[] = [];
    const skipped: unknown[] = [];

    for (const raw of rows) {
      const settings = normalizeSettings(raw);
      if (!opts.force && !opts.dry_run) {
        const window = withinSendWindow(settings);
        if (!window.ok) {
          skipped.push({ owner_email: settings.owner_email, reason: window.reason });
          continue;
        }
        if (settings.next_due_at && new Date(settings.next_due_at) > new Date()) {
          skipped.push({ owner_email: settings.owner_email, reason: "not due yet" });
          continue;
        }
      }
      try {
        sent.push(await runForOwner(settings, opts));
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        console.error("nudge run failed for", settings.owner_email, msg);
        // Circuit breaker: AI billing/policy failures pause outreach instead of looping.
        if (/\b(402|403)\b/.test(msg)) {
          await supabase
            .from("copilot_nudge_settings")
            .update({ paused_until: new Date(Date.now() + 7 * 86_400_000).toISOString() })
            .eq("owner_email", settings.owner_email);
          skipped.push({ owner_email: settings.owner_email, reason: `paused: ${msg}` });
          break;
        }
        skipped.push({ owner_email: settings.owner_email, reason: msg });
      }
    }

    return json({ ok: true, considered: rows.length, sent, skipped });
  } finally {
    if (!scoped) await releaseLock(JOB);
  }
});

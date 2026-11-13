import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

/**
 * Single ingest endpoint for webinar attendee data. Feeds /webinar-stats.
 *
 * Auth: `x-api-key: <WEBINAR_ADS_API_KEY>` (or `Authorization: Bearer <key>`)
 *
 * GET  /                -> schema + example payloads
 * POST /  {type:"attendance", ...}  -> mark attended / missed for a person
 * POST /  {type:"retention", ...}   -> record a 25/50/75/95/100% watch milestone
 * POST /  {records:[...]}           -> batch of either type
 */

const API_KEY = Deno.env.get("WEBINAR_ADS_API_KEY") ?? "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;

const admin = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
  auth: { persistSession: false },
});

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body, null, 2), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

function safeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

const MILESTONES = [25, 50, 75, 95, 100];

const str = (v: unknown) => {
  const s = typeof v === "string" ? v.trim() : v == null ? "" : String(v).trim();
  return s || null;
};
const email = (v: unknown) => str(v)?.toLowerCase() ?? null;

function splitName(record: Record<string, any>) {
  let first = str(record.first_name);
  let last = str(record.last_name);
  const full = str(record.name ?? record.full_name);
  if ((!first || !last) && full) {
    const parts = full.split(/\s+/);
    first = first ?? parts[0] ?? null;
    last = last ?? (parts.length > 1 ? parts.slice(1).join(" ") : null);
  }
  return { first, last };
}

/** Find (or create) the registration row this record belongs to. */
async function resolveRegistration(record: Record<string, any>, addr: string) {
  const { data: existing } = await admin
    .from("webinar_registrations")
    .select("id, first_name, last_name, phone, session_date_text, webinar_id, max_retention_pct")
    .ilike("email", addr)
    .is("duplicate_of", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { first, last } = splitName(record);
  const patch: Record<string, any> = {};
  if (first && !existing?.first_name) patch.first_name = first;
  if (last && !existing?.last_name) patch.last_name = last;
  const phone = str(record.phone);
  if (phone && !existing?.phone) patch.phone = phone;
  const session = str(record.session_date_text ?? record.session);
  if (session && !existing?.session_date_text) patch.session_date_text = session;
  const webinarId = str(record.webinar_id);
  if (webinarId && !existing?.webinar_id) patch.webinar_id = webinarId;

  if (existing) {
    if (Object.keys(patch).length) {
      await admin.from("webinar_registrations").update(patch).eq("id", existing.id);
    }
    return { row: { ...existing, ...patch }, created: false };
  }

  const { data: created, error } = await admin
    .from("webinar_registrations")
    .insert({
      email: addr,
      first_name: first,
      last_name: last,
      phone,
      session_date_text: session,
      webinar_id: webinarId,
      utm_source: str(record.utm_source),
      landing_page: str(record.landing_page),
      is_test: record.is_test === true,
    })
    .select("id, max_retention_pct")
    .single();
  if (error) throw new Error(error.message);
  return { row: created, created: true };
}

const ATTENDED = /^(attend(ed|ing)?|present|yes|true|live|showed?(_up)?)$/i;
const MISSED = /^(missed|no[_\s-]?show|absent|no|false|did[_\s-]?not[_\s-]?attend)$/i;

async function handleAttendance(record: Record<string, any>) {
  const addr = email(record.email);
  if (!addr) return { ok: false, error: "email is required", record };

  const raw = String(record.status ?? record.attendance ?? record.attended ?? "").trim();
  let attended: boolean;
  if (ATTENDED.test(raw)) attended = true;
  else if (MISSED.test(raw)) attended = false;
  else if (record.attended === true) attended = true;
  else if (record.attended === false) attended = false;
  else return { ok: false, error: `status must be "attended" or "missed" (got "${raw}")`, email: addr };

  const { row, created } = await resolveRegistration(record, addr);
  const at = str(record.attended_at ?? record.occurred_at);
  const { error } = await admin
    .from("webinar_registrations")
    .update({
      attended,
      attendance_status: attended ? "attended" : "missed",
      attended_at: attended ? (at ?? new Date().toISOString()) : null,
      watch_seconds:
        record.watch_seconds != null ? Math.max(0, Math.round(Number(record.watch_seconds) || 0)) : undefined,
    })
    .eq("id", row.id);
  if (error) throw new Error(error.message);

  return {
    ok: true,
    type: "attendance",
    email: addr,
    status: attended ? "attended" : "missed",
    registration_id: row.id,
    registration_created: created,
  };
}

async function handleRetention(record: Record<string, any>) {
  const addr = email(record.email);
  if (!addr) return { ok: false, error: "email is required", record };

  const milestone = Math.round(Number(record.milestone ?? record.percent ?? record.pct ?? record.value) || 0);
  if (!MILESTONES.includes(milestone)) {
    return { ok: false, error: `milestone must be one of ${MILESTONES.join(", ")}`, email: addr };
  }

  const { row, created } = await resolveRegistration(record, addr);
  const watchSeconds =
    record.watch_seconds != null ? Math.max(0, Math.round(Number(record.watch_seconds) || 0)) : null;

  const session = str(record.session_date_text ?? record.session) ?? "";
  const eventRow = {
    registration_id: row.id,
    email: addr,
    webinar_id: str(record.webinar_id),
    session_date_text: session,
    milestone,
    watch_seconds: watchSeconds,
    source: str(record.source),
    occurred_at: str(record.occurred_at) ?? new Date().toISOString(),
  };
  // Idempotent per email + milestone + session, so replayed pings never double-count.
  const { data: dupe } = await admin
    .from("webinar_retention_events")
    .select("id")
    .ilike("email", addr)
    .is("duplicate_of", null)
    .eq("milestone", milestone)
    .eq("session_date_text", session)
    .maybeSingle();
  const { error } = dupe
    ? await admin.from("webinar_retention_events").update(eventRow).eq("id", dupe.id)
    : await admin.from("webinar_retention_events").insert(eventRow);
  if (error && !/duplicate key/i.test(error.message)) throw new Error(error.message);


  const patch: Record<string, any> = { retention_updated_at: new Date().toISOString() };
  if (milestone > (Number(row.max_retention_pct) || 0)) patch.max_retention_pct = milestone;
  if (watchSeconds != null) patch.watch_seconds = watchSeconds;
  // Reaching a milestone means they were in the room.
  patch.attended = true;
  patch.attendance_status = "attended";
  await admin.from("webinar_registrations").update(patch).eq("id", row.id);

  return {
    ok: true,
    type: "retention",
    email: addr,
    milestone,
    registration_id: row.id,
    registration_created: created,
  };
}

const truthy = (v: unknown) => v !== false && v !== "false" && v !== 0 && v !== "no";

/** Offer click during the live session or the replay. */
async function handleOfferClick(record: Record<string, any>) {
  const addr = email(record.email);
  if (!addr) return { ok: false, error: "email is required", record };
  const { row } = await resolveRegistration(record, addr);
  const ctx = (str(record.context ?? record.where ?? record.source) ?? "live").toLowerCase();
  const { error } = await admin
    .from("webinar_registrations")
    .update({
      offer_clicked: truthy(record.clicked),
      offer_click_context: ctx === "replay" ? "replay" : "live",
      offer_clicked_at: str(record.occurred_at) ?? new Date().toISOString(),
      ...(ctx === "replay" ? { watched_replay: true } : {}),
    })
    .eq("id", row.id);
  if (error) throw new Error(error.message);
  return { ok: true, type: "offer_click", email: addr, context: ctx, registration_id: row.id };
}

/** Watched the replay rather than the live room. */
async function handleReplay(record: Record<string, any>) {
  const addr = email(record.email);
  if (!addr) return { ok: false, error: "email is required", record };
  const { row } = await resolveRegistration(record, addr);
  const patch: Record<string, any> = { watched_replay: truthy(record.watched) };
  if (record.watch_seconds != null) {
    patch.watch_seconds = Math.max(0, Math.round(Number(record.watch_seconds) || 0));
  }
  const { error } = await admin.from("webinar_registrations").update(patch).eq("id", row.id);
  if (error) throw new Error(error.message);
  return { ok: true, type: "replay", email: addr, registration_id: row.id };
}

/** Flag (or clear) a person for manual follow-up. */
async function handleFollowup(record: Record<string, any>) {
  const addr = email(record.email);
  if (!addr) return { ok: false, error: "email is required", record };
  const { row } = await resolveRegistration(record, addr);
  const needs = truthy(record.needs_followup ?? record.followup ?? true);
  const { error } = await admin
    .from("webinar_registrations")
    .update({ needs_followup: needs, followup_note: str(record.note) })
    .eq("id", row.id);
  if (error) throw new Error(error.message);
  return { ok: true, type: "followup", email: addr, needs_followup: needs, registration_id: row.id };
}

const SCHEMA = {

  description:
    "Push webinar attendee data into /webinar-stats. One endpoint, five payload types: attendance, retention, offer_click, replay and followup.",

  auth: "x-api-key: <WEBINAR_ADS_API_KEY>  (Authorization: Bearer <key> also works)",
  endpoint: `${SUPABASE_URL}/functions/v1/webinar-ingest`,
  types: {
    attendance: {
      required: ["type", "email", "status"],
      status_values: ["attended", "missed"],
      optional: ["name (or first_name/last_name)", "phone", "session_date_text", "webinar_id", "attended_at", "watch_seconds", "is_test"],
      example: {
        type: "attendance",
        status: "attended",
        name: "Jane Doe",
        email: "jane@example.com",
        phone: "5551234567",
        session_date_text: "Thu Sep 18, 2:00 PM CDT",
      },
    },
    retention: {
      required: ["type", "email", "milestone"],
      milestone_values: MILESTONES,
      optional: ["name", "phone", "watch_seconds", "session_date_text", "webinar_id", "source", "occurred_at"],
      example: { type: "retention", email: "jane@example.com", milestone: 75, watch_seconds: 2700 },
    },
    offer_click: {
      required: ["type", "email"],
      optional: ["context (live | replay)", "clicked (false to clear)", "occurred_at", "name"],
      example: { type: "offer_click", email: "jane@example.com", context: "replay" },
    },
    replay: {
      required: ["type", "email"],
      optional: ["watched (false to clear)", "watch_seconds", "name"],
      example: { type: "replay", email: "jane@example.com", watch_seconds: 1800 },
    },
    followup: {
      required: ["type", "email"],
      optional: ["needs_followup (false to clear)", "note"],
      example: { type: "followup", email: "jane@example.com", note: "Wants pricing details" },
    },
  },
  batch: {
    description: "Send many at once; each record carries its own type.",
    example: {
      records: [
        { type: "attendance", email: "a@example.com", status: "missed", name: "A Person" },
        { type: "retention", email: "b@example.com", milestone: 50 },
        { type: "offer_click", email: "b@example.com", context: "live" },
      ],
    },
  },
  notes: [
    "Unknown emails create a registration automatically, so attendance can arrive before registration data.",
    "Retention milestones are idempotent per email + milestone + session, so replays never double-count.",
    "Any retention milestone also marks the person as attended.",
    "Reported percentages are capped at the highest milestone reached (max_retention_pct).",
    "Duplicate signups are collapsed in reporting, so each person counts once.",
  ],

};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (!API_KEY) return json({ error: "WEBINAR_ADS_API_KEY is not configured" }, 500);

  const provided =
    req.headers.get("x-api-key") ||
    (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "").trim();
  if (!provided || !safeEqual(provided, API_KEY)) return json({ error: "Unauthorized" }, 401);

  if (req.method === "GET") return json(SCHEMA);
  if (req.method !== "POST") return json({ error: "Use GET or POST" }, 405);

  try {
    const body = await req.json().catch(() => ({}));
    const list: Record<string, any>[] = Array.isArray(body?.records)
      ? body.records
      : Array.isArray(body)
        ? body
        : [body];

    const results: Record<string, any>[] = [];
    for (const raw of list) {
      const record = { ...(body?.defaults ?? {}), ...raw };
      const type = String(record.type ?? body?.type ?? "").toLowerCase();
      if (type === "attendance" || type === "attended" || type === "missed") {
        if (type !== "attendance" && record.status == null) record.status = type;
        results.push(await handleAttendance(record));
      } else if (type === "retention" || type === "watch" || type === "progress") {
        results.push(await handleRetention(record));
      } else if (type === "offer_click" || type === "offer" || type === "click") {
        results.push(await handleOfferClick(record));
      } else if (type === "replay") {
        results.push(await handleReplay(record));
      } else if (type === "followup" || type === "follow_up") {
        results.push(await handleFollowup(record));
      } else {
        results.push({
          ok: false,
          error: `type must be one of attendance, retention, offer_click, replay, followup (got "${type}")`,
        });
      }

    }

    const accepted = results.filter((r) => r.ok).length;
    return json({ ok: accepted > 0, accepted, rejected: results.length - accepted, results }, accepted ? 200 : 400);
  } catch (e) {
    console.error("webinar-ingest", e);
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});

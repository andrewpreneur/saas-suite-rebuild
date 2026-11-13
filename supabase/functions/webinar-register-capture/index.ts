import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { urlAllowed } from "../_shared/pixel-host.ts";
import { logCustomerMessage } from "../_shared/journey-log.ts";
import { metaSendPlan, metaTestEventCode, requestIsTest } from "../_shared/test-traffic.ts";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const clean = (v: unknown, max = 500): string | null => {
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t ? t.slice(0, max) : null;
};

const admin = () =>
  createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

/** Stable, per-registration Meta event id shared by browser pixel + CAPI. */
const eventIdFor = (registrationId: string) => `reg_${registrationId}`;

/** Seasoned pixel — the ONLY dataset that receives Lead. */
const LEAD_PIXEL_ID = "745177780828109";
const AI_SAAS_REGISTRATION_WEBHOOK_URL =
  "https://services.leadconnectorhq.com/hooks/T69cI1milcirIORef4Ib/webhook-trigger/xMntVcmTXnoYZ7Be46RC";

/**
 * Server-side conversion through the existing meta-capi function, using the
 * SAME event_id the browser pixel uses so Meta dedupes them.
 */
async function sendCapi(
  row: {
    id: string;
    email: string;
    first_name?: string | null;
    last_name?: string | null;
    phone?: string | null;
    fbclid: string | null;
    fbc: string | null;
    fbp: string | null;
    user_agent: string | null;
  },
  eventName: "Lead" = "Lead",
  extra: Record<string, unknown> = {},
) {
  const eventId = eventIdFor(row.id);
  try {
    const res = await fetch(
      `${Deno.env.get("SUPABASE_URL")}/functions/v1/meta-capi`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
          Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""}`,
        },
        body: JSON.stringify({
          event_name: eventName,
          event_id: eventId,
          email: row.email,
          first_name: row.first_name ?? undefined,
          last_name: row.last_name ?? undefined,
          phone: row.phone ?? undefined,
          fbclid: row.fbclid ?? undefined,
          fbp: row.fbp ?? undefined,
          fbc: row.fbc ?? undefined,
          client_user_agent: row.user_agent ?? undefined,
          event_source_url: "https://saassuite.ai/webinar",
          ...extra,
        }),
      },
    );
    const responseBody = await res.text();
    console.log(JSON.stringify({
      source: "webinar-register-capture",
      destination: "meta-capi",
      event_name: eventName,
      event_id: eventId,
      response_status: res.status,
      response_ok: res.ok,
      response_body: responseBody.slice(0, 1000),
    }));
    return { ok: res.ok, status: res.status, body: responseBody };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error(JSON.stringify({
      source: "webinar-register-capture",
      destination: "meta-capi",
      event_name: eventName,
      event_id: eventId,
      response_status: 0,
      response_ok: false,
      response_body: message,
    }));
    return { ok: false, status: 0, body: message };
  }
}

/**
 * The thank-you page asks for its event id here. The claim is recorded on the
 * registration row (not localStorage), so a refresh, bookmark or second device
 * never fires Lead a second time for the same registration.
 */
async function handleClaim(email: string, isTest = false) {
  const supabase = admin();
  const { data, error } = await supabase
    .from("webinar_registrations")
    .select("id, pixel_claimed_at")
    .eq("email", email)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error("claim lookup failed", error.message);
    return json({ error: "lookup failed" }, 500);
  }
  if (!data) return json({ event_id: null, reason: "no_registration" });
  if (data.pixel_claimed_at) {
    return json({ event_id: null, reason: "already_claimed" });
  }

  const claimPatch: { pixel_claimed_at: string; is_test?: boolean } = {
    pixel_claimed_at: new Date().toISOString(),
  };
  if (isTest) claimPatch.is_test = true;
  const { data: claimed, error: claimError } = await supabase
    .from("webinar_registrations")
    .update(claimPatch)
    .eq("id", data.id)
    .is("pixel_claimed_at", null)
    .select("id")
    .maybeSingle();

  if (claimError) {
    console.error("claim update failed", claimError.message);
    return json({ error: "claim failed" }, 500);
  }
  if (!claimed) return json({ event_id: null, reason: "already_claimed" });

  return json({ event_id: eventIdFor(claimed.id) });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid JSON" }, 400);
  }

  const email = clean(body.email, 320)?.toLowerCase();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return json({ error: "A valid email is required" }, 400);
  }

  const isTest = requestIsTest({ body, cookieHeader: req.headers.get("cookie") });
  if (body.action === "claim") return handleClaim(email, isTest);

  const row = {
    webinar_id: clean(body.webinar_id, 100),
    first_name: clean(body.first_name, 120),
    last_name: clean(body.last_name, 120),
    email,
    phone: clean(body.phone, 40),
    do_you_have_highlevel: clean(body.do_you_have_highlevel, 200),
    session_date_text: clean(body.session_date_text, 200),
    fbclid: clean(body.fbclid, 400),
    fbc: clean(body.fbc, 400),
    fbp: clean(body.fbp, 200),
    utm_source: clean(body.utm_source, 200),
    utm_medium: clean(body.utm_medium, 200),
    utm_campaign: clean(body.utm_campaign, 200),
    utm_content: clean(body.utm_content, 200),
    utm_term: clean(body.utm_term, 200),
    referrer: clean(body.referrer, 1000),
    landing_page: clean(body.landing_page, 1000),
    page_url: clean(body.page_url, 1000),
    user_agent: clean(req.headers.get("user-agent"), 500),
    is_test: isTest,
  };

  const supabase = admin();

  const { data, error } = await supabase
    .from("webinar_registrations")
    .insert(row)
    .select("id")
    .single();

  if (error) {
    console.error("webinar registration insert failed", error.message);
    return json({ error: "Could not save registration" }, 500);
  }

  // Lead is the ONLY conversion event for webinar registrations. It carries
  // email, name and phone plus fbclid/fbc/fbp, and shares its event_id with the
  // browser copy so Meta dedupes them.
  const capiRow = {
    id: data.id,
    email,
    first_name: row.first_name,
    last_name: row.last_name,
    phone: row.phone,
    fbclid: row.fbclid,
    fbc: row.fbc,
    fbp: row.fbp,
    user_agent: row.user_agent,
  };
  // Host gate: registrations from previews or embedded installs are still saved,
  // but never reported to Meta.
  const fromAllowedHost = urlAllowed(
    row.page_url,
    req.headers.get("origin"),
    req.headers.get("referer"),
  );
  const capiPlan = metaSendPlan(isTest, metaTestEventCode(Deno.env.get("META_TEST_EVENT_CODE")));
  const capiSkip = isTest && !capiPlan.send
    ? "test_traffic"
    : !fromAllowedHost
      ? "host_not_allowed"
      : null;
  if (capiSkip === "test_traffic") {
    console.log("webinar registration capi skipped test traffic", data.id);
  }
  const capiResult = capiSkip
    ? { ok: false, status: 0, body: capiSkip }
    : await sendCapi(capiRow, "Lead", {
        pixel_ids: [LEAD_PIXEL_ID],
        content_name: "SaaSSuite Webinar Registration",
        content_category: "webinar",
        is_test: isTest,
        ...(capiPlan.testEventCode ? { test_event_code: capiPlan.testEventCode } : {}),
      });
  if (capiResult.ok) {
    await supabase
      .from("webinar_registrations")
      .update({ capi_sent_at: new Date().toISOString() })
      .eq("id", data.id);
  }

  // Each WebinarKit campaign forwards to its own matching CRM workflow.
  const page =
    clean(body.page, 200) ??
    (() => {
      try {
        return row.page_url ? new URL(row.page_url).pathname : null;
      } catch {
        return null;
      }
    })();
  const webhookUrl = page === "/ai-saas-webinar"
    ? AI_SAAS_REGISTRATION_WEBHOOK_URL
    : Deno.env.get("WEBINAR_REGISTRATION_WEBHOOK_URL");
  if (isTest) {
    console.log("webinar registration webhook skipped test traffic", data.id);
    await supabase
      .from("webinar_registrations")
      .update({ forward_status: "skipped_test" })
      .eq("id", data.id);
    await logCustomerMessage({
      userEmail: row.email,
      channel: "webhook",
      templateKey: "webinar_registration",
      provider: "ghl",
      status: "suppressed",
      source: "webinar-register-capture",
      detail: "test_traffic",
    });
  } else if (webhookUrl) {
    try {
      const res = await fetch(webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          event: "webinar_registration",
          registration_id: data.id,
          name: [row.first_name, row.last_name].filter(Boolean).join(" ") || null,
          page,
          ...row,
          registered_at: new Date().toISOString(),
        }),
      });
      await supabase
        .from("webinar_registrations")
        .update({
          forwarded_at: new Date().toISOString(),
          forward_status: res.ok ? "sent" : `error_${res.status}`,
        })
        .eq("id", data.id);
      await logCustomerMessage({
        userEmail: row.email,
        channel: "webhook",
        templateKey: "webinar_registration",
        provider: "ghl",
        status: res.ok ? "sent" : "failed",
        source: "webinar-register-capture",
        detail: res.ok ? page : `http_${res.status}`,
      });
    } catch (e) {
      console.error("registration webhook failed", (e as Error).message);
      await supabase
        .from("webinar_registrations")
        .update({ forward_status: "network_error" })
        .eq("id", data.id);
      await logCustomerMessage({
        userEmail: row.email,
        channel: "webhook",
        templateKey: "webinar_registration",
        provider: "ghl",
        status: "failed",
        source: "webinar-register-capture",
        detail: "network_error",
      });
    }
  } else {
    await logCustomerMessage({
      userEmail: row.email,
      channel: "webhook",
      templateKey: "webinar_registration",
      provider: "ghl",
      status: "suppressed",
      source: "webinar-register-capture",
      detail: "webhook_not_configured",
    });
  }

  return json({
    ok: true,
    id: data.id,
    event_id: eventIdFor(data.id),
    capi_sent: capiResult.ok,
    capi_status: capiResult.status,
    forwarded: !isTest && Boolean(webhookUrl),
  });
});

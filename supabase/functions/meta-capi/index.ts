// Supabase Edge Function: meta-capi
// Sends server-side conversion events to Meta's Conversions API.
//
// Secrets: META_CAPI_TOKEN=xxx META_PIXEL_ID=745177780828109
//
// Call it from your app at the moment of signup / trial start / purchase:
//
//   await fetch("https://auth.saassuite.ai/functions/v1/meta-capi", {
//     method: "POST",
//     headers: { "Content-Type": "application/json", Authorization: `Bearer ${SUPABASE_ANON_KEY}` },
//     body: JSON.stringify({
//       event_name: "CompleteRegistration",
//       email: "user@example.com",
//       event_id: "signup_<user_id>",
//       fbclid: "IwAR2xyz...",
//       fbp: "fb.1.1690000000000.1234567890",
//       client_ip: "1.2.3.4",
//       client_user_agent: "Mozilla/5.0 ...",
//       event_source_url: "https://saassuite.ai/success",
//       event_time: 1723500000,
//       value: 97,
//       currency: "USD",
//       test_event_code: "TEST12345",
//     }),
//   });

import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { urlAllowed } from "../_shared/pixel-host.ts";
import { stapeDataEndpoint } from "../_shared/stape-purchase.ts";
import {
  authorizePurchase,
  checkoutPaymentCollected,
  defaultPixelIds,
  isCheckoutTrial,
  isServiceRoleRequest,
  trialPlanPriceCents,
  type TrialPriceLine,
  metaCustomData,
  metaEventAllowed,
  metaPhoneDigits,
  metaSendPlan,
  metaTestEventCode,
  purchaseStripeId,
  requestIsTest,
  resolvedClientNetwork,
  type MetaBrowserEventName,
} from "../_shared/meta-capi-policy.ts";

const META_TOKEN = Deno.env.get("META_CAPI_TOKEN")!;
const PIXEL_ID = Deno.env.get("META_PIXEL_ID") ?? "745177780828109";
// Second pixel — mirrors every server-side event to the new dataset so both
// datasets see identical conversions with identical event_ids (dedupe intact).
const PIXEL_ID_2 = Deno.env.get("META_PIXEL_ID_2") ?? "1601372838188959";
// Falls back to the primary token when both pixels live in the same Business.
const META_TOKEN_2 = Deno.env.get("META_CAPI_TOKEN_2") || META_TOKEN;
const API_VERSION = "v21.0";

/**
 * All (pixel, token) destinations a server-side event fans out to.
 * `only` restricts the fan-out to specific datasets (e.g. Lead must land on the
 * seasoned pixel alone and never contaminate the clean measurement dataset).
 */
function capiTargets(only?: string[]): { pixelId: string; token: string }[] {
  const targets = [{ pixelId: PIXEL_ID, token: META_TOKEN }];
  if (PIXEL_ID_2 && PIXEL_ID_2 !== PIXEL_ID && META_TOKEN_2) {
    targets.push({ pixelId: PIXEL_ID_2, token: META_TOKEN_2 });
  }
  if (only && only.length) {
    const allowed = new Set(only.map(String));
    const filtered = targets.filter((t) => allowed.has(t.pixelId));
    if (filtered.length) return filtered;
  }
  return targets;
}

async function sha256(input: string): Promise<string> {
  const data = new TextEncoder().encode(input.trim().toLowerCase());
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// Meta wants fbc formatted as fb.1.<creation_time_ms>.<fbclid>
function toFbc(fbclid: string | undefined, eventTimeSec: number): string | undefined {
  if (!fbclid) return undefined;
  if (fbclid.startsWith("fb.1.")) return fbclid;
  return `fb.1.${eventTimeSec * 1000}.${fbclid}`;
}

const ALLOWED_EVENTS = new Set<MetaBrowserEventName>([
  "CompleteRegistration",
  "Lead",
  "Purchase",
  "Subscribe",
  "Schedule",
  "Contact",
  "InitiateCheckout",
  "ViewContent",
  "AddPaymentInfo",
  "PageView",
]);

/**
 * GoHighLevel's webhook action posts its own contact/appointment payload and
 * cannot always be given a hand-written JSON body. Normalize those shapes so a
 * raw GHL webhook still produces a valid event:
 *   - appointment fields present  -> Schedule, event_id = booking_<appt id>
 *   - otherwise a contact payload -> Contact,  event_id = contact_<contact id>
 */
function normalizeGhl(body: Record<string, any>): { payload: Record<string, any>; ghl: boolean } {
  if (body.event_name) return { payload: body, ghl: false };

  const contact = body.contact ?? {};
  const appointment = body.appointment ?? body.calendar ?? {};

  const email =
    body.email ?? body.contact_email ?? contact.email ?? appointment.email ?? undefined;

  const apptId =
    body.appointment_id ??
    body.appointmentId ??
    appointment.id ??
    appointment.appointmentId ??
    body.calendar_appointment_id ??
    undefined;

  const contactId = body.contact_id ?? body.contactId ?? contact.id ?? undefined;

  if (apptId) {
    return {
      ghl: true,
      payload: {
        ...body,
        event_name: "Schedule",
        email,
        event_id: body.event_id ?? `booking_${apptId}`,
      },
    };
  }

  if (email) {
    return {
      ghl: true,
      payload: {
        ...body,
        event_name: "Contact",
        email,
        event_id: body.event_id ?? `contact_${contactId ?? email}`,
      },
    };
  }

  return { payload: body, ghl: false };
}

/**
 * Browser Purchase must name a real Checkout Session or PaymentIntent and the
 * same USD amount Stripe collected. A missing key or a Stripe error denies it.
 */
function pushTrialPrice(lines: TrialPriceLine[], price: unknown, quantity: number | null | undefined) {
  if (!price || typeof price !== "object") return;
  const row = price as { unit_amount?: number | null; currency?: string | null; recurring?: unknown };
  lines.push({
    unitAmountCents: typeof row.unit_amount === "number" ? row.unit_amount : null,
    currency: typeof row.currency === "string" ? row.currency : null,
    recurring: row.recurring != null,
    quantity: typeof quantity === "number" ? quantity : 1,
  });
}

async function stripePurchaseProof(eventId: string): Promise<{
  paid: boolean;
  currency: string | null;
  amountCents: number | null;
  email?: string | null;
  trial?: boolean;
  planPriceCents?: number | null;
} | null> {
  const ref = purchaseStripeId(eventId);
  const key = Deno.env.get("STRIPE_SECRET_KEY");
  if (!ref || !key) return null;
  try {
    const stripe = new Stripe(key, { apiVersion: "2025-08-27.basil" });
    if (ref.kind === "checkout") {
      const session = await stripe.checkout.sessions.retrieve(ref.id, {
        expand: ["subscription.items.data.price", "line_items.data.price"],
      });
      const email = session.customer_details?.email || session.customer_email || null;
      const subscription = session.subscription;
      const subscriptionStatus = subscription && typeof subscription === "object" ? subscription.status : null;
      const amountCents = session.amount_total;
      const priceLines: TrialPriceLine[] = [];
      const items = subscription && typeof subscription === "object" && subscription.items && "data" in subscription.items
        ? subscription.items.data
        : [];
      for (const item of items) pushTrialPrice(priceLines, item.price, item.quantity);
      for (const item of session.line_items?.data ?? []) pushTrialPrice(priceLines, item.price, item.quantity);
      return {
        paid: checkoutPaymentCollected(session.payment_status),
        currency: session.currency,
        amountCents,
        email,
        planPriceCents: trialPlanPriceCents(priceLines),
        trial: isCheckoutTrial({
          mode: session.mode,
          amountCents,
          status: session.status,
          paymentStatus: session.payment_status,
          trialSource: session.metadata?.trial_source,
          subscriptionStatus,
        }),
      };
    }
    const intent = await stripe.paymentIntents.retrieve(ref.id);
    const email = typeof intent.receipt_email === "string" ? intent.receipt_email : null;
    return {
      paid: intent.status === "succeeded",
      currency: intent.currency,
      amountCents: intent.amount_received,
      email,
    };
  } catch (error) {
    console.error("meta-capi stripe proof failed", ref.kind, error instanceof Error ? error.message : "unknown");
    return null;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response("POST only", {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let body: Record<string, any>;
  let ghlNormalized = false;
  try {
    const normalized = normalizeGhl((await req.json()) ?? {});
    body = normalized.payload;
    ghlNormalized = normalized.ghl;
  } catch {
    return new Response(JSON.stringify({ error: "bad json" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const testPlan = metaSendPlan(
    requestIsTest({ body, cookieHeader: req.headers.get("cookie") }),
    metaTestEventCode(Deno.env.get("META_TEST_EVENT_CODE")),
  );
  if (!testPlan.send) {
    console.log("meta-capi skipped test traffic", String(body.event_id ?? ""));
    return new Response(JSON.stringify({ ok: true, skipped: "test_traffic" }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Host gate: drop anything whose originating host isn't one of our production
  // domains (Lovable previews, *.lovableproject.com, embedded partner installs).
  if (!urlAllowed(body.event_source_url, req.headers.get("origin"), req.headers.get("referer"))) {
    console.log("meta-capi dropped: disallowed host", body.event_source_url ?? req.headers.get("origin"));
    return new Response(JSON.stringify({ skipped: "host_not_allowed" }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const eventName = String(body.event_name ?? "");
  if (!metaEventAllowed(eventName) || !ALLOWED_EVENTS.has(eventName as MetaBrowserEventName)) {
    return new Response(
      JSON.stringify({
        error: `event_name must be one of ${[...ALLOWED_EVENTS].join(", ")}`,
      }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  const serviceRole = isServiceRoleRequest({
    authorization: req.headers.get("authorization"),
    apikey: req.headers.get("apikey"),
    serviceRoleKey: Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
  });
  // Browser calls on our site have no stored IP. Service-role webhooks pass the
  // buyer's IP from Stripe metadata. GHL and other server callers must not pick
  // up this request's IP or user agent.
  const network = resolvedClientNetwork({
    serviceRole,
    clientIp: body.client_ip,
    clientUserAgent: body.client_user_agent,
    forwardedFor: req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip"),
    userAgent: req.headers.get("user-agent"),
    origin: req.headers.get("origin"),
    referer: req.headers.get("referer"),
    ghlNormalized,
  });
  if (network.clientIp) body.client_ip = network.clientIp;
  if (network.clientUserAgent) body.client_user_agent = network.clientUserAgent;

  // A $0 or 100%-off Purchase is not a conversion. Do this before auth so a
  // comped order never reaches Stripe or Meta.
  const percentOff = Number(body.percent_off);
  const fullDiscount = body.full_discount === true || (Number.isFinite(percentOff) && percentOff >= 100);
  const explicitZero = body.value === 0 || body.value === "0";
  if (eventName === "Purchase" && (explicitZero || fullDiscount)) {
    console.log("meta-capi skipped Purchase", String(body.event_id ?? ""), "zero or 100% off");
    return new Response(JSON.stringify({ ok: true, skipped: "zero_or_full_discount" }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (eventName === "Purchase") {
    const eventId = String(body.event_id ?? "");
    const claimedValue = Number(body.value);
    const stripeProof = serviceRole ? null : await stripePurchaseProof(eventId);
    const auth = authorizePurchase({
      serviceRole,
      eventId,
      value: claimedValue,
      stripe: stripeProof,
    });
    if (!auth.allow) {
      console.log("meta-capi rejected Purchase", eventId);
      return new Response(
        JSON.stringify({ error: "Purchase must be sent by the server or match a Stripe charge" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    body.value = auth.value;
    if (auth.email) body.email = auth.email;
  }

  const email = body.email ? String(body.email) : undefined;
  const fbclid = body.fbclid ? String(body.fbclid) : undefined;
  if (!email && !fbclid && !body.fbp) {
    return new Response(
      JSON.stringify({ error: "need at least one of: email, fbclid, fbp" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  const eventTime = Number(body.event_time) || Math.floor(Date.now() / 1000);

  const userData: Record<string, unknown> = {};
  if (email) userData.em = [await sha256(email)];
  // Names and phone materially raise match quality for Lead events.
  if (body.first_name) userData.fn = [await sha256(String(body.first_name))];
  if (body.last_name) userData.ln = [await sha256(String(body.last_name))];
  if (body.phone) {
    const digits = metaPhoneDigits(String(body.phone));
    if (digits) userData.ph = [await sha256(digits)];
  }
  // Additional match-quality parameters Meta recommends for Purchase events.
  if (body.zip) userData.zp = [await sha256(String(body.zip).replace(/\s/g, ""))];
  if (body.city) userData.ct = [await sha256(String(body.city).replace(/\s/g, ""))];
  if (body.state) userData.st = [await sha256(String(body.state).replace(/\s/g, ""))];
  // dob must reach Meta as YYYYMMDD.
  if (body.dob) {
    const dob = String(body.dob).replace(/[^\d]/g, "");
    if (dob.length === 8) userData.db = [await sha256(dob)];
  }
  // An explicit fbc (captured from the real _fbc cookie at landing) always wins:
  // its embedded timestamp is the actual click time, which is what makes Meta
  // attribute the conversion as a 7d_click instead of a 1d_view.
  const fbc = body.fbc ? String(body.fbc) : toFbc(fbclid, eventTime);
  if (fbc) userData.fbc = fbc;
  if (body.fbp) userData.fbp = String(body.fbp);
  if (body.client_ip) userData.client_ip_address = String(body.client_ip);
  if (body.client_user_agent) {
    userData.client_user_agent = String(body.client_user_agent);
  }
  if (body.external_id) {
    userData.external_id = [await sha256(String(body.external_id))];
  }

  const event: Record<string, unknown> = {
    event_name: eventName,
    event_time: eventTime,
    action_source: "website",
    event_source_url: body.event_source_url ?? "https://saassuite.ai",
    user_data: userData,
  };

  if (body.event_id) event.event_id = String(body.event_id);
  // Events Manager flags events without value/currency as low quality, so we
  // ALWAYS send both. Meta requires value > 0, so non-monetary events
  // (registration/trial/lead/page) report a nominal 1 USD.
  const isMonetary = eventName === "Purchase" || eventName === "Subscribe";
  const rawValue = Number(body.value ?? (isMonetary ? 97 : 1));
  event.custom_data = metaCustomData(
    body,
    rawValue > 0 ? rawValue : 1,
    String(body.currency ?? "USD"),
  );

  const payload: Record<string, unknown> = { data: [event] };
  if (testPlan.testEventCode) payload.test_event_code = testPlan.testEventCode;
  else if (body.test_event_code) payload.test_event_code = String(body.test_event_code);

  // Fan the SAME event (same event_id) out to every pixel dataset in parallel.
  // Callers may scope an event to specific datasets via pixel_ids.
  // The kit Lead names pixel 745. Other events keep both pixels.
  const requestedPixels = Array.isArray(body.pixel_ids)
    ? body.pixel_ids.map((p: unknown) => String(p))
    : body.pixel_id
      ? [String(body.pixel_id)]
      : undefined;
  const onlyPixels = defaultPixelIds(eventName, requestedPixels, PIXEL_ID);
  // The webhook owns the Stape Purchase. Skipping Graph here keeps the browser
  // pixel's matching meta-capi call from posting a second server event.
  if (eventName === "Purchase" && stapeDataEndpoint(Deno.env.get("STAPE_SERVER_URL"), Deno.env.get("STAPE_PURCHASE_PATH"))) {
    console.log("meta-capi skipped Purchase stape", String(body.event_id ?? ""));
    return new Response(JSON.stringify({ ok: true, skipped: "stape" }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const targets = capiTargets(onlyPixels);
  const results = await Promise.all(
    targets.map(async ({ pixelId, token }) => {
      try {
        const res = await fetch(
          `https://graph.facebook.com/${API_VERSION}/${pixelId}/events?access_token=${token}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          },
        );
        const out = await res.json().catch(() => ({}));
        console.log(
          "meta-capi",
          pixelId,
          eventName,
          res.status,
          JSON.stringify(out).slice(0, 300),
        );
        return { pixel_id: pixelId, status: res.status, response: out };
      } catch (e) {
        console.error("meta-capi send failed", pixelId, eventName, e);
        return { pixel_id: pixelId, status: 0, error: String(e) };
      }
    }),
  );

  // Primary pixel drives the HTTP status so existing callers behave the same.
  const primary = results[0];
  return new Response(
    JSON.stringify({ ...(primary.response ?? {}), pixels: results }),
    {
      status: primary.status || 502,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    },
  );
});

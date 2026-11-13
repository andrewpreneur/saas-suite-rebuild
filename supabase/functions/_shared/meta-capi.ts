// Shared server-side helper for firing Meta Conversions API events through the
// meta-capi edge function. Every order-completing path should call
// `sendMetaPurchase` so a Purchase reaches Meta for EVERY price point, even when
// the browser never comes back (tab closed, payment link, redirect lost).
//
// Dedup contract: event_id is always `order_<stripe session or order id>`, and
// the browser pixel uses the same string as its `eventID`, so Meta counts one
// conversion and keeps whichever copy matched better.
// When STAPE_SERVER_URL is set, Purchase callers post the Stape Data Client
// body instead of this function, and meta-capi does not call Graph for Purchase.

import { metaSendPlan, metaTestEventCode } from "./test-traffic.ts";

const FN_URL = `${Deno.env.get("SUPABASE_URL")}/functions/v1/meta-capi`;

export interface MetaEventInput {
  event_name:
    | "Purchase"
    | "Subscribe"
    | "Schedule"
    | "Contact"
    | "Lead"
    | "InitiateCheckout"
    | "ViewContent"
    | "AddPaymentInfo"
    | "PageView"
    | "CompleteRegistration";
  email?: string | null;
  value?: number;
  currency?: string;
  event_id: string;
  fbclid?: string | null;
  fbc?: string | null;
  fbp?: string | null;
  event_source_url?: string | null;
  client_ip?: string | null;
  client_user_agent?: string | null;
  external_id?: string | null;
  phone?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  zip?: string | null;
  city?: string | null;
  state?: string | null;
  /** YYYYMMDD */
  dob?: string | null;
  content_ids?: string[] | null;
  contents?: { id: string; quantity?: number; item_price?: number }[] | null;
  content_type?: string | null;
  content_name?: string | null;
  num_items?: number | null;
  order_id?: string | null;
  /** Restrict fan-out. Lead uses the seasoned pixel. Purchase omits this and goes to both. */
  pixel_ids?: string[] | null;
  /** QA visit. Skipped unless META_TEST_EVENT_CODE is set. */
  is_test?: boolean;
}

/** Never throws — tracking must not break fulfillment. False means Meta did not accept it. */
export async function sendMetaEvent(input: MetaEventInput): Promise<boolean> {
  try {
    const plan = metaSendPlan(input.is_test === true, metaTestEventCode(Deno.env.get("META_TEST_EVENT_CODE")));
    if (!plan.send) {
      console.log(`[meta-capi:${input.event_name}] skipped test traffic ${input.event_id}`);
      return false;
    }
    const body: Record<string, unknown> = {
      event_name: input.event_name,
      event_id: input.event_id,
      event_time: Math.floor(Date.now() / 1000),
    };
    if (input.email) body.email = String(input.email).trim().toLowerCase();
    if (typeof input.value === "number") body.value = input.value;
    if (input.currency) body.currency = input.currency;
    if (input.fbclid) body.fbclid = input.fbclid;
    if (input.fbc) body.fbc = input.fbc;
    if (input.fbp) body.fbp = input.fbp;
    if (input.event_source_url) body.event_source_url = input.event_source_url;
    if (input.client_ip) body.client_ip = input.client_ip;
    if (input.client_user_agent) body.client_user_agent = input.client_user_agent;
    if (input.external_id) body.external_id = input.external_id;
    if (input.phone) body.phone = input.phone;
    if (input.first_name) body.first_name = input.first_name;
    if (input.last_name) body.last_name = input.last_name;
    if (input.zip) body.zip = input.zip;
    if (input.city) body.city = input.city;
    if (input.state) body.state = input.state;
    if (input.dob) body.dob = input.dob;
    if (input.content_ids?.length) body.content_ids = input.content_ids;
    if (input.contents?.length) body.contents = input.contents;
    if (input.content_type) body.content_type = input.content_type;
    if (input.content_name) body.content_name = input.content_name;
    if (typeof input.num_items === "number") body.num_items = input.num_items;
    if (input.order_id) body.order_id = input.order_id;
    if (input.pixel_ids?.length) body.pixel_ids = input.pixel_ids;
    if (input.is_test) body.is_test = true;
    if (plan.testEventCode) body.test_event_code = plan.testEventCode;

    const res = await fetch(FN_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        // meta-capi runs with verify_jwt = false, but the platform still wants
        // an apikey header on function-to-function calls. The service role is
        // also what authorizes Purchase; a browser anon key cannot send one.
        apikey: Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
        Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""}`,
      },
      body: JSON.stringify(body),
    });

    const text = (await res.text()).slice(0, 300);
    console.log(`[meta-capi:${input.event_name}] ${res.status} ${input.event_id} ${text}`);
    return res.ok;
  } catch (e) {
    console.error("[meta-capi] send failed", input.event_name, input.event_id, e);
    return false;
  }
}

/** Absolute URL for a checkout page path, so event_source_url is always valid. */
export function toAbsoluteUrl(pathOrUrl?: string | null): string {
  if (!pathOrUrl) return "https://saassuite.ai";
  if (/^https?:\/\//i.test(pathOrUrl)) return pathOrUrl;
  return `https://saassuite.ai${pathOrUrl.startsWith("/") ? "" : "/"}${pathOrUrl}`;
}

export async function sendMetaPurchase(args: {
  orderId: string;
  email?: string | null;
  value: number;
  currency?: string;
  fbclid?: string | null;
  fbc?: string | null;
  fbp?: string | null;
  eventSourceUrl?: string | null;
  phone?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  zip?: string | null;
  city?: string | null;
  state?: string | null;
  dob?: string | null;
  externalId?: string | null;
  clientIp?: string | null;
  clientUserAgent?: string | null;
  contentIds?: string[] | null;
  contents?: { id: string; quantity?: number; item_price?: number }[] | null;
  contentType?: string | null;
  contentName?: string | null;
  numItems?: number | null;
  isTest?: boolean;
}): Promise<boolean> {
  if (typeof args.value === "number" && args.value <= 0) {
    console.log(`[meta-capi:Purchase] skipped ${args.orderId} zero total`);
    return false;
  }
  return sendMetaEvent({
    event_name: "Purchase",
    event_id: `order_${args.orderId}`,
    email: args.email,
    value: args.value,
    currency: (args.currency || "USD").toUpperCase(),
    fbclid: args.fbclid,
    fbc: args.fbc,
    fbp: args.fbp,
    event_source_url: toAbsoluteUrl(args.eventSourceUrl),
    phone: args.phone,
    first_name: args.firstName,
    last_name: args.lastName,
    zip: args.zip,
    city: args.city,
    state: args.state,
    dob: args.dob,
    external_id: args.externalId,
    client_ip: args.clientIp,
    client_user_agent: args.clientUserAgent,
    content_ids: args.contentIds,
    contents: args.contents,
    content_type: args.contentType,
    content_name: args.contentName,
    num_items: args.numItems,
    order_id: args.orderId,
    is_test: args.isTest === true,
  });
}

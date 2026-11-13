/**
 * Paid checkout.session.completed must return 200 when the session has an email.
 * sessionEmailForLog is filled again after the customer lookup; a const binding
 * throws TypeError (TS2588) before the handler can respond.
 *
 * No live Stripe, Supabase, or GoHighLevel calls: the signature is local HMAC,
 * Supabase credentials are cleared, and fetch is replaced before the handler loads.
 */
const WEBHOOK_SECRET = "whsec_test_checkout_fixture";

Deno.env.set("STRIPE_SUB_WEBHOOK_TEST", "1");
Deno.env.set("STRIPE_WEBHOOK_SECRET", WEBHOOK_SECRET);
Deno.env.set("STRIPE_SECRET_KEY", "sk_test_fixture");
Deno.env.delete("STRIPE_TEST_SECRET_KEY");
Deno.env.delete("STRIPE_TEST_WEBHOOK_SECRET");
Deno.env.delete("SUPABASE_URL");
Deno.env.delete("SUPABASE_SERVICE_ROLE_KEY");
Deno.env.delete("META_TEST_EVENT_CODE");

const fetched: string[] = [];
globalThis.fetch = ((input: RequestInfo | URL) => {
  fetched.push(typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url);
  return Promise.resolve(new Response("{}", { status: 200 }));
}) as typeof fetch;

const { handleStripeSubscriptionWebhook } = await import("./index.ts");

function hex(bytes: ArrayBuffer): string {
  return [...new Uint8Array(bytes)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function sign(payload: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const timestamp = Math.floor(Date.now() / 1000);
  const mac = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${timestamp}.${payload}`));
  return `t=${timestamp},v1=${hex(mac)}`;
}

Deno.test("paid checkout.session.completed with an email returns 200", async () => {
  const payload = JSON.stringify({
    id: "evt_test_checkout_email",
    object: "event",
    api_version: "2025-08-27.basil",
    created: Math.floor(Date.now() / 1000),
    type: "checkout.session.completed",
    livemode: true,
    data: {
      object: {
        id: "cs_test_checkout_email",
        object: "checkout.session",
        payment_status: "paid",
        status: "complete",
        amount_total: 99700,
        currency: "usd",
        customer: "cus_test_checkout",
        customer_email: "buyer.example@agency.test",
        customer_details: { email: "buyer.example@agency.test" },
        metadata: { plan: "advanced" },
      },
    },
  });

  const logs: string[] = [];
  const originalLog = console.log;
  console.log = (...args: unknown[]) => {
    logs.push(args.map((part) => String(part)).join(" "));
  };

  try {
    const response = await handleStripeSubscriptionWebhook(
      new Request("https://example.test/stripe-subscription-webhook", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "stripe-signature": await sign(payload, WEBHOOK_SECRET),
        },
        body: payload,
      }),
    );
    const body = await response.json();
    if (response.status !== 200) {
      throw new Error(`expected 200, got ${response.status} ${JSON.stringify(body)}`);
    }
    if (body.received !== true) {
      throw new Error(`expected received:true, got ${JSON.stringify(body)}`);
    }
    const outcome = logs.find((line) => line.includes("[STRIPE-SUB-WEBHOOK] outcome"));
    if (!outcome?.includes("customer=buyer.example@agency.test")) {
      throw new Error(`expected the checkout email on the outcome line, got ${logs.join(" | ")}`);
    }
    if (!outcome.includes("result=checkout completed")) {
      throw new Error(`expected checkout completed, got ${outcome}`);
    }
    const live = fetched.filter((url) =>
      /api\.stripe\.com|leadconnectorhq\.com|supabase\.co/i.test(url)
    );
    if (live.length > 0) {
      throw new Error(`live call: ${live.join(", ")}`);
    }
  } finally {
    console.log = originalLog;
  }
});

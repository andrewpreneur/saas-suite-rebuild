import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-api-key",
};

// Every Stripe price that grants platform access -> tier it should grant.
const PRICE_TO_PLAN: Record<string, "BASIC" | "ADVANCED"> = {
  price_1Se8YfGdZ9PRE3Zi2GWbiNel: "BASIC",
  price_1UJ0C2GdZ9PRE3ZiObuEAWzF: "BASIC",
  price_1SDdmJGdZ9PRE3Zi84yGzqVd: "ADVANCED",
  price_1UJ0CHGdZ9PRE3ZiGBkh28XD: "ADVANCED",
  price_1UJ0CYGdZ9PRE3ZirCTXUbRf: "ADVANCED",
  price_1SDdlrGdZ9PRE3Zil8llulnB: "ADVANCED",
  price_1UGrjzGdZ9PRE3Zi5rEknrLQ: "ADVANCED",
  price_1S8su4GdZ9PRE3Zi28ngcJmQ: "ADVANCED", // SAASSuite SUPER PROMO $582/year
  price_1S5e0GGdZ9PRE3ZiwB9RqElW: "ADVANCED", // legacy $97/month (LeadConnector)
  price_1S0rmpGdZ9PRE3ZiYBtf1fmc: "ADVANCED", // legacy $99/month
  price_1SF5lfGdZ9PRE3ZiHOkFa5d5: "ADVANCED", // Advanced trial $97
  price_1RvlDAGdZ9PRE3Zi0CGfNVDj: "ADVANCED", // legacy $19/month ($970/yr)
  price_1STCN6GdZ9PRE3Zi3CAjmYWq: "ADVANCED", // Webinar Special $970/year
  price_1SDUz7GdZ9PRE3ZiT6oUjevW: "BASIC", // Basic $27
  price_1SF5kZGdZ9PRE3Zi2aleHiFE: "BASIC", // Basic trial $27
};

const MAX_USERS: Record<"BASIC" | "ADVANCED", number> = { BASIC: 5, ADVANCED: 10000 };
const RANK: Record<string, number> = { STARTER: 0, BASIC: 1, ADVANCED: 2 };

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const apiKey = req.headers.get("x-api-key") || "";
  const allowed = [Deno.env.get("WEBINAR_ADS_API_KEY"), Deno.env.get("RECONCILE_PLANS_TOKEN")].filter(Boolean);
  if (!apiKey || !allowed.includes(apiKey)) {
    return new Response(JSON.stringify({ error: "unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const url = new URL(req.url);
  const dryRun = url.searchParams.get("apply") !== "true";

  const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
    apiVersion: "2025-08-27.basil",
  });
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const mismatches: Array<Record<string, unknown>> = [];
  const missing: Array<Record<string, unknown>> = [];
  let checked = 0;

  try {
    for (const [priceId, shouldPlan] of Object.entries(PRICE_TO_PLAN)) {
      let startingAfter: string | undefined;
      for (;;) {
        const page = await stripe.subscriptions.list({
          price: priceId,
          status: "active",
          limit: 100,
          expand: ["data.customer"],
          ...(startingAfter ? { starting_after: startingAfter } : {}),
        });
        for (const sub of page.data) {
          const cust = sub.customer as Stripe.Customer | string;
          const email = typeof cust === "string" ? "" : (cust.email || "");
          if (!email) continue;
          const normalized = email.trim().toLowerCase();
          checked++;

          const { data: row } = await supabase
            .from("saas_suite_users")
            .select("email, plan, approval, max_onboarding_users, agency_id, agency_id_basic, agency_id_advanced")
            .ilike("email", normalized)
            .maybeSingle();

          if (!row) {
            missing.push({ email: normalized, should_plan: shouldPlan, price: priceId });
            continue;
          }

          const currentPlan = String(row.plan || "STARTER").toUpperCase();
          if ((RANK[currentPlan] ?? 0) >= RANK[shouldPlan]) continue;

          mismatches.push({
            email: normalized,
            current_plan: currentPlan,
            should_plan: shouldPlan,
            price: priceId,
          });

          if (!dryRun) {
            const update: Record<string, unknown> = {
              plan: shouldPlan,
              max_onboarding_users: MAX_USERS[shouldPlan],
              approval: "YES",
            };
            if (shouldPlan === "ADVANCED" && !row.agency_id_advanced) {
              const fallback = row.agency_id || row.agency_id_basic;
              if (fallback) update.agency_id_advanced = fallback;
            }
            await supabase.from("saas_suite_users").update(update).ilike("email", normalized);
          }
        }
        if (!page.has_more) break;
        startingAfter = page.data[page.data.length - 1]?.id;
        if (!startingAfter) break;
      }
    }

    return new Response(
      JSON.stringify({
        ok: true,
        dry_run: dryRun,
        subscriptions_checked: checked,
        underprovisioned: mismatches,
        paying_without_account: missing,
      }, null, 2),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[RECONCILE-PLANS] failed", msg);
    return new Response(JSON.stringify({ ok: false, error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

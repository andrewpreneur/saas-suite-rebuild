import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { z } from "https://esm.sh/zod@3.24.2";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";
import { sendMetaPurchase } from "../_shared/meta-capi.ts";
import { sendClaimedSubscriptionPurchase, subscriptionPurchasePlan } from "../_shared/app-purchase-send.ts";
import { purchaseEventId, splitPersonName } from "../_shared/stape-purchase.ts";
import { skipCheckoutPurchase } from "../_shared/meta-purchase-guard.ts";
import { isOneFeatureKitFunnel } from "../_shared/kit-meta.ts";
import { billingIntervalForPlan, logCustomerMessage, recordCheckoutSession } from "../_shared/journey-log.ts";
import { metadataIsTest, metaSendPlan, metaTestEventCode } from "../_shared/test-traffic.ts";
import {
  commitSaasUserWrite,
  purchaseExistingUpdate,
  purchaseInsertRow,
  trialAccessUpdate,
  writeUntilRow,
} from "../_shared/saas-user-write.ts";
import { commissionOnAmount, rateForNewReferral } from "../_shared/affiliateReferrals.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const webhookUrl = "https://services.leadconnectorhq.com/hooks/T69cI1milcirIORef4Ib/webhook-trigger/c17588f8-b1e7-4559-9695-f848be562692";
const affiliatePurchaseWebhookUrl = "https://services.leadconnectorhq.com/hooks/T69cI1milcirIORef4Ib/webhook-trigger/1be1b25e-9bc4-4ce3-839a-7422ed407415";

const BodySchema = z.object({
  sessionId: z.string().min(1),
  plan: z.enum(["basic", "basic_annual", "advanced", "advanced_annual", "enhanced", "enhanced_annual", "special"]).optional(),
  testMode: z.boolean().optional().default(false),
  fallbackEmail: z.string().email().optional(),
  affiliateId: z.string().optional(),
  fbclid: z.string().optional(),
  fbc: z.string().optional(),
  fbp: z.string().optional(),
  checkoutPage: z.string().optional(),
  attribution: z.object({
    utm_source: z.string().optional(),
    utm_medium: z.string().optional(),
    utm_campaign: z.string().optional(),
    utm_term: z.string().optional(),
    utm_content: z.string().optional(),
    utm_id: z.string().optional(),
    gclid: z.string().optional(),
    referrer: z.string().optional(),
    landing_page: z.string().optional(),
  }).optional().default({}),
});

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const parsed = BodySchema.safeParse(await req.json());
    if (!parsed.success) {
      return new Response(JSON.stringify({ error: parsed.error.flatten().fieldErrors }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { sessionId, plan, testMode, fallbackEmail, affiliateId, fbclid, fbc, fbp, attribution, checkoutPage } = parsed.data;
    const stripeKey = testMode
      ? Deno.env.get("STRIPE_TEST_SECRET_KEY")
      : Deno.env.get("STRIPE_SECRET_KEY");

    if (!stripeKey) {
      throw new Error(testMode ? "STRIPE_TEST_SECRET_KEY is not set" : "STRIPE_SECRET_KEY is not set");
    }

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });
    const session = await stripe.checkout.sessions.retrieve(sessionId);

    // Attribution fallback: create-checkout stamps UTM / referrer / landing page
    // into the Stripe session metadata, so we can recover it even if the client
    // never sent it (e.g. redirect-based completion).
    const ATTR_KEYS = [
      "utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content",
      "utm_id", "gclid", "referrer", "landing_page",
    ] as const;
    const metaAttribution: Record<string, string> = {};
    for (const key of ATTR_KEYS) {
      const v = (session.metadata as Record<string, string> | null)?.[key];
      if (v) metaAttribution[key] = v;
    }
    const resolvedAttribution: Record<string, string> = {
      ...metaAttribution,
      ...Object.fromEntries(
        Object.entries(attribution || {}).filter(([, v]) => !!v) as [string, string][],
      ),
    };
    const sessionMeta = (session.metadata as Record<string, string> | null) ?? {};
    const testTraffic = metadataIsTest(sessionMeta);
    const capiPlan = metaSendPlan(testTraffic, metaTestEventCode(Deno.env.get("META_TEST_EVENT_CODE")));
    const resolvedFbclid = fbclid || sessionMeta.fbclid || "";
    // fbc/fbp come from the browser (first-touch snapshot) or, when the tab
    // never came back, from the checkout session metadata written at create time.
    const resolvedFbc = fbc || sessionMeta.fbc || "";
    const resolvedFbp = fbp || sessionMeta.fbp || "";

    let resolvedEmail = session.customer_details?.email
      ?? session.customer_email
      ?? fallbackEmail
      ?? session.metadata.email
      ?? "";

    if (!resolvedEmail && typeof session.customer === "string") {
      const customer = await stripe.customers.retrieve(session.customer);
      if (!("deleted" in customer) && customer.email) {
        resolvedEmail = customer.email;
      }
    }

    // "enhanced" = Advanced + Premium Support ($297/mo). It grants the ADVANCED
    // feature tier plus the premium_support flag, so every existing plan rule
    // keeps working unchanged.
    const rawPlan = (session.metadata.plan || plan || "basic").toLowerCase();
    const isPremiumSupport = rawPlan === "enhanced" || rawPlan === "enhanced_annual" || rawPlan === "premium" || rawPlan === "special";
    const resolvedPlan = rawPlan === "advanced" || rawPlan === "advanced_annual" || isPremiumSupport
      ? "ADVANCED"
      : "BASIC";

    const resolvedPrice = typeof session.amount_total === "number"
      ? session.amount_total / 100
      : isPremiumSupport
        ? rawPlan === "enhanced_annual" || rawPlan === "special" ? (rawPlan === "special" ? 997 : 2670) : 297
        : resolvedPlan === "ADVANCED"
          ? rawPlan === "advanced_annual" ? 870 : 97
          : rawPlan === "basic_annual" ? 240 : 27;


    const resolvedName = session.customer_details?.name ?? "";

    // Helper to generate agency slug from name
    const toAgencySlug = (name: string): string => {
      return name
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '')
        .substring(0, 60) || 'my-agency';
    };

    // --- Auto-approve user in the database ---
    if (resolvedEmail) {
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const supabase = createClient(supabaseUrl, supabaseServiceKey);

      // Map plan to DB plan_type enum and set user limits
      const dbPlan = resolvedPlan;
      const maxUsers = resolvedPlan === "ADVANCED" ? 10000 : 5;

      // Generate agency_id from name or email
      const agencySlugSource = resolvedName || resolvedEmail.split('@')[0] || 'my-agency';
      const generatedAgencyId = toAgencySlug(agencySlugSource);

      // Check if user already exists
      const { data: existingUser } = await supabase
        .from("saas_suite_users")
        .select("email, approval, agency_id, agency_name, full_name, fbclid, fbc, fbp, landing_page, utm_source, utm_medium, utm_campaign, utm_term, utm_content, utm_id, gclid, referrer")
        .ilike("email", resolvedEmail)
        .maybeSingle();

      // Paid signups MUST answer the welcome questions — do not pre-complete
      // them here. Existing users who already answered keep their value
      // because this key is simply not part of the update payload.
      const purchaseInput = {
        email: resolvedEmail,
        dbPlan,
        maxUsers,
        resolvedName,
        isPremiumSupport,
        nowIso: new Date().toISOString(),
        agencySlugSource,
        generatedAgencyId,
        resolvedFbclid,
        resolvedFbc,
        resolvedFbp,
        attribution: resolvedAttribution,
        checkoutPage: checkoutPage || "",
      };
      const ensureAgencyRows = async (agencyId: string) => {
        await supabase.from("v2_home_settings").upsert({ agency_id: agencyId }, { onConflict: "agency_id" });
        await supabase.from("agency_menu_config").upsert({
          agency_id: agencyId,
          remove_launchpad: true,
          auto_navigate_on_login: true,
        }, { onConflict: "agency_id" });
      };
      const userColumns = "email, approval, agency_id, agency_name, full_name, fbclid, fbc, fbp, landing_page, utm_source, utm_medium, utm_campaign, utm_term, utm_content, utm_id, gclid, referrer";

      // The row is known to exist on the update path. A timed-out insert does
      // not count until the retry or the unique-violation adopt returns a row.
      let userRowReady = !!existingUser;

      if (existingUser) {
        const patch = purchaseExistingUpdate({ ...purchaseInput, existing: existingUser });
        const written = await writeUntilRow(() =>
          supabase.from("saas_suite_users").update(patch).ilike("email", resolvedEmail).select("email").maybeSingle(),
        );
        if (!written.ok) {
          console.error(`[NOTIFY-STRIPE-PURCHASE] existing user update failed ${resolvedEmail}`, written.reason, written.message);
        }

        // Strip 'NO' suffix from agency IDs (left over from a prior suspension)
        // so menu links / dynamic styles work again after a successful re-purchase.
        await supabase.rpc("restore_user_access", {
          user_email: resolvedEmail,
          user_plan: dbPlan,
        });
        console.log(`[NOTIFY-STRIPE-PURCHASE] Stripped any 'NO' suffix from agency IDs for ${resolvedEmail}`);

        const finalAgencyId = existingUser.agency_id || generatedAgencyId;
        await ensureAgencyRows(finalAgencyId);
        console.log(`[NOTIFY-STRIPE-PURCHASE] Updated existing user: ${resolvedEmail} → approval=YES, plan=${dbPlan}, agency_id=${finalAgencyId}`);
      } else {
        const insertRow = purchaseInsertRow(purchaseInput);
        const committed = await commitSaasUserWrite({
          insert: () => supabase.from("saas_suite_users").insert(insertRow).select("email, agency_id").maybeSingle(),
          adopt: async () => {
            const { data: again, error } = await supabase
              .from("saas_suite_users")
              .select(userColumns)
              .ilike("email", resolvedEmail)
              .maybeSingle();
            if (error) return { data: null, error };
            if (!again) return { data: null, error: null };
            const patch = purchaseExistingUpdate({ ...purchaseInput, existing: again });
            return supabase.from("saas_suite_users").update(patch).ilike("email", resolvedEmail).select("email, agency_id").maybeSingle();
          },
        });
        if (!committed.ok) {
          console.error(`[NOTIFY-STRIPE-PURCHASE] user row not saved ${resolvedEmail}`, committed.reason, committed.message);
        } else {
          userRowReady = true;
          const agencyForHome = (committed.row as { agency_id?: string | null }).agency_id || generatedAgencyId;
          await ensureAgencyRows(agencyForHome);
          if (committed.created) {
            console.log(`[NOTIFY-STRIPE-PURCHASE] Created new user: ${resolvedEmail} → approval=YES, plan=${dbPlan}, agency_id=${generatedAgencyId}`);
          } else {
            await supabase.rpc("restore_user_access", {
              user_email: resolvedEmail,
              user_plan: dbPlan,
            });
            console.log(`[NOTIFY-STRIPE-PURCHASE] Adopted existing user after insert conflict: ${resolvedEmail}`);
          }
        }
      }

      // Webinar-registrant 14-day trial: remember the source, force Advanced,
      // and start a 14-day trial clock so the account gets full access now.
      // Only after the row exists — a lost insert used to make this update match nothing.
      if (userRowReady && sessionMeta.trial_source) {
        const trialPatch = trialAccessUpdate(sessionMeta, new Date().toISOString());
        if (trialPatch) {
          const trial = await writeUntilRow(() =>
            supabase
              .from("saas_suite_users")
              .update(trialPatch)
              .ilike("email", resolvedEmail)
              .select("email, trial_source")
              .maybeSingle(),
          );
          if (!trial.ok) {
            console.error(`[NOTIFY-STRIPE-PURCHASE] trial_source update did not apply ${resolvedEmail}`, trial.reason, trial.message);
          } else {
            console.log(`[NOTIFY-STRIPE-PURCHASE] trial_source applied ${resolvedEmail}`);
          }
        }
      }
    }

    // --- Record affiliate referral if applicable ---
    let resolvedAffiliateId = affiliateId || session.metadata?.affiliateId || null;
    let affiliateSlug = "";

    // Fallback: the user may have signed up free through an affiliate link earlier,
    // in which case the ref is no longer in the checkout payload but IS on their row.
    if (!resolvedAffiliateId && resolvedEmail) {
      try {
        const supabaseAdminLookup = createClient(
          Deno.env.get("SUPABASE_URL")!,
          Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
        );
        const { data: existingRow } = await supabaseAdminLookup
          .from("saas_suite_users")
          .select("affiliate_id")
          .ilike("email", resolvedEmail)
          .maybeSingle();
        if (existingRow?.affiliate_id) {
          resolvedAffiliateId = existingRow.affiliate_id;
          console.log(`[NOTIFY-STRIPE-PURCHASE] Recovered affiliate from user row: ${resolvedAffiliateId}`);
        }
      } catch (e) {
        console.error("[NOTIFY-STRIPE-PURCHASE] Affiliate fallback lookup failed:", e);
      }
    }

    if (resolvedAffiliateId && resolvedEmail) {
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

      // Look up affiliate - could be UUID id or slug.
      // Note: querying id.eq.<non-uuid> throws, so branch on the shape.
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        String(resolvedAffiliateId)
      );
      const { data: affiliate } = await supabaseAdmin
        .from("affiliates")
        .select("id, affiliate_slug, email, full_name, user_email_linked")
        .eq(isUuid ? "id" : "affiliate_slug", resolvedAffiliateId)
        .maybeSingle();

      if (affiliate) {
        affiliateSlug = affiliate.affiliate_slug || "";
        const rateLookup = await supabaseAdmin
          .from("affiliates")
          .select("commission_rate")
          .eq("id", affiliate.id)
          .maybeSingle();
        const commissionPercent = rateLookup.error ? 30 : rateForNewReferral(rateLookup.data?.commission_rate);
        // Insert referral record (ignore duplicates). A new row inherits the affiliate rate.
        // An existing referral keeps the rate it was given at signup.
        await supabaseAdmin.from("affiliate_referrals").upsert(
          {
            affiliate_id: affiliate.id,
            referred_email: resolvedEmail,
            referred_name: resolvedName || null,
            plan: resolvedPlan,
            status: "active",
            commission_rate: commissionPercent,
          },
          { onConflict: "affiliate_id,referred_email", ignoreDuplicates: true }
        );

        // Log purchase event
        await supabaseAdmin.from("affiliate_events").insert({
          affiliate_id: affiliate.id,
          event_type: "purchase",
          page: "checkout",
        });

        // Update the user's affiliate_id in saas_suite_users
        await supabaseAdmin
          .from("saas_suite_users")
          .update({ affiliate_id: affiliate.id })
          .ilike("email", resolvedEmail);

        console.log(`[NOTIFY-STRIPE-PURCHASE] Affiliate referral recorded: affiliate=${affiliate.id}, referred=${resolvedEmail}`);

        // --- Fire affiliate purchase webhook ---
        if (testTraffic) {
          console.log(`[NOTIFY-STRIPE-PURCHASE] skipped affiliate webhook ${sessionId} test traffic`);
        } else try {
          const purchaseAmountBeforeTax = typeof session.amount_subtotal === "number"
            ? session.amount_subtotal / 100
            : resolvedPrice;
          const customerPaid = typeof session.amount_total === "number"
            ? session.amount_total / 100
            : resolvedPrice;
          const commission = commissionOnAmount(purchaseAmountBeforeTax, commissionPercent);
          const affiliateEmail = affiliate.user_email_linked || affiliate.email || "";
          const landingPage = resolvedAttribution.landing_page || "";
          const refLink = affiliate.affiliate_slug
            ? `https://saassuite.ai/?ref=${affiliate.affiliate_slug}`
            : "";

          const affResp = await fetch(affiliatePurchaseWebhookUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              affiliate_email: affiliateEmail,
              affiliate_name: affiliate.full_name || "",
              affiliate_slug: affiliate.affiliate_slug || "",
              affiliate_id: affiliate.id,
              affiliate_link: refLink,
              landing_page: landingPage,
              customer_email: resolvedEmail,
              customer_name: resolvedName,
              plan: resolvedPlan,
              purchase_amount: purchaseAmountBeforeTax,
              customer_paid: customerPaid,
              commission: commission,
              commission_rate: commissionPercent / 100,
              currency: (session.currency || "usd").toUpperCase(),
            }),
          });
          if (!affResp.ok) {
            console.error(`[NOTIFY-STRIPE-PURCHASE] Affiliate webhook failed: ${affResp.status} ${await affResp.text()}`);
          } else {
            console.log(`[NOTIFY-STRIPE-PURCHASE] Affiliate purchase webhook fired: ${affiliateEmail} commission=${commission}`);
          }
        } catch (e) {
          console.error("[NOTIFY-STRIPE-PURCHASE] Affiliate webhook error:", e);
        }
      }
    }

    // --- Meta Purchase, every price point ---
    // Uses the REAL amount charged (session.amount_total) and event_id
    // order_<session id>, matching the browser pixel's eventID so Meta dedupes.
    // Meta's recommended Purchase match parameters come from Stripe's
    // customer_details (name, phone, billing address) — far richer than what
    // the browser can supply.
    const cd = (session.customer_details ?? {}) as Record<string, any>;
    const cdAddress = (cd.address ?? {}) as Record<string, any>;
    const nameParts = String(resolvedName || "").trim().split(/\s+/).filter(Boolean);
    const purchaseRoute = subscriptionPurchasePlan({
      isTest: testTraffic,
      utmSource: resolvedAttribution.utm_source || sessionMeta.utm_source,
      explicitTestEventCode: sessionMeta.test_event_code,
    });
    if (purchaseRoute.route === "stape") {
      if (isOneFeatureKitFunnel(session.metadata)) {
        console.log(`[NOTIFY-STRIPE-PURCHASE] skipped Meta Purchase ${sessionId} one-feature-kit`);
      } else if (skipCheckoutPurchase(session) || resolvedPrice <= 0) {
        console.log(`[NOTIFY-STRIPE-PURCHASE] skipped Meta Purchase ${sessionId} zero total or 100% off`);
      } else {
        const contentId = sessionMeta.plan || sessionMeta.course || sessionMeta.product;
        await sendClaimedSubscriptionPurchase({
          plan: purchaseRoute,
          orderId: sessionId,
          purchase: {
            eventId: purchaseEventId(sessionId),
            eventTimeSec: typeof session.created === "number" ? session.created : Math.floor(Date.now() / 1000),
            value: resolvedPrice,
            currency: session.currency || "USD",
            orderId: sessionId,
            email: resolvedEmail,
            phone: cd.phone ?? null,
            firstName: nameParts[0] ?? null,
            lastName: nameParts.length > 1 ? nameParts.slice(1).join(" ") : null,
            fbp: resolvedFbp || null,
            fbc: resolvedFbc || null,
            fbclid: resolvedFbclid || null,
            eventSourceUrl: checkoutPage,
            clientIp: sessionMeta.client_ip || null,
            clientUserAgent: sessionMeta.client_ua || null,
            externalId: typeof session.customer === "string" ? session.customer : null,
            contentIds: contentId ? [contentId] : null,
          },
        });
      }
    } else if ((testTraffic && !capiPlan.send) || purchaseRoute.route === "skip") {
      console.log(`[NOTIFY-STRIPE-PURCHASE] skipped Meta Purchase ${sessionId} test traffic`);
    } else if (isOneFeatureKitFunnel(session.metadata)) {
      console.log(`[NOTIFY-STRIPE-PURCHASE] skipped Meta Purchase ${sessionId} one-feature-kit`);
    } else if (skipCheckoutPurchase(session) || resolvedPrice <= 0) {
      console.log(`[NOTIFY-STRIPE-PURCHASE] skipped Meta Purchase ${sessionId} zero total or 100% off`);
    } else {
      console.log("purchase route direct", sessionId);
      await sendMetaPurchase({
        orderId: sessionId,
        email: resolvedEmail,
        value: resolvedPrice,
        currency: session.currency || "USD",
        fbclid: resolvedFbclid,
        fbc: resolvedFbc || null,
        fbp: resolvedFbp || null,
        eventSourceUrl: checkoutPage,
        phone: cd.phone ?? null,
        firstName: nameParts[0] ?? null,
        lastName: nameParts.length > 1 ? nameParts.slice(1).join(" ") : null,
        zip: cdAddress.postal_code ?? null,
        city: cdAddress.city ?? null,
        state: cdAddress.state ?? null,
        externalId: typeof session.customer === "string" ? session.customer : null,
        isTest: testTraffic,
      });
    }

    // --- Fire the CRM webhook (still needed for notifications/emails) ---
    let webhookOk = false;
    let webhookDetail: string | null = null;
    if (testTraffic) {
      console.log(`[NOTIFY-STRIPE-PURCHASE] skipped CRM webhook ${sessionId} test traffic`);
      webhookDetail = "test_traffic";
    } else {
    const webhookResponse = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: resolvedEmail,
        name: resolvedName,
        plan: resolvedPlan,
        price: resolvedPrice,
        affiliateId: resolvedAffiliateId || "",
        affiliateSlug: affiliateSlug,
        fbclid: resolvedFbclid || "",
        utm_source: resolvedAttribution.utm_source || "",
        utm_medium: resolvedAttribution.utm_medium || "",
        utm_campaign: resolvedAttribution.utm_campaign || "",
        utm_term: resolvedAttribution.utm_term || "",
        utm_content: resolvedAttribution.utm_content || "",
        utm_id: resolvedAttribution.utm_id || "",
        gclid: resolvedAttribution.gclid || "",
        referrer: resolvedAttribution.referrer || "",
        landing_page: resolvedAttribution.landing_page || "",
        checkout_page: checkoutPage || "",
      }),
    });

    if (!webhookResponse.ok) {
      const responseText = await webhookResponse.text();
      console.error(`[NOTIFY-STRIPE-PURCHASE] Webhook failed: ${webhookResponse.status} ${responseText}`);
      webhookDetail = `http_${webhookResponse.status}`;
      // Don't throw — user is already approved, webhook failure shouldn't block
    } else {
      webhookOk = true;
    }
    }

    const kitPurchase = isOneFeatureKitFunnel(session.metadata);
    await logCustomerMessage({
      userEmail: resolvedEmail,
      channel: "webhook",
      templateKey: "purchase",
      provider: "ghl",
      status: testTraffic ? "suppressed" : webhookOk ? "sent" : "failed",
      source: "notify-stripe-purchase",
      detail: testTraffic ? "test_traffic" : webhookDetail,
      metadata: { session_id: sessionId, plan: rawPlan },
    });
    await recordCheckoutSession({
      stripeCheckoutSessionId: sessionId,
      email: resolvedEmail,
      plan: kitPurchase ? "one_feature_kit" : rawPlan,
      billingInterval: kitPurchase ? "one_time" : billingIntervalForPlan(rawPlan),
      flow: kitPurchase ? "one_feature_kit" : "subscription",
      amountCents: typeof session.amount_total === "number" ? session.amount_total : Math.round(resolvedPrice * 100),
      currency: session.currency || "usd",
      status: "completed",
      isTest: testTraffic,
    });

    console.log(`[NOTIFY-STRIPE-PURCHASE] session=${sessionId} email=${resolvedEmail || "missing"} plan=${resolvedPlan} price=${resolvedPrice}`);

    return new Response(JSON.stringify({
      ok: true,
      email: resolvedEmail,
      plan: resolvedPlan,
      price: resolvedPrice,
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[NOTIFY-STRIPE-PURCHASE] Error:", message);

    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
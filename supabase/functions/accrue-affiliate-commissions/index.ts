import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { billingForAccount } from "../_shared/affiliateInvoices.ts";
import {
  billingLookupKeys,
  invoicePeriodIndex,
  isMissingSchema,
  mapPool,
  rateForReferral,
  roundMoney,
} from "../_shared/affiliateReferrals.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const PAYOUT_WEBHOOK_URL =
  "https://services.leadconnectorhq.com/hooks/T69cI1milcirIORef4Ib/webhook-trigger/139271c2-154a-4cc2-87e1-5159243ca3d4";

/**
 * Daily payout pass (scheduled 9 AM CT outside this file).
 * A commission row is inserted only for a Stripe invoice that was actually paid.
 * The amount is amount_paid minus refunds, times that referral's commission_rate.
 * Trial invoices of $0, unpaid invoices, and list price are not accrued.
 * Older rows with no stripe_invoice_id are left in place and are not sent for payout.
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const url = new URL(req.url);
  const isTest = url.searchParams.get("test") === "1";
  const now = new Date();
  const result = {
    accruedRows: 0,
    updatedRows: 0,
    voidedRows: 0,
    referralsChecked: 0,
    referralsWithInvoices: 0,
    referralsWithoutPaidInvoices: 0,
    invoiceLookupsFailed: 0,
    webhooksFired: 0,
    affiliatesWithPending: 0,
    skippedNoPayoutMethod: 0,
    stripeConfigured: true,
  };

  try {
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY") || "";
    if (!stripeKey) {
      result.stripeConfigured = false;
      return new Response(JSON.stringify({ ok: false, error: "STRIPE_SECRET_KEY is not set", ...result }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });

    const { data: referrals, error: refErr } = await supabase
      .from("affiliate_referrals")
      .select("id, affiliate_id, referred_email, plan, commission_rate, status");
    if (refErr) throw refErr;

    const columnProbe = await supabase.from("affiliate_commissions").select("stripe_invoice_id").limit(1);
    if (columnProbe.error && isMissingSchema(columnProbe.error, "stripe_invoice_id")) {
      return new Response(JSON.stringify({
        ok: false,
        error: "Apply the affiliate referral migration before accruing. List-price months are no longer created.",
        ...result,
      }), { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    if (columnProbe.error) throw columnProbe.error;

    const overrides = new Map<string, { stripeEmail: string | null; stripeCustomerId: string | null }>();
    const overrideQuery = await supabase
      .from("affiliate_billing_overrides")
      .select("referred_email, stripe_email, stripe_customer_id");
    if (overrideQuery.error && !isMissingSchema(overrideQuery.error, "affiliate_billing_overrides")) {
      throw overrideQuery.error;
    }
    for (const row of overrideQuery.data || []) {
      const email = String(row.referred_email || "").trim().toLowerCase();
      if (email) overrides.set(email, { stripeEmail: row.stripe_email, stripeCustomerId: row.stripe_customer_id });
    }

    await mapPool(referrals || [], 3, async (ref) => {
      const email = String(ref.referred_email || "").trim().toLowerCase();
      if (!email.includes("@")) return;
      result.referralsChecked += 1;
      const rate = rateForReferral(ref.commission_rate);
      const lookup = billingLookupKeys(email, overrides.get(email));
      let billing;
      try {
        billing = await billingForAccount(stripe, {
          emails: lookup.emails,
          customerIds: lookup.customerIds,
          ratePercent: rate,
          subscriptions: false,
          keepFullyRefunded: true,
        });
      } catch (error) {
        result.invoiceLookupsFailed += 1;
        console.error("invoice lookup failed", error instanceof Error ? error.message : "unknown");
        return;
      }
      if (billing.payments.length === 0) {
        result.referralsWithoutPaidInvoices += 1;
        return;
      }
      if (billing.payments.some((payment) => payment.net > 0)) result.referralsWithInvoices += 1;

      const { data: existingRows, error: existingError } = await supabase
        .from("affiliate_commissions")
        .select("id, stripe_invoice_id, status, amount, plan_amount, amount_refunded")
        .eq("referral_id", ref.id)
        .not("stripe_invoice_id", "is", null);
      if (existingError) {
        console.error("commission read failed", existingError.message);
        return;
      }
      const existing = new Map((existingRows || []).map((row) => [row.stripe_invoice_id, row]));

      for (const payment of billing.payments) {
        const current = existing.get(payment.id);
        const plan = payment.description || ref.plan || "subscription";
        if (!current) {
          if (payment.net <= 0) continue;
          const { error: insErr } = await supabase.from("affiliate_commissions").insert({
            affiliate_id: ref.affiliate_id,
            referral_id: ref.id,
            referred_email: email,
            plan: String(plan).slice(0, 80),
            plan_amount: payment.net,
            amount_refunded: payment.refunded,
            commission_rate: rate,
            amount: payment.commission,
            period_index: invoicePeriodIndex(payment.createdUnix),
            period_start: payment.paidAt,
            status: "pending",
            stripe_invoice_id: payment.id,
            notes: payment.refunded > 0 ? "Net of refund" : null,
          });
          if (!insErr) result.accruedRows += 1;
          else if (!/duplicate|unique/i.test(insErr.message)) console.error("commission insert failed", insErr.message);
          continue;
        }
        if (current.status === "paid") continue;
        const same = Number(current.amount) === payment.commission
          && Number(current.plan_amount) === payment.net
          && Number(current.amount_refunded) === payment.refunded;
        if (same) continue;
        const { error: updErr } = await supabase.from("affiliate_commissions").update({
          plan_amount: payment.net,
          amount_refunded: payment.refunded,
          amount: payment.commission,
          commission_rate: rate,
          notes: payment.net <= 0 ? "Refunded" : "Net of refund",
          status: payment.net <= 0 ? "cancelled" : "pending",
        }).eq("id", current.id).eq("status", "pending");
        if (!updErr) {
          if (payment.net <= 0) result.voidedRows += 1;
          else result.updatedRows += 1;
        }
      }
    });

    const { data: affiliates, error: affErr } = await supabase
      .from("affiliates")
      .select("id, full_name, email, affiliate_slug, payout_method");
    if (affErr) throw affErr;

    for (const aff of affiliates || []) {
      const { data: pending, error: pendingError } = await supabase
        .from("affiliate_commissions")
        .select("amount, referred_email, period_index, period_start, plan, plan_amount, stripe_invoice_id, amount_refunded")
        .eq("affiliate_id", aff.id)
        .eq("status", "pending")
        .not("stripe_invoice_id", "is", null);
      if (pendingError) {
        console.error("pending commission read failed", pendingError.message);
        continue;
      }
      if (!pending || pending.length === 0) continue;

      const pendingTotal = pending.reduce((sum, row) => sum + Number(row.amount), 0);
      result.affiliatesWithPending += 1;
      if (!aff.payout_method) {
        result.skippedNoPayoutMethod += 1;
        continue;
      }

      const { data: paidRows } = await supabase
        .from("affiliate_commissions")
        .select("amount")
        .eq("affiliate_id", aff.id)
        .eq("status", "paid")
        .not("stripe_invoice_id", "is", null);
      const totalPaid = (paidRows || []).reduce((sum, row) => sum + Number(row.amount), 0);

      const payload = {
        affiliate_id: aff.id,
        affiliate_name: aff.full_name,
        affiliate_email: aff.email,
        affiliate_slug: aff.affiliate_slug,
        payout_method: aff.payout_method,
        pending_amount: roundMoney(pendingTotal),
        pending_commissions_count: pending.length,
        total_paid: roundMoney(totalPaid),
        total_earned: roundMoney(pendingTotal + totalPaid),
        commissions: pending.map((row) => ({
          referred_email: row.referred_email,
          plan: row.plan,
          amount: row.amount,
          net_paid: row.plan_amount,
          refunded: row.amount_refunded,
          paid_at: row.period_start,
          stripe_invoice_id: row.stripe_invoice_id,
        })),
        timestamp: now.toISOString(),
        test: isTest,
      };

      try {
        await fetch(PAYOUT_WEBHOOK_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        result.webhooksFired += 1;
      } catch (err) {
        console.error("Payout webhook failed for affiliate", aff.id, err);
      }
    }

    return new Response(JSON.stringify({ ok: true, ...result }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("accrue-affiliate-commissions error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error", ...result }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});

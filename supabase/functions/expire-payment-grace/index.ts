import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'jsr:@supabase/supabase-js@2';
import Stripe from "https://esm.sh/stripe@18.5.0";
import { purgeBrandingCacheForEmail } from '../_shared/branding-cache.ts';
import { KIT_BASIC_TRIAL_SOURCE, kitBasicTrialEnded } from '../_shared/kit-basic.ts';
import {
  bindSubscriptionCanceledClaim,
  delinquencyAuditDetails,
  insertSubscriptionCanceledClaim,
  readCancelClaim,
  recordSubscriptionCanceled,
  resolveImmediateCancelClaimKey,
  writeCancelSchedule,
} from '../_shared/subscription-cancel-log.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

// LeadConnector cancellation/payment-past-due webhook.
const CANCELLATION_WEBHOOK_URL =
  'https://services.leadconnectorhq.com/hooks/T69cI1milcirIORef4Ib/webhook-trigger/8269ec40-aa2b-4068-b3b7-4cc6404d8ff8';

/** Active or trialing SaaSSuite subscription. null means the check failed and the grant stays. */
async function buyerHasPaidSubscription(email: string): Promise<boolean | null> {
  const key = Deno.env.get("STRIPE_SECRET_KEY");
  if (!key) {
    console.error("kit basic expiry skipped", JSON.stringify({ email, reason: "STRIPE_SECRET_KEY missing" }));
    return null;
  }
  try {
    const stripe = new Stripe(key, { apiVersion: "2025-08-27.basil" });
    const customers = await stripe.customers.list({ email, limit: 5 });
    for (const customer of customers.data) {
      for (const status of ["active", "trialing"] as const) {
        const subs = await stripe.subscriptions.list({ customer: customer.id, status, limit: 1 });
        if (subs.data.length > 0) return true;
      }
    }
    return false;
  } catch (error) {
    console.error("kit basic expiry skipped", JSON.stringify({
      email,
      reason: error instanceof Error ? error.message : "stripe check failed",
    }));
    return null;
  }
}

/** Return an expired kit Basic grant to Starter. A paid subscription keeps the plan. */
async function expireKitBasicTrials(supabase: { from: (table: string) => any }) {
  const { data, error } = await supabase
    .from("saas_suite_users")
    .select("email, plan, trial_source, trial_start_date, trial_length")
    .eq("trial_source", KIT_BASIC_TRIAL_SOURCE)
    .eq("plan", "BASIC");
  if (error) {
    console.error("kit basic expiry lookup failed", error.message);
    return;
  }
  for (const row of data ?? []) {
    const email = row.email?.trim().toLowerCase();
    if (!email || !kitBasicTrialEnded(row)) continue;
    const paid = await buyerHasPaidSubscription(email);
    if (paid === null) continue;
    if (paid) {
      const { error: clearError } = await supabase
        .from("saas_suite_users")
        .update({ trial_source: null })
        .ilike("email", email)
        .eq("trial_source", KIT_BASIC_TRIAL_SOURCE);
      if (clearError) console.error("kit basic expiry skipped", JSON.stringify({ email, reason: clearError.message }));
      else console.log("kit basic kept for paid subscription", JSON.stringify({ email }));
      continue;
    }
    const { error: downgradeError } = await supabase
      .from("saas_suite_users")
      .update({ plan: "STARTER", max_onboarding_users: 1 })
      .ilike("email", email)
      .eq("plan", "BASIC")
      .eq("trial_source", KIT_BASIC_TRIAL_SOURCE);
    if (downgradeError) {
      console.error("kit basic expiry failed", JSON.stringify({ email, reason: downgradeError.message }));
      continue;
    }
    console.log("kit basic trial ended", JSON.stringify({ email, plan: "STARTER" }));
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { data: expired, error: listError } = await supabase.rpc('expired_payment_grace_users');

    if (listError) {
      console.error('[EXPIRE-GRACE] Error fetching expired users:', listError);
      return new Response(JSON.stringify({ error: listError.message }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const users = (expired ?? []) as Array<{ email: string }>;

    // Canceled accounts whose paid billing period has now ended.
    const { data: ended, error: endedErr } = await supabase.rpc('expired_cancel_access_users');
    if (endedErr) console.error('[EXPIRE-GRACE] cancel-access lookup failed:', endedErr);
    for (const e of (ended ?? []) as Array<{ email: string; cancel_access_until?: string | null }>) {
      const em = e.email?.trim().toLowerCase();
      if (!em) continue;
      const until = e.cancel_access_until ?? null;
      const { data: priorMessages, error: priorError } = await supabase
        .from('customer_message_events')
        .select('metadata')
        .eq('template_key', 'subscription_canceled')
        .eq('user_email', em)
        .order('created_at', { ascending: false })
        .limit(20);
      if (priorError) console.error(`[EXPIRE-GRACE] cancel claim lookup failed ${em}:`, priorError.message);
      const stored = await readCancelClaim(supabase, em);
      // Same claim customer.subscription.deleted uses once the period has ended.
      // A missing prior row still posts. The email fallback is a key that delete honors.
      const claimKey = resolveImmediateCancelClaimKey({
        storedKey: stored.claimKey,
        priorMessages: priorMessages ?? [],
        cancelAccessUntil: until ?? stored.accessUntil,
        email: em,
      });
      const claim = bindSubscriptionCanceledClaim(supabase);
      const recorded = await recordSubscriptionCanceled({
        email: em,
        kind: 'immediate',
        accessUntil: until,
        dedupeKey: claimKey,
        source: 'expire-payment-grace',
        webhookBody: { email: em, reason: 'stripe_canceled_period_end' },
        markStatus: claim.markStatus,
        insertMessage: (row) => insertSubscriptionCanceledClaim(supabase, row),
      });
      if (!recorded.logged && !recorded.duplicate) {
        console.error(`[EXPIRE-GRACE] subscription_canceled claim failed ${em} key=${claimKey}`);
      }
      const { data: d, error: err } = await supabase.rpc('mark_payment_delinquent', {
        user_email: em, p_reason: 'stripe_canceled_period_end',
      });
      if (err) { console.error(`[EXPIRE-GRACE] downgrade failed ${em}:`, err); continue; }
      await writeCancelSchedule(supabase, em, {
        cancel_access_until: null,
        cancel_claim_key: null,
        premium_support: false,
      });
      await purgeBrandingCacheForEmail(supabase, em);
      const { data: existingAudit, error: auditError } = await supabase
        .from('billing_delinquency_log')
        .select('id')
        .eq('email', em)
        .eq('action', 'past_due')
        .contains('details', { cancel_key: claimKey })
        .limit(1);
      if (auditError) console.error(`[EXPIRE-GRACE] delinquency audit lookup failed ${em}:`, auditError.message);
      if (!auditError && (existingAudit?.length ?? 0) === 0) {
        await supabase.from('billing_delinquency_log').insert({
          email: em,
          action: 'past_due',
          details: delinquencyAuditDetails(d, claimKey),
        });
      }
      console.log(`[EXPIRE-GRACE] Billing period ended, downgraded ${em}`);
    }
    await expireKitBasicTrials(supabase);
    console.log(`[EXPIRE-GRACE] Found ${users.length} expired user(s)`);

    const results: Array<{ email: string; marked_past_due: boolean; webhook_ok: boolean; error?: string }> = [];

    for (const u of users) {
      const email = u.email?.trim().toLowerCase();
      if (!email) continue;

      try {
        // 1) Flip to PAST_DUE — the owner keeps logging in, their customers
        //    (except the first one) lose hub access and branding is parked.
        const { data: delinquency, error: suspErr } = await supabase.rpc('mark_payment_delinquent', {
          user_email: email,
          p_reason: 'payment_grace_expired',
        });

        if (suspErr) {
          console.error(`[EXPIRE-GRACE] mark_payment_delinquent error for ${email}:`, suspErr);
          results.push({ email, marked_past_due: false, webhook_ok: false, error: suspErr.message });
          continue;
        }

        // 2) Clear grace fields so we don't process this user again
        await supabase
          .from('saas_suite_users')
          .update({
            payment_grace_until: null,
          })
          .ilike('email', email);

        // 2b) Rebuild branding artifacts without the parked branding.
        await purgeBrandingCacheForEmail(supabase, email);
        await supabase.from('billing_delinquency_log').insert({
          email,
          action: 'past_due',
          details: delinquency,
        });

        // 3) Fire the payment-past-due/cancellation LeadConnector webhook
        let webhookOk = false;
        try {
          const resp = await fetch(CANCELLATION_WEBHOOK_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, reason: 'payment_grace_expired' }),
          });
          webhookOk = resp.ok;
          if (!resp.ok) {
            console.error(`[EXPIRE-GRACE] Webhook failed for ${email}:`, resp.status, await resp.text());
          }
        } catch (whErr) {
          console.error(`[EXPIRE-GRACE] Webhook exception for ${email}:`, whErr);
        }

        console.log(`[EXPIRE-GRACE] Marked ${email} past due (was=${delinquency ? 'found' : 'not_found'})`);
        results.push({ email, marked_past_due: !!delinquency, webhook_ok: webhookOk });
      } catch (perUserErr) {
        console.error(`[EXPIRE-GRACE] Error for ${email}:`, perUserErr);
        results.push({ email, marked_past_due: false, webhook_ok: false, error: (perUserErr as Error).message });
      }
    }

    return new Response(JSON.stringify({ processed: results.length, results }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('[EXPIRE-GRACE] Fatal error:', error);
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
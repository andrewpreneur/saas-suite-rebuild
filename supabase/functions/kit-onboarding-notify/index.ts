import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";
import { z } from "npm:zod@3.24.2";
import { forwardKitSlack, kitDb, kitHash } from "../_shared/kit-payment.ts";
import { logCustomerMessage } from "../_shared/journey-log.ts";
import {
  buildKitOnboardingNotice,
  checkoutIdMissing,
  deliverKitOnboardingWebhook,
  kitOnboardingWebhookUrl,
  onboardingNotifyAccess,
  onboardingNotifyActionKey,
  onboardingNotifyPlan,
  onboardingSourceOk,
  orderLinesMissing,
  priorOnboardingOutcomes,
  runClaimedOnboardingNotify,
  type ChannelResult,
  type KitPurchaseForOnboarding,
  type OnboardingOrderPatch,
  type OnboardingRow,
} from "../_shared/kit-onboarding-notify.ts";

/**
 * Notifies the team after a One Feature Kit onboarding insert.
 * Slack uses forwardKitSlack (SLACK_NOTIFY_TOKEN + KIT_SLACK_AGENCY_ID), the
 * same post as requestKitNotify. GoHighLevel gets GHL_KIT_ONBOARDING_WEBHOOK_URL
 * when that secret is set, and the onboarding workflow hook when it is unset.
 * A blank value skips. No customer email is sent.
 * Do not deploy this function from an agent.
 */
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const schema = z.object({
  id: z.string().uuid(),
  email: z.string().trim().min(3).max(320),
  replay: z.boolean().optional(),
});

function edgeWaitUntil(): ((promise: Promise<unknown>) => void) | null {
  const runtime = (globalThis as { EdgeRuntime?: { waitUntil?: (promise: Promise<unknown>) => void } }).EdgeRuntime;
  if (typeof runtime?.waitUntil !== "function") return null;
  return (promise) => runtime.waitUntil!(promise);
}

async function callerContext(bearer: string): Promise<{ internal: boolean; sessionEmail: string | null; platformAdmin: boolean }> {
  const slack = Deno.env.get("SLACK_NOTIFY_TOKEN") ?? "";
  const internal = Boolean(slack) && Boolean(bearer) && await kitHash(bearer) === await kitHash(slack);
  if (internal) return { internal: true, sessionEmail: null, platformAdmin: false };
  const url = Deno.env.get("SUPABASE_URL");
  const anon = Deno.env.get("SUPABASE_ANON_KEY");
  if (!url || !anon) return { internal: false, sessionEmail: null, platformAdmin: false };
  const userClient = createClient(url, anon, {
    global: { headers: { Authorization: `Bearer ${bearer}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await userClient.auth.getUser(bearer);
  if (error || !data.user?.email) return { internal: false, sessionEmail: null, platformAdmin: false };
  const { data: admin, error: adminError } = await userClient.rpc("is_platform_admin");
  return { internal: false, sessionEmail: data.user.email, platformAdmin: !adminError && admin === true };
}

async function writeOnboardingPatch(db: ReturnType<typeof kitDb>, id: string, patch: OnboardingOrderPatch) {
  if (patch.checkout_id) {
    const cleared = await db.from("funnel_onboarding").update({ checkout_id: patch.checkout_id }).eq("id", id).is("checkout_id", null);
    if (cleared.error) console.error("kit onboarding enrich checkout", cleared.error.message);
    const blank = await db.from("funnel_onboarding").update({ checkout_id: patch.checkout_id }).eq("id", id).eq("checkout_id", "");
    if (blank.error) console.error("kit onboarding enrich checkout", blank.error.message);
  }
  if (patch.order_lines) {
    const lines = await db.from("funnel_onboarding").update({ order_lines: patch.order_lines }).eq("id", id).filter("order_lines", "eq", "[]");
    if (lines.error) console.error("kit onboarding enrich lines", lines.error.message);
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  const bearer = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
  if (!bearer) return json({ error: "Unauthorized" }, 401);
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success || !parsed.data.email.includes("@")) return json({ error: "Invalid onboarding notification" }, 400);

  const replay = parsed.data.replay === true;
  const bodyEmail = parsed.data.email.trim().toLowerCase();
  try {
    const db = kitDb();
    const caller = await callerContext(bearer);
    const { data, error } = await db
      .from("funnel_onboarding")
      .select("id, created_at, checkout_id, first_name, email, phone, order_lines, answers, source")
      .eq("id", parsed.data.id)
      .maybeSingle();
    if (error) {
      console.error("kit onboarding load", error.message);
      return json({ error: "Onboarding row could not be loaded" }, 500);
    }
    const row = data as OnboardingRow | null;
    if (!row || !onboardingSourceOk(row.source)) return json({ error: "Onboarding row was not found" }, 404);
    const access = onboardingNotifyAccess({
      rowEmail: row.email,
      bodyEmail,
      createdAt: row.created_at,
      now: Date.now(),
      replay,
      sessionEmail: caller.sessionEmail,
      platformAdmin: caller.platformAdmin,
      internal: caller.internal,
    });
    if (!access.ok) return json({ error: access.error }, access.status);

    let purchases: KitPurchaseForOnboarding[] = [];
    if (checkoutIdMissing(row.checkout_id) || orderLinesMissing(row.order_lines)) {
      const found = await db
        .from("kit_purchases")
        .select("email, checkout_session_id, line_id, amount_cents, created_at")
        .ilike("email", bodyEmail)
        .limit(100);
      if (found.error) console.error("kit onboarding purchases", found.error.message);
      else purchases = (found.data ?? []) as KitPurchaseForOnboarding[];
    }
    const notice = buildKitOnboardingNotice(row, purchases);
    if (notice.patch.checkout_id || notice.patch.order_lines) {
      await writeOnboardingPatch(db, row.id, notice.patch);
    }

    const actionKey = onboardingNotifyActionKey(row.id);
    const { data: claimed, error: claimError } = await db.rpc("claim_one_feature_kit_action", { p_key: actionKey });
    if (claimError) {
      console.error("kit onboarding claim", claimError.message);
      return json({ error: "Notification claim failed" }, 502);
    }
    let claim: "claimed" | "duplicate" | "busy" = claimed ? "claimed" : "busy";
    if (!claimed) {
      const { data: action } = await db.from("one_feature_kit_actions").select("completed").eq("action_key", actionKey).maybeSingle();
      claim = action?.completed ? "duplicate" : "busy";
    }
    if (claim === "duplicate") return json({ ok: true, duplicate: true });
    if (claim === "busy") return json({ ok: false, error: "Notification is already processing" }, 409);

    const logged = await db
      .from("customer_message_events")
      .select("provider, status")
      .eq("template_key", actionKey)
      .limit(20);
    if (logged.error) console.error("kit onboarding outcomes", logged.error.message);
    const prior = priorOnboardingOutcomes(logged.data ?? []);
    const plan = onboardingNotifyPlan({ claim: "claimed", prior });

    const task = runClaimedOnboardingNotify({
      plan,
      prior,
      sendSlack: async () => {
        try {
          const result = await forwardKitSlack("one_feature_kit_onboarding", notice.slack);
          if ("skipped" in result) return "skipped";
          return "sent";
        } catch (sendError) {
          console.error("kit onboarding slack", sendError instanceof Error ? sendError.message : "unknown");
          return "failed";
        }
      },
      sendGhl: async () => {
        const url = kitOnboardingWebhookUrl(Deno.env.get("GHL_KIT_ONBOARDING_WEBHOOK_URL"));
        if (!url) {
          console.warn("kit onboarding webhook skipped: GHL_KIT_ONBOARDING_WEBHOOK_URL not configured");
          return "skipped";
        }
        const outcome = await deliverKitOnboardingWebhook(url, JSON.stringify(notice.webhook), async (target, body, signal) => {
          const res = await fetch(target, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body,
            signal,
          });
          return { ok: res.ok, status: res.status };
        });
        if (outcome === "failed") console.error("kit onboarding webhook failed");
        return outcome;
      },
      log: async (channel, result: ChannelResult) => {
        await logCustomerMessage({
          userEmail: notice.email,
          channel: "webhook",
          templateKey: actionKey,
          provider: channel === "slack" ? "slack" : "gohighlevel",
          status: result === "sent" ? "sent" : result === "skipped" ? "suppressed" : "failed",
          source: "kit-onboarding-notify",
          detail: result,
          metadata: { onboarding_id: row.id, action_key: actionKey },
        });
      },
      complete: async () => {
        const { error: doneError } = await db.from("one_feature_kit_actions").update({ completed: true }).eq("action_key", actionKey);
        if (doneError) throw new Error("Notification completion failed");
      },
      release: async () => {
        await db.from("one_feature_kit_actions").update({ lease_until: new Date(0).toISOString() }).eq("action_key", actionKey);
      },
    });

    // The thank-you page does not wait. Keep the posts alive after the response.
    // Admin replay waits so the script can see both outcomes.
    if (!replay) {
      const waitUntil = edgeWaitUntil();
      if (waitUntil) {
        waitUntil(task.then(
          (result) => {
            if (!result.ok) console.error("kit onboarding notify incomplete", JSON.stringify({ slack: result.slack, ghl: result.ghl }));
          },
          (error) => {
            console.error("kit onboarding notify", error instanceof Error ? error.message : "unknown");
          },
        ));
        return json({ ok: true, accepted: true });
      }
    }
    const result = await task;
    return json({
      ok: result.ok,
      slack: result.slack,
      ghl: result.ghl,
      duplicate: result.duplicate === true,
      enriched: Boolean(notice.patch.checkout_id || notice.patch.order_lines),
    }, result.ok ? 200 : 502);
  } catch (error) {
    console.error("kit onboarding notify", error instanceof Error ? error.message : "unknown");
    return json({ error: "Notification needs retry" }, 502);
  }
});

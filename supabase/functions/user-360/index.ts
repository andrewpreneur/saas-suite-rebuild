import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";
import { moduleCompletionUserIds } from "../_shared/moduleCompletionIds.ts";
import { isPlatformAdminEmail } from "../_shared/platformAdmins.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-api-key",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

/** Constant-time-ish comparison so we don't leak key length/prefix via timing. */
function safeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/**
 * Full user profile lookup by email — "everything we know" about a SaaSSuite user.
 *
 * Auth (one of):
 *  - header `x-api-key: <USER_360_API_KEY>`
 *  - header `Authorization: Bearer <supabase session token>` for the platform admin
 *
 * GET  /user-360?email=someone@example.com
 * POST /user-360  { "email": "someone@example.com", "limit": 200 }
 */
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  );

  // ---------- auth ----------
  try {
    const configuredKey = Deno.env.get("USER_360_API_KEY") || "";
    const providedKey = req.headers.get("x-api-key") || "";
    let authorized = false;

    if (configuredKey && providedKey && safeEqual(providedKey, configuredKey)) {
      authorized = true;
    } else {
      const authHeader = req.headers.get("Authorization") || "";
      if (authHeader.startsWith("Bearer ")) {
        const token = authHeader.slice(7);
        const { data } = await admin.auth.getUser(token);
        const email = data.user?.email?.trim().toLowerCase();
        if (isPlatformAdminEmail(email)) authorized = true;
      }
    }

    if (!authorized) return json({ error: "Unauthorized" }, 401);
  } catch (_e) {
    return json({ error: "Unauthorized" }, 401);
  }

  try {
    const url = new URL(req.url);
    let email = (url.searchParams.get("email") || "").trim().toLowerCase();
    let limit = Number(url.searchParams.get("limit") || 0);
    if (req.method === "POST") {
      const body = await req.json().catch(() => ({}));
      if (!email) email = String(body?.email || "").trim().toLowerCase();
      if (!limit) limit = Number(body?.limit || 0);
    }
    if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      return json({ error: "Provide a valid `email`" }, 400);
    }
    const cap = Math.min(Math.max(limit || 100, 1), 500);

    // ---------- core records ----------
    const [user, progress, onboardingResponses, authStatus, community] = await Promise.all([
      admin.from("saas_suite_users").select("*").ilike("email", email).maybeSingle(),
      admin.from("user_progress").select("*").ilike("email", email).order("created_at", { ascending: true }),
      admin.from("user_onboarding_responses").select("*").order("created_at", { ascending: false }).limit(50),
      admin.from("user_auth_status").select("*").limit(50),
      admin.from("community_profiles").select("*").ilike("email", email).maybeSingle(),
    ]);

    const u = user.data as Record<string, unknown> | null;
    const progressRows = progress.data || [];
    const progressIds = moduleCompletionUserIds(progressRows.map((r: any) => r.id));

    // agency ids this user owns (all plan slots), used for agency-scoped lookups
    const agencyIds = [
      u?.agency_id,
      u?.agency_id_basic,
      u?.agency_id_advanced,
      u?.agency_id_elite,
    ].filter(Boolean) as string[];

    // ---------- everything else, in parallel ----------
    const [
      analytics,
      sessions,
      platformEvents,
      externalEvents,
      tickets,
      onboardingCalls,
      warmup,
      leads,
      giveaway,
      affiliate,
      supportSeat,
      seatsOwned,
      toolData,
      marketing,
      followups,
      checklist,
      moduleCompletion,
      dismissedTips,
      aiMessages,
      copilotMessages,
      banned,
      accountAdmins,
    ] = await Promise.all([
      admin.from("site_analytics_events").select("*").ilike("user_email", email).order("created_at", { ascending: false }).limit(cap),
      admin.from("user_activity_sessions").select("*").ilike("user_email", email).order("created_at", { ascending: false }).limit(cap),
      admin.from("platform_events").select("*").ilike("user_email", email).order("created_at", { ascending: false }).limit(cap),
      admin.from("external_platform_events").select("*").ilike("user_email", email).order("created_at", { ascending: false }).limit(cap),
      admin.from("support_tickets").select("*").ilike("customer_email", email).order("created_at", { ascending: false }).limit(cap),
      admin.from("onboarding_calls").select("*").ilike("email", email).order("created_at", { ascending: false }).limit(cap),
      admin.from("email_warmup_requests").select("*").ilike("user_email", email).order("created_at", { ascending: false }),
      admin.from("free_leads").select("*").ilike("user_email", email).order("created_at", { ascending: false }),
      admin.from("giveaway_entries").select("*").ilike("email", email).maybeSingle(),
      admin.from("affiliates").select("*").or(`email.ilike.${email},user_email_linked.ilike.${email}`),
      admin.from("agency_support_clients").select("*").ilike("client_email", email),
      admin.from("agency_support_clients").select("*").ilike("owner_email", email),
      admin.from("user_tool_data").select("*").ilike("user_email", email),
      admin.from("marketing_tool_data").select("*").ilike("user_email", email).maybeSingle(),
      admin.from("followup_email_log").select("*").ilike("user_email", email).order("created_at", { ascending: false }).limit(cap),
      admin.from("user_onboarding_checklist_completion").select("*").ilike("user_identifier", email),
      progressIds.length
        ? admin.from("module_completion").select("*").in("user_id", progressIds)
        : Promise.resolve({ data: [] as unknown[] } as any),
      admin.from("user_dismissed_tips").select("*").ilike("user_email", email),
      admin.from("ai_chat_messages").select("*").ilike("user_identifier", email).order("created_at", { ascending: false }).limit(cap),
      admin.from("copilot_chat_messages").select("*").ilike("owner_email", email).order("created_at", { ascending: false }).limit(cap),
      admin.from("banned_users").select("*").ilike("user_identifier", email),
      admin.from("account_admins").select("*").or(`owner_email.ilike.${email},admin_email.ilike.${email}`),
    ]);

    // auth.users record (signup date/time, confirmation, last sign in)
    let authUser: Record<string, unknown> | null = null;
    try {
      const { data: list } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
      const match = list?.users?.find((x) => x.email?.toLowerCase() === email);
      if (match) {
        authUser = {
          id: match.id,
          email: match.email,
          created_at: match.created_at,
          last_sign_in_at: match.last_sign_in_at,
          email_confirmed_at: (match as any).email_confirmed_at ?? null,
          phone: match.phone ?? null,
          providers: (match.app_metadata as any)?.providers ?? null,
          user_metadata: match.user_metadata ?? null,
        };
      }
    } catch (e) {
      console.warn("[USER-360] auth lookup failed:", e instanceof Error ? e.message : e);
    }

    const authUserIds = new Set(
      [authUser?.id as string | undefined].filter(Boolean) as string[],
    );

    const analyticsRows = analytics.data || [];
    const firstTouch = [...analyticsRows].reverse()[0] || null;

    const summary = {
      email,
      exists: Boolean(u || progressRows.length || authUser),
      full_name: (u?.full_name as string) ?? (progressRows[0] as any)?.name ?? null,
      plan: u?.plan ?? null,
      approval: u?.approval ?? null,
      signed_up_at: authUser?.created_at ?? u?.created_at ?? null,
      account_row_created_at: u?.created_at ?? null,
      first_seen_at: firstTouch?.created_at ?? null,
      last_login_at: u?.last_login_at ?? null,
      last_accessed: u?.last_accessed ?? null,
      login_count: u?.login_count ?? 0,
      agency_id: u?.agency_id ?? null,
      agency_ids: agencyIds,
      agency_name: u?.agency_name ?? null,
      has_agency_name: Boolean(u?.agency_name),
      initial_questions_completed: u?.initial_questions_completed ?? null,
      onboarding_completed: u?.onboarding_completed ?? null,
      onboarding_started_at: u?.onboarding_started_at ?? null,
      onboarding_completed_at: u?.onboarding_completed_at ?? null,
      onboarding_step: u?.onboarding_step ?? null,
      installed: Boolean(u?.install_confirmed_at),
      install_confirmed_at: u?.install_confirmed_at ?? null,
      install_guide_sent_at: u?.install_guide_sent_at ?? null,
      tried_it_out: progressRows.length > 0,
      progress_records: progressRows.length,
      videos_watched_count: u?.videos_watched_count ?? 0,
      videos_skipped_count: u?.videos_skipped_count ?? 0,
      total_watch_time_seconds: u?.total_watch_time_seconds ?? 0,
      ai_questions_count: u?.ai_questions_count ?? 0,
      tickets_opened_count: u?.tickets_opened_count ?? 0,
      signup_device: u?.signup_device ?? null,
      last_device: u?.last_device ?? null,
      payment_failed_at: u?.payment_failed_at ?? null,
      payment_grace_until: u?.payment_grace_until ?? null,
      agency_support_wallet: u?.agency_support_wallet ?? 0,
      onboarding_call_wallet: u?.onboarding_call_wallet ?? 0,
      custom_domain: u?.custom_domain ?? null,
      is_banned: (banned.data || []).length > 0,
    };

    const attribution = {
      source: u?.source ?? null,
      landing_page: u?.landing_page ?? null,
      checkout_page: u?.checkout_page ?? null,
      referrer: u?.referrer ?? null,
      utm_source: u?.utm_source ?? null,
      utm_medium: u?.utm_medium ?? null,
      utm_campaign: u?.utm_campaign ?? null,
      utm_term: u?.utm_term ?? null,
      utm_content: u?.utm_content ?? null,
      utm_id: u?.utm_id ?? null,
      fbclid: u?.fbclid ?? null,
      gclid: u?.gclid ?? null,
      affiliate_id: u?.affiliate_id ?? null,
      first_page_seen: firstTouch
        ? {
            path: firstTouch.path,
            page_title: firstTouch.page_title,
            referrer: firstTouch.referrer,
            device: firstTouch.device,
            browser: firstTouch.browser,
            country: firstTouch.country,
            city: firstTouch.city,
            at: firstTouch.created_at,
          }
        : null,
    };

    return json({
      summary,
      attribution,
      account: u ?? null,
      auth_user: authUser,
      auth_status: (authStatus.data || []).filter((r: any) => authUserIds.has(r.user_id)),
      user_progress: progressRows,
      onboarding_responses: (onboardingResponses.data || []).filter((r: any) =>
        progressIds.includes(r.user_id),
      ),
      onboarding_checklist_completed: checklist.data || [],
      module_completion: moduleCompletion.data || [],
      community_profile: community.data ?? null,
      analytics_events: analyticsRows,
      activity_sessions: sessions.data || [],
      platform_events: platformEvents.data || [],
      external_platform_events: externalEvents.data || [],
      support_tickets: tickets.data || [],
      onboarding_calls: onboardingCalls.data || [],
      email_warmup_requests: warmup.data || [],
      free_leads_requests: leads.data || [],
      giveaway_entry: giveaway.data ?? null,
      affiliate_records: affiliate.data || [],
      agency_support_seat: supportSeat.data || [],
      agency_support_seats_owned: seatsOwned.data || [],
      tool_data: toolData.data || [],
      marketing_tool_data: marketing.data ?? null,
      followup_emails: followups.data || [],
      ai_chat_messages: aiMessages.data || [],
      copilot_messages: copilotMessages.data || [],
      dismissed_tips: dismissedTips.data || [],
      banned_records: banned.data || [],
      account_admin_links: accountAdmins.data || [],
      meta: { row_limit: cap, generated_at: new Date().toISOString() },
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("[USER-360] Error:", msg);
    return json({ error: msg }, 500);
  }
});

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { supportExtraFields } from "../_shared/support-context.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const WEBHOOK_URL =
  "https://services.leadconnectorhq.com/hooks/OE1sYR1a8htFn9xA3l81/webhook-trigger/91894004-d606-43c3-9a70-3711dcfeba40";

const isEmail = (s: string | null | undefined) =>
  !!s && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s.trim());

const THROTTLE_HOURS = 6;
const AI_TIMEOUT_MS = 8000;
const WEBHOOK_TIMEOUT_MS = 8000;

const timedFetch = (url: string, init: RequestInit, timeoutMs: number) =>
  fetch(url, { ...init, signal: AbortSignal.timeout(timeoutMs) });

/**
 * Returns true when we should skip sending because a webhook for the same
 * (source, agency_id, identifier) was already sent within THROTTLE_HOURS.
 * Records the send timestamp when we're clear to send.
 */
async function shouldThrottle(
  supabase: ReturnType<typeof createClient>,
  source: string,
  agencyId: string | null,
  identifier: string,
): Promise<boolean> {
  const cutoff = new Date(Date.now() - THROTTLE_HOURS * 60 * 60 * 1000).toISOString();
  const { data: existing } = await supabase
    .from("team_reply_webhook_throttle")
    .select("id, last_sent_at")
    .eq("source", source)
    .eq("agency_id", agencyId ?? "")
    .eq("identifier", identifier)
    .maybeSingle();

  if (existing && existing.last_sent_at && existing.last_sent_at > cutoff) {
    return true;
  }

  if (existing) {
    await supabase
      .from("team_reply_webhook_throttle")
      .update({ last_sent_at: new Date().toISOString() })
      .eq("id", existing.id);
  } else {
    await supabase.from("team_reply_webhook_throttle").insert({
      source,
      agency_id: agencyId ?? "",
      identifier,
      last_sent_at: new Date().toISOString(),
    });
  }
  return false;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));
    const {
      agency_id,
      user_identifier,
      our_message,
      test: isTest,
      source,
      owner_email,
      client_email,
    } = body as {
      agency_id?: string;
      user_identifier?: string;
      our_message?: string;
      test?: boolean;
      source?: "chat" | "copilot" | "agency_support";
      owner_email?: string;
      client_email?: string;
    };


    // Test mode: fire a synthetic payload straight to the webhook
    if (isTest) {
      const payload = {
        test: true,
        source: source ?? "chat",
        customer_email: "test-customer@example.com",
        agency_owner_email: "test-owner@example.com",
        agency_id: agency_id ?? "TEST_AGENCY",
        their_last_message:
          "Hi there — I'm having trouble with the login page, it keeps redirecting me.",
        our_message:
          "Thanks for reaching out! I've reset your session — please try logging in again and let me know if it works.",
        conversation_summary_week:
          "In the past week the customer reported a login redirect loop. Team member reset the session and asked them to retry.",
        conversation_summary_all_time:
          "Customer has contacted support several times over the account's lifetime, most recently about a login redirect loop that the team just addressed by resetting the session.",
        account_name: "Test Agency",
        account_owner_name: "Test Owner",
        account_owner_email: "test-owner@example.com",
        account_owner_phone: null,
        account_agency_id: agency_id ?? "TEST_AGENCY",
        assigned_to_name: "Test Assignee",
        assigned_to_email: "test-assignee@example.com",
        assigned_to_phone: null,
        responder_name: "Test Responder",
        responder_email: "test-responder@example.com",
        responder_phone: null,
        timestamp: new Date().toISOString(),
      };
      const res = await timedFetch(WEBHOOK_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }, WEBHOOK_TIMEOUT_MS);
      return new Response(
        JSON.stringify({ ok: true, test: true, status: res.status, payload }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // ============ CoPilot source: agency owner talking to admin via CoPilot ============
    if (source === "copilot") {
      if (!owner_email || !our_message) {
        return new Response(
          JSON.stringify({ error: "owner_email and our_message required for copilot source" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      if (!isEmail(owner_email)) {
        return new Response(
          JSON.stringify({ ok: true, skipped: "owner_email not an email" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      const ownerEmail = owner_email.trim().toLowerCase();

      const supabase = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      );

      if (await shouldThrottle(supabase, "copilot", null, ownerEmail)) {
        return new Response(
          JSON.stringify({ ok: true, skipped: `throttled (< ${THROTTLE_HOURS}h since last send)` }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      const { data: msgs } = await supabase
        .from("copilot_chat_messages")
        .select("role, content, actions, created_at")
        .eq("owner_email", ownerEmail)
        .order("created_at", { ascending: true })
        .limit(400);

      type CM = { who: "owner" | "ai" | "team"; content: string; created_at: string };
      const combined: CM[] = (msgs ?? []).map((m: any) => {
        const isAdmin = Array.isArray(m.actions) && m.actions.some((a: any) => a?.tool === "admin_reply");
        const who: CM["who"] =
          m.role === "user" ? "owner" : isAdmin ? "team" : "ai";
        return { who, content: m.content ?? "", created_at: m.created_at };
      });

      const theirLast = [...combined].reverse().find((m) => m.who === "owner");

      let summaryWeek = "";
      let summaryAllTime = "";
      const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
      if (LOVABLE_API_KEY && combined.length > 0) {
        const toTranscript = (arr: CM[]) =>
          arr
            .map(
              (m) =>
                `${m.who === "owner" ? "Agency Owner" : m.who === "team" ? "Team" : "AI"}: ${m.content}`,
            )
            .join("\n");

        const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
        const weekMsgs = combined.filter(
          (m) => new Date(m.created_at).getTime() >= weekAgo,
        );

        const summarize = async (label: string, arr: CM[]) => {
          if (arr.length === 0) return "";
          try {
            const transcript = toTranscript(arr.slice(-80));
            const res = await timedFetch(
              "https://ai.gateway.lovable.dev/v1/chat/completions",
              {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  Authorization: `Bearer ${LOVABLE_API_KEY}`,
                },
                body: JSON.stringify({
                  model: "google/gemini-2.5-flash",
                  messages: [
                    {
                      role: "system",
                      content:
                        "You summarize a support conversation in 2-3 short sentences. This is the SaaSSuite AGENCY OWNER talking to the SaaSSuite support team via the AI CoPilot. Always begin with: 'Agency owner support request via AI CoPilot.' Then focus on what the owner needs and what has been done. No preamble beyond that opener.",
                    },
                    {
                      role: "user",
                      content: `Scope: ${label}. Latest team reply just sent: "${our_message}"\n\nTranscript:\n${transcript}`,
                    },
                  ],
                }),
              },
              AI_TIMEOUT_MS,
            );
            if (res.ok) {
              const j = await res.json();
              return j?.choices?.[0]?.message?.content?.trim() ?? "";
            }
            console.error(`CoPilot summary (${label}) failed:`, res.status, await res.text());
            return "";
          } catch (e) {
            console.error(`CoPilot summary (${label}) error:`, e);
            return "";
          }
        };

        [summaryWeek, summaryAllTime] = await Promise.all([
          summarize("last 7 days", weekMsgs),
          summarize("all time", combined),
        ]);
      }

      const payload = {
        source: "copilot",
        customer_email: ownerEmail,
        agency_owner_email: ownerEmail,
        agency_id: null,
        their_last_message: theirLast?.content ?? null,
        our_message,
        conversation_summary_week: summaryWeek,
        conversation_summary_all_time: summaryAllTime,
        timestamp: new Date().toISOString(),
      };

      const res = await timedFetch(WEBHOOK_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }, WEBHOOK_TIMEOUT_MS);

      return new Response(
        JSON.stringify({ ok: true, dispatched: true, source: "copilot", status: res.status }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // ====== Agency Support source: our support rep replying to an agency-support client ======
    if (source === "agency_support") {
      const clientEmail = (client_email || user_identifier || "").trim().toLowerCase();
      if (!clientEmail || !our_message) {
        return new Response(
          JSON.stringify({ error: "client_email and our_message required for agency_support" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      if (!isEmail(clientEmail)) {
        return new Response(
          JSON.stringify({ ok: true, skipped: "client_email is not an email" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      const supabase = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      );

      const { data: history } = await supabase
        .from("agency_support_messages")
        .select("body, sender_role, sender_name, created_at, agency_id")
        .ilike("client_email", clientEmail)
        .order("created_at", { ascending: true })
        .limit(200);

      const rows = history ?? [];
      const theirLast = [...rows].reverse().find((m: any) => m.sender_role === "client");
      const agencyId = agency_id ?? (rows[rows.length - 1] as any)?.agency_id ?? null;

      const { data: seat } = await supabase
        .from("agency_support_clients")
        .select("owner_email, client_name")
        .ilike("client_email", clientEmail)
        .maybeSingle();

      // Best-effort AI summaries so the email automation has context.
      let summaryWeek = "";
      let summaryAllTime = "";
      const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
      if (LOVABLE_API_KEY && rows.length > 0) {
        const toTranscript = (arr: any[]) =>
          arr
            .map((m) => `${m.sender_role === "client" ? "Customer" : "Support"}: ${m.body ?? ""}`)
            .join("\n");
        const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
        const weekMsgs = rows.filter(
          (m: any) => new Date(m.created_at).getTime() >= weekAgo,
        );
        const summarize = async (label: string, arr: any[]) => {
          if (arr.length === 0) return "";
          try {
            const res = await timedFetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${LOVABLE_API_KEY}`,
              },
              body: JSON.stringify({
                model: "google/gemini-2.5-flash",
                messages: [
                  {
                    role: "system",
                    content:
                      "You summarize a support conversation in 2-3 short sentences. This is an agency-support client talking to the SaaSSuite support team. Focus on what they need and what has been done. No preamble.",
                  },
                  {
                    role: "user",
                    content: `Scope: ${label}. Latest support reply just sent: "${our_message}"\n\nTranscript:\n${toTranscript(arr.slice(-80))}`,
                  },
                ],
              }),
            }, AI_TIMEOUT_MS);
            if (res.ok) {
              const j = await res.json();
              return j?.choices?.[0]?.message?.content?.trim() ?? "";
            }
            console.error(`Agency-support summary (${label}) failed:`, res.status);
            return "";
          } catch (e) {
            console.error(`Agency-support summary (${label}) error:`, e);
            return "";
          }
        };
        [summaryWeek, summaryAllTime] = await Promise.all([
          summarize("last 7 days", weekMsgs),
          summarize("all time", rows),
        ]);
      }

      let extra: Record<string, unknown> = {};
      if (agencyId) {
        try {
          extra = await supportExtraFields(supabase, agencyId, {
            userIdentifier: clientEmail,
          });
        } catch (e) {
          console.error("support extra fields failed:", e);
        }
      }

      const payload = {
        source: "agency_support",
        customer_email: clientEmail,
        customer_name: (theirLast as any)?.sender_name || seat?.client_name || null,
        agency_owner_email: seat?.owner_email ?? null,
        agency_id: agencyId,
        their_last_message: (theirLast as any)?.body ?? null,
        our_message,
        conversation_summary_week: summaryWeek,
        conversation_summary_all_time: summaryAllTime,
        timestamp: new Date().toISOString(),
        ...extra,
      };

      const res = await timedFetch(WEBHOOK_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }, WEBHOOK_TIMEOUT_MS);

      return new Response(
        JSON.stringify({ ok: true, dispatched: true, source: "agency_support", status: res.status }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }



    if (!agency_id || !user_identifier || !our_message) {
      return new Response(
        JSON.stringify({ error: "agency_id, user_identifier and our_message required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Skip if customer isn't identified by email
    if (!isEmail(user_identifier)) {
      return new Response(
        JSON.stringify({ ok: true, skipped: "user_identifier is not an email" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    const customerEmail = user_identifier.trim().toLowerCase();

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const cleanAgencyId = agency_id.replace(/NO$/i, "");

    if (await shouldThrottle(supabase, "chat", cleanAgencyId, customerEmail)) {
      return new Response(
        JSON.stringify({ ok: true, skipped: `throttled (< ${THROTTLE_HOURS}h since last send)` }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Look up agency owner email
    const { data: owner } = await supabase
      .from("saas_suite_users")
      .select("email, customer_updates_webhook_url")
      .or(
        `agency_id.eq.${cleanAgencyId},agency_id_basic.eq.${cleanAgencyId},agency_id_advanced.eq.${cleanAgencyId},agency_id_elite.eq.${cleanAgencyId}`,
      )
      .limit(1)
      .maybeSingle();

    const agencyOwnerEmail = owner?.email ?? null;
    const customUrl = String((owner as any)?.customer_updates_webhook_url || "").trim();
    const targetUrl = /^https:\/\//i.test(customUrl) ? customUrl : WEBHOOK_URL;

    // Pull conversation history
    const [aiRes, ownerRes] = await Promise.all([
      supabase
        .from("ai_chat_messages")
        .select("content, role, created_at")
        .eq("agency_id", cleanAgencyId)
        .ilike("user_identifier", customerEmail)
        .order("created_at", { ascending: true })
        .limit(200),
      supabase
        .from("agency_owner_messages")
        .select("content, sender_type, created_at")
        .eq("agency_id", cleanAgencyId)
        .ilike("user_identifier", customerEmail)
        .order("created_at", { ascending: true })
        .limit(200),
    ]);

    type M = { who: "customer" | "ai" | "team"; content: string; created_at: string };
    const combined: M[] = [
      ...(aiRes.data ?? []).map((m) => ({
        who: (m.role === "user" ? "customer" : "ai") as M["who"],
        content: m.content ?? "",
        created_at: m.created_at,
      })),
      ...(ownerRes.data ?? []).map((m) => ({
        who: "team" as M["who"],
        content: m.content ?? "",
        created_at: m.created_at,
      })),
    ].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

    // Their last message = last message from the customer
    const theirLast = [...combined].reverse().find((m) => m.who === "customer");

    // Summarize with Lovable AI (best-effort) — one for last 7 days, one for all time
    let summaryWeek = "";
    let summaryAllTime = "";
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (LOVABLE_API_KEY && combined.length > 0) {
      const toTranscript = (msgs: M[]) =>
        msgs
          .map(
            (m) =>
              `${m.who === "customer" ? "Customer" : m.who === "team" ? "Team" : "AI"}: ${m.content}`,
          )
          .join("\n");

      const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
      const weekMsgs = combined.filter(
        (m) => new Date(m.created_at).getTime() >= weekAgo,
      );

      const summarize = async (label: string, msgs: M[]) => {
        if (msgs.length === 0) return "";
        try {
          const transcript = toTranscript(msgs.slice(-80));
          const res = await timedFetch(
            "https://ai.gateway.lovable.dev/v1/chat/completions",
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${LOVABLE_API_KEY}`,
              },
              body: JSON.stringify({
                model: "google/gemini-2.5-flash",
                messages: [
                  {
                    role: "system",
                    content:
                      "You summarize a customer support conversation in 2-3 short sentences. Focus on the customer's issue(s) and what has been done so far. No preamble.",
                  },
                  {
                    role: "user",
                    content:
                      `Scope: ${label}. Latest team reply just sent: "${our_message}"\n\nTranscript:\n${transcript}`,
                  },
                ],
              }),
            },
            AI_TIMEOUT_MS,
          );
          if (res.ok) {
            const j = await res.json();
            return j?.choices?.[0]?.message?.content?.trim() ?? "";
          }
          console.error(`AI summary (${label}) failed:`, res.status, await res.text());
          return "";
        } catch (e) {
          console.error(`AI summary (${label}) error:`, e);
          return "";
        }
      };

      [summaryWeek, summaryAllTime] = await Promise.all([
        summarize("last 7 days", weekMsgs),
        summarize("all time", combined),
      ]);
    }

    let extra: Record<string, unknown> = {};
    try {
      extra = await supportExtraFields(supabase, cleanAgencyId, {
        userIdentifier: customerEmail,
        responderEmail: typeof body?.responder_email === "string" ? body.responder_email : null,
      });
    } catch (e) {
      console.error("support extra fields failed:", e);
    }

    const payload = {
      customer_email: customerEmail,
      agency_owner_email: agencyOwnerEmail,
      agency_id: cleanAgencyId,
      their_last_message: theirLast?.content ?? null,
      our_message,
      conversation_summary_week: summaryWeek,
      conversation_summary_all_time: summaryAllTime,
      timestamp: new Date().toISOString(),
      ...extra,
    };

    const res = await timedFetch(targetUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }, WEBHOOK_TIMEOUT_MS);

    return new Response(
      JSON.stringify({ ok: true, dispatched: true, status: res.status }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("notify-team-reply error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});

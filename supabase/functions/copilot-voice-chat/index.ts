import { corsHeaders, json, requireAuthedUser, serviceClient } from "../_shared/user-auth.ts";

const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;
const MODEL = "google/gemini-2.5-flash";

const tools = [
  {
    type: "function",
    function: {
      name: "lookup_user",
      description: "Look up one of the agency's end-users (Client Hub users) by name or email fragment.",
      parameters: {
        type: "object",
        properties: { query: { type: "string" } },
        required: ["query"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "account_health_summary",
      description: "Return real end-user counts and recent login/session activity across the caller's agency.",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function",
    function: {
      name: "list_workflows",
      description: "List the caller's configured workflow automations and their enabled state.",
      parameters: { type: "object", properties: {} },
    },
  },
];

async function agencyIdsFor(email: string): Promise<string[]> {
  const sb = serviceClient();
  const { data } = await sb.from("saas_suite_users")
    .select("agency_id, agency_id_basic, agency_id_advanced, agency_id_elite")
    .ilike("email", email).maybeSingle();
  return [data?.agency_id, data?.agency_id_basic, data?.agency_id_advanced, data?.agency_id_elite]
    .filter(Boolean) as string[];
}

async function runTool(name: string, args: any, callerEmail: string) {
  const sb = serviceClient();
  const agencyIds = await agencyIdsFor(callerEmail);
  if (agencyIds.length === 0) return { error: "No agency for this account" };

  switch (name) {
    case "lookup_user": {
      const q = String(args?.query ?? "").trim();
      if (!q) return { error: "query required" };
      const { data } = await sb.from("user_progress")
        .select("name, email, agency_id, last_accessed, created_at")
        .in("agency_id", agencyIds)
        .or(`name.ilike.%${q}%,email.ilike.%${q}%`)
        .order("last_accessed", { ascending: false, nullsFirst: false })
        .limit(5);
      return { matches: data ?? [] };
    }
    case "account_health_summary": {
      const now = Date.now();
      const iso7 = new Date(now - 7 * 86400000).toISOString();
      const iso30 = new Date(now - 30 * 86400000).toISOString();
      const { data: agencyUsers } = await sb
        .from("user_progress")
          .select("email, last_accessed, created_at")
        .in("agency_id", agencyIds);
      const emails = (agencyUsers ?? [])
        .map((u: any) => String(u.email || "").toLowerCase())
        .filter(Boolean);
      const total = agencyUsers?.length ?? 0;
      const activeUsers7d = (agencyUsers ?? []).filter((u: any) => u.last_accessed && u.last_accessed >= iso7).length;
      const activeUsers30d = (agencyUsers ?? []).filter((u: any) => u.last_accessed && u.last_accessed >= iso30).length;
      const new_users_7d = (agencyUsers ?? []).filter((u: any) => u.created_at && u.created_at >= iso7).length;
      let distinctUsersWithSessions7d = 0;
      if (emails.length > 0) {
        const { data: sess } = await sb
          .from("user_activity_sessions")
          .select("user_email")
          .in("user_email", emails)
          .gte("session_started_at", iso7);
        distinctUsersWithSessions7d = new Set((sess ?? []).map((s: any) => String(s.user_email || "").toLowerCase())).size;
      }
      return {
        total_users: total,
        active_users_7d: activeUsers7d,
        active_users_30d: activeUsers30d,
        distinct_users_with_sessions_7d: distinctUsersWithSessions7d,
        new_users_7d,
      };
    }
    case "list_workflows": {
      const { data } = await sb.from("workflows")
        .select("trigger_type, enabled, webhook_url, agency_id")
        .in("agency_id", agencyIds);
      return { workflows: (data ?? []).map((w) => ({
        trigger_type: w.trigger_type,
        enabled: w.enabled,
        configured: !!w.webhook_url,
      })) };
    }
    default:
      return { error: `Unknown tool ${name}` };
  }
}

const SYSTEM = `You are the SaaSSuite CoPilot in voice mode, talking directly to the agency owner.

## Never invent URLs or plan names
- The app is always \`saassuite.ai/app/<section>\` — there is NO \`app.saassuite.ai\` subdomain. Billing is at saassuite.ai/app/billing (Settings > Billing), or at saassuite.ai/pricing.
- The client-facing hub link is \`yoursoftwareonboarding.com/v2/<agency-id>\` (or their custom domain).
- Real plans: Starter (free), Basic ($27/mo), Advanced ($97/mo), plus Agency Support at $49/month per client account, plus add-ons (Email Warmup, Custom Domain $49/mo Advanced-only, Branded AI Support $99/mo). Nothing else exists — no $497, $297, $197, "Scale", "Elite", "Pro", or "Enterprise" plan. Plan 1/2/3 are the owner's own hub slots, not subscription tiers.
- Upgrades to their own account: tell them to ask in text chat so the CoPilot can generate a real Stripe link (charged immediately, prorated). Never read out a billing URL. Agency Support is booked at saassuite.ai/book.
- Affiliate links: all of founder Andrew George's affiliate links are at gofreesaas.com (HighLevel trials, new accounts, upgrades). HighLevel upgrades specifically go through the affiliate upgrade offer link — tell them to exit voice mode so it can be pasted in chat. HighLevel tiers are never SaaSSuite plans, and trials only apply to brand-new HighLevel accounts, never to upgrades.
- If a link isn't one of the above, don't give a link; describe where to click instead.

How to answer — STRICT:
- Skip filler and empathy. No "I hear you", "great question", "sometimes a blank slate…", "let's take a look".
- Lead with a concrete fact from a tool call, then the recommendation, then a one-line next step.
- On ANY "what should I do / set up / focus on / help me get started" style question, you MUST first call account_health_summary AND list_workflows (in parallel) before replying. Never answer such questions from memory.
- On any question about a specific person, first call lookup_user.
- There is no end-user approval workflow in SaaSSuite. Never mention "approved", "not approved", or "pending approval" for end users.
- Do not mention users without recorded login unless the user explicitly asks about inactive users.
- Voice and text are the same conversation. Use the full message history you receive; do not restart, repeat the opener, or ignore prior replies.
- If you need an exact pasted value — webhook URL, color code, embed code, page URL, or longer text — tell the user to exit voice mode and paste it in chat. Do not try to capture long URLs or hex values by voice.
- If the caller is on mobile and the next step involves Workflows, HighLevel setup, branding/customization, installation code, or copying/pasting values, say it is easier to complete on desktop before offering the next step.
- Reply in 2 short sentences max. Speak numbers naturally, never read JSON.
- End with one direct offer, e.g. "Want me to open Workflows?" — not a soft "want to see those?".
- If you truly can't help, say so plainly and offer to send it to the SaaSSuite team as a support ticket.

Recommendation style:
"You have <N> users and <M> logged in this week. Your biggest win right now is <specific thing based on data>. Want me to open <page>?"

Available workflow triggers you can mention: new-user signup, returning-user login, support-ticket submitted, onboarding-complete. Nudge the user toward whichever triggers they haven't configured yet (from list_workflows).

Branding not applying — STRICT:
- The white-label install lives at the AGENCY level: Settings, then Company, then White Label. The stylesheet link goes in the Custom CSS box and the script goes in the Custom JS box. Never say Business Profile, and never say CSS is included in the JS link.
- If branding changes aren't showing, assume the White Label code isn't saved correctly. Do not blame browser cache, do not walk through keyboard shortcuts, and do not offer to write more CSS in voice mode.
- After one failed check, offer to send it to the team as a support ticket instead of troubleshooting further.`;


const WORKFLOW_GUIDANCE = `

## Workflows — STRICT
Workflows in SaaSSuite are NOT named and have NO custom steps. Each workflow is a fixed trigger (new-user signup, returning-user login, support-ticket submitted, onboarding-complete) that fires an inbound webhook into HighLevel. Never ask the user to name a workflow, describe steps, or pick actions here.

When the user wants to set up a workflow:
1. Ask which trigger they want (if not already clear).
2. Tell them: in HighLevel, create an Automation with an Inbound Webhook trigger, copy the URL (services.leadconnectorhq.com), then exit voice mode and paste it into chat so it saves cleanly.
3. Remind them all email, SMS, and other actions are configured inside that HighLevel automation — SaaSSuite just fires the webhook.
`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const gate = await requireAuthedUser(req);
  if (!gate.ok) return gate.res;

  try {
    const { messages, client } = await req.json();
    if (!Array.isArray(messages)) return json({ error: "messages required" }, 400);

    const sb = serviceClient();
    const lastMsg = messages[messages.length - 1];
    if (lastMsg?.role === "user" && typeof lastMsg.content === "string" && lastMsg.content.trim()) {
      const { error } = await sb.from("copilot_chat_messages").insert({
        owner_email: gate.email,
        role: "user",
        content: lastMsg.content.trim(),
      });
      if (error) console.error("Failed to persist voice user message", error);
    }

    const isMobile = client?.isMobile === true || Number(client?.width ?? 1024) < 768;
    const deviceContext = `\n\nCaller device: ${isMobile ? "mobile phone/tablet" : "desktop/laptop"}. ${isMobile ? "When setup requires copying/pasting, HighLevel workflows, installation, branding/customization, or detailed navigation, tell them this is easier on desktop." : "You may guide them through desktop setup steps directly."}`;
    const convo: any[] = [{ role: "system", content: SYSTEM + WORKFLOW_GUIDANCE + deviceContext }, ...messages];

    for (let round = 0; round < 4; round++) {
      const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({ model: MODEL, messages: convo, tools, tool_choice: "auto" }),
      });
      if (!resp.ok) {
        const text = await resp.text();
        console.error("Gateway error", resp.status, text);
        return json({ error: `AI gateway ${resp.status}`, details: text }, resp.status === 402 || resp.status === 429 ? resp.status : 502);
      }
      const data = await resp.json();
      const msg = data.choices?.[0]?.message;
      if (!msg) return json({ error: "empty response" }, 502);

      const calls = msg.tool_calls;
      if (calls && calls.length > 0) {
        convo.push(msg);
        for (const c of calls) {
          let a = {};
          try { a = JSON.parse(c.function.arguments || "{}"); } catch {}
          const result = await runTool(c.function.name, a, gate.email);
          convo.push({ role: "tool", tool_call_id: c.id, content: JSON.stringify(result) });
        }
        continue;
      }

      const finalText = msg.content ?? "";
      const { error } = await sb.from("copilot_chat_messages").insert({
        owner_email: gate.email,
        role: "assistant",
        content: finalText,
      });
      if (error) console.error("Failed to persist voice assistant message", error);
      return json({ text: finalText });
    }
    return json({ text: "I got stuck — try asking again." });
  } catch (e) {
    console.error(e);
    return json({ error: String(e) }, 500);
  }
});
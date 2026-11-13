// Slack slash-command handler for SaaSSuite internal Slack app.
// Verifies Slack signature, ACKs within 3s, does DB work, POSTs to response_url.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { getInstallByTeam } from "../_shared/slack-workspace.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-slack-signature, x-slack-request-timestamp",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const SIGNING_SECRET = Deno.env.get("SLACK_SIGNING_SECRET") ?? "";

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);

async function verifySlack(req: Request, rawBody: string): Promise<boolean> {
  if (!SIGNING_SECRET) {
    console.error("SLACK_SIGNING_SECRET not configured");
    return false;
  }
  const ts = req.headers.get("x-slack-request-timestamp");
  const sig = req.headers.get("x-slack-signature");
  if (!ts || !sig) return false;
  const nowSec = Math.floor(Date.now() / 1000);
  if (Math.abs(nowSec - Number(ts)) > 60 * 5) return false;

  const base = `v0:${ts}:${rawBody}`;
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(SIGNING_SECRET),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const macBuf = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(base));
  const hex = Array.from(new Uint8Array(macBuf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  const expected = `v0=${hex}`;
  if (expected.length !== sig.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ sig.charCodeAt(i);
  return diff === 0;
}

const isEmail = (s: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s.trim());

// A "user" from Slack's POV is an end customer of the agency — they live in
// support_tickets / chat_threads / ai_chat_messages, keyed by email. They are
// NOT rows in saas_suite_users (that table holds the agency owners themselves).
type AgencyUser = {
  email: string;
  full_name: string | null;
  last_activity_at: string | null;
};

async function sha256Hex(input: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

type WorkspaceLink = {
  agency_id: string;
  agency_ids: string[];
  team_name: string | null;
  linked_by_email: string;
};

async function getWorkspaceLink(teamId: string): Promise<WorkspaceLink | null> {
  if (!teamId) return null;
  // Distributed OAuth install is the source of truth. If a team has an active
  // install in slack_channel_agency_map, resolve the agency from there.
  const install = await getInstallByTeam(teamId);
  if (install) {
    const clean = install.agency_id.replace(/NO$/i, "");
    return {
      agency_id: clean,
      agency_ids: [clean],
      team_name: install.team_domain,
      linked_by_email: "",
    };
  }
  // Legacy token-based link fallback.
  const { data } = await supabase
    .from("slack_workspace_links")
    .select("agency_id, agency_ids, team_name, linked_by_email")
    .eq("team_id", teamId)
    .maybeSingle();
  if (!data) return null;
  {
    supabase
      .from("slack_workspace_links")
      .update({ last_used_at: new Date().toISOString() })
      .eq("team_id", teamId)
      .then(() => {}, () => {});
  }
  const ids: string[] = Array.isArray((data as any).agency_ids) && (data as any).agency_ids.length
    ? (data as any).agency_ids
    : [(data as any).agency_id];
  const normalized = Array.from(new Set(ids.filter(Boolean).map((x: string) => x.replace(/NO$/i, ""))));
  return {
    agency_id: (data as any).agency_id,
    agency_ids: normalized,
    team_name: (data as any).team_name ?? null,
    linked_by_email: (data as any).linked_by_email,
  };
}

const CONNECT_URL = "https://saassuite.ai/slack-integration";

function notLinkedBlocks(teamName: string | null) {
  return {
    response_type: "ephemeral",
    blocks: [
      headerBlock("Slack workspace not linked"),
      sectionBlock(
        `This Slack workspace${teamName ? ` (*${teamName}*)` : ""} isn't connected to a SaaSSuite agency yet.\n\n` +
          `*How to connect:*\n` +
          `1. Click *Open SaaSSuite* below (opens the token page).\n` +
          `2. Click *Generate Link Token* and copy the token.\n` +
          `3. Back in Slack, run \`/connect <your-token>\`.\n\n` +
          `Only the agency owner can generate tokens.`,
      ),
      {
        type: "actions",
        elements: [
          {
            type: "button",
            text: { type: "plain_text", text: "Open SaaSSuite → Generate Token", emoji: true },
            url: CONNECT_URL,
            style: "primary",
          },
        ],
      },
    ],
  };
}

// Look up an end customer of the agency by email or (best-effort) name.
// We search agency-scoped tables that actually hold end customers.
async function findAgencyUser(query: string, agencyIds: string[]): Promise<AgencyUser | null> {
  const q = query.trim();
  if (!q || agencyIds.length === 0) return null;

  // 1) Email match (most reliable).
  if (isEmail(q)) {
    const email = q.toLowerCase();
    const [t, ai, own] = await Promise.all([
      supabase.from("support_tickets")
        .select("customer_email, customer_name, updated_at")
        .in("agency_id", agencyIds).ilike("customer_email", email)
        .order("updated_at", { ascending: false }).limit(1),
      supabase.from("ai_chat_messages")
        .select("user_identifier, created_at")
        .in("agency_id", agencyIds).ilike("user_identifier", email)
        .order("created_at", { ascending: false }).limit(1),
      supabase.from("agency_owner_messages")
        .select("user_identifier, created_at")
        .in("agency_id", agencyIds).ilike("user_identifier", email)
        .order("created_at", { ascending: false }).limit(1),
    ]);
    const ticket = t.data?.[0];
    const aiMsg = ai.data?.[0];
    const ownMsg = own.data?.[0];
    const ts = [ticket?.updated_at, aiMsg?.created_at, ownMsg?.created_at]
      .filter(Boolean).sort((a: string, b: string) => new Date(b).getTime() - new Date(a).getTime())[0] ?? null;
    if (ticket || aiMsg || ownMsg) {
      return { email, full_name: ticket?.customer_name ?? null, last_activity_at: ts };
    }
    return null;
  }

  // 2) Name match against support tickets (only place a customer_name is stored).
  const { data: tickets } = await supabase
    .from("support_tickets")
    .select("customer_email, customer_name, updated_at")
    .in("agency_id", agencyIds)
    .ilike("customer_name", `%${q}%`)
    .order("updated_at", { ascending: false })
    .limit(1);
  const row = tickets?.[0];
  if (row?.customer_email) {
    return {
      email: row.customer_email.toLowerCase(),
      full_name: row.customer_name ?? null,
      last_activity_at: row.updated_at ?? null,
    };
  }
  return null;
}

async function getAuthUserIdByEmail(email: string): Promise<string | null> {
  try {
    const res = await fetch(
      `${SUPABASE_URL}/auth/v1/admin/users?email=${encodeURIComponent(email)}`,
      { headers: { apikey: SERVICE_ROLE, Authorization: `Bearer ${SERVICE_ROLE}` } },
    );
    if (!res.ok) return null;
    const j = await res.json();
    const users = Array.isArray(j?.users) ? j.users : [];
    const match = users.find((u: any) => (u?.email ?? "").toLowerCase() === email.toLowerCase());
    return match?.id ?? null;
  } catch {
    return null;
  }
}

const sectionBlock = (text: string) => ({ type: "section", text: { type: "mrkdwn", text } });
const headerBlock = (text: string) => ({ type: "header", text: { type: "plain_text", text, emoji: true } });
const dividerBlock = () => ({ type: "divider" });

function extractCopilotReply(data: any): string {
  const candidates = [
    data?.content,
    data?.choices?.[0]?.message?.content,
    data?.message?.content,
    data?.reply,
    typeof data === "string" ? data : "",
  ];
  for (const value of candidates) {
    if (typeof value === "string" && value.trim()) return value.trim();
    if (Array.isArray(value)) {
      const text = value
        .map((part) => typeof part === "string" ? part : (part?.text ?? ""))
        .filter(Boolean)
        .join("\n")
        .trim();
      if (text) return text;
    }
  }
  return "";
}

async function postResponse(url: string, payload: unknown) {
  try {
    await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  } catch (e) {
    console.error("response_url post failed:", e);
  }
}

const notFound = (what: string, q: string) => ({
  response_type: "ephemeral",
  blocks: [sectionBlock(`:mag: No ${what} found for *${q}* in your agency.`)],
});

const missingInput = (cmd: string) => ({
  response_type: "ephemeral",
  blocks: [sectionBlock(`:warning: Please include a name or email. Example: \`${cmd} jane@example.com\``)],
});

async function cmdLink(token: string, teamId: string, teamName: string | null) {
  const trimmed = token.trim();
  if (!trimmed) {
    return {
      response_type: "ephemeral",
      blocks: [
        sectionBlock(
          ":link: *Connect this Slack workspace to SaaSSuite*\n\n" +
            "Click the button below to open SaaSSuite and generate a one-time link token, then run:\n" +
            "`/connect <your-token>`",
        ),
        {
          type: "actions",
          elements: [
            {
              type: "button",
              text: { type: "plain_text", text: "Open SaaSSuite → Generate Token", emoji: true },
              url: CONNECT_URL,
              style: "primary",
            },
          ],
        },
      ],
    };
  }
  if (!teamId) {
    return { response_type: "ephemeral", blocks: [sectionBlock(":x: Slack didn't send a team_id — cannot link.")] };
  }
  const tokenHash = await sha256Hex(trimmed);
  const { data: tokenRow } = await supabase
    .from("slack_link_tokens")
    .select("id, agency_id, agency_ids, email, expires_at, used_at")
    .eq("token_hash", tokenHash)
    .maybeSingle();
  if (!tokenRow) {
    return { response_type: "ephemeral", blocks: [sectionBlock(`:x: Invalid link token. Generate a fresh one at ${CONNECT_URL}`)] };
  }
  if (tokenRow.used_at) {
    return { response_type: "ephemeral", blocks: [sectionBlock(":x: This link token has already been used. Generate a new one to re-link.")] };
  }
  if (new Date(tokenRow.expires_at).getTime() < Date.now()) {
    return { response_type: "ephemeral", blocks: [sectionBlock(":x: This link token has expired. Generate a new one.")] };
  }
  const { error: upsertErr } = await supabase
    .from("slack_workspace_links")
    .upsert(
      {
        team_id: teamId,
        team_name: teamName,
        agency_id: tokenRow.agency_id,
        agency_ids: (tokenRow as any).agency_ids?.length ? (tokenRow as any).agency_ids : [tokenRow.agency_id],
        linked_by_email: tokenRow.email,
        last_used_at: new Date().toISOString(),
      },
      { onConflict: "team_id" },
    );
  if (upsertErr) {
    console.error("workspace link upsert failed:", upsertErr);
    return { response_type: "ephemeral", blocks: [sectionBlock(`:x: Failed to link workspace: ${upsertErr.message}`)] };
  }
  await supabase
    .from("slack_link_tokens")
    .update({ used_at: new Date().toISOString(), used_by_team_id: teamId })
    .eq("id", tokenRow.id);
  return {
    response_type: "ephemeral",
    blocks: [
      headerBlock("✅ Slack workspace linked!"),
      sectionBlock(
        `Linked *${teamName ?? teamId}* to agency \`${tokenRow.agency_id}\` (owner: ${tokenRow.email}).\n\n` +
          `You can now run \`/support-status\`, \`/user-info\`, \`/ticket-status\`, and \`/report\` — all scoped to your agency.`,
      ),
    ],
  };
}

async function cmdSupportStatus(text: string, agencyIds: string[]) {
  if (!text.trim()) return missingInput("/support-status");
  const user = await findAgencyUser(text, agencyIds);
  if (!user?.email) return notFound("user", text);
  const email = user.email.toLowerCase();

  const [aiRes, ownerRes] = await Promise.all([
    supabase
      .from("ai_chat_messages")
      .select("role, content, created_at")
      .in("agency_id", agencyIds)
      .ilike("user_identifier", email)
      .order("created_at", { ascending: false })
      .limit(20),
    supabase
      .from("agency_owner_messages")
      .select("sender_type, content, created_at")
      .in("agency_id", agencyIds)
      .ilike("user_identifier", email)
      .order("created_at", { ascending: false })
      .limit(20),
  ]);

  type M = { who: string; content: string; created_at: string };
  const msgs: M[] = [
    ...(aiRes.data ?? []).map((m: any) => ({
      who: m.role === "user" ? "Customer" : "AI",
      content: m.content ?? "",
      created_at: m.created_at,
    })),
    ...(ownerRes.data ?? []).map((m: any) => ({
      who: "Team (human)",
      content: m.content ?? "",
      created_at: m.created_at,
    })),
  ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  if (msgs.length === 0) {
    return {
      response_type: "ephemeral",
      blocks: [
        headerBlock(`Support status: ${user.full_name ?? email}`),
        sectionBlock(`No support conversations on record for *${email}*.`),
      ],
    };
  }

  let handoverLine = ":robot_face: Handled by *AI* (no human handover)";
  if (agencyIds.length) {
    const { data: threads } = await supabase
      .from("chat_threads")
      .select("handover_requested_at, handover_resolved_at")
      .ilike("user_identifier", email)
      .in("agency_id", agencyIds)
      .order("last_user_message_at", { ascending: false })
      .limit(5);
    const active = (threads ?? []).find((t: any) => t.handover_requested_at && !t.handover_resolved_at);
    const any = (threads ?? []).some((t: any) => t.handover_requested_at);
    if (active) {
      handoverLine = `:rotating_light: *Escalated to human* since ${new Date(active.handover_requested_at).toLocaleString()}`;
    } else if (any) {
      handoverLine = `:white_check_mark: Previously escalated, now resolved. Currently handled by *AI*.`;
    }
  }

  let sentiment = "unknown";
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  if (LOVABLE_API_KEY) {
    try {
      const transcript = msgs.slice(0, 15).reverse().map((m) => `${m.who}: ${m.content}`).join("\n");
      const r = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Lovable-API-Key": LOVABLE_API_KEY },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [
            {
              role: "system",
              content:
                "Classify overall customer sentiment of this support conversation with EXACTLY one of: positive, neutral, frustrated, angry. Respond with only that single word.",
            },
            { role: "user", content: transcript },
          ],
        }),
      });
      if (r.ok) {
        const j = await r.json();
        sentiment = (j?.choices?.[0]?.message?.content ?? "unknown").toString().trim().toLowerCase().split(/\s+/)[0];
      }
    } catch (_) { /* ignore */ }
  }
  const sentimentEmoji =
    sentiment === "positive" ? ":smile:" :
    sentiment === "neutral" ? ":neutral_face:" :
    sentiment === "frustrated" ? ":confused:" :
    sentiment === "angry" ? ":rage:" : ":grey_question:";

  const recent = msgs.slice(0, 6).reverse();
  const recentText = recent.map((m) =>
    `*${m.who}* _(${new Date(m.created_at).toLocaleString()})_\n> ${m.content.replace(/\n/g, "\n> ").slice(0, 500)}`
  ).join("\n\n");

  return {
    response_type: "ephemeral",
    blocks: [
      headerBlock(`Support status: ${user.full_name ?? email}`),
      sectionBlock(`*Email:* ${email}\n${handoverLine}\n*Sentiment:* ${sentimentEmoji} ${sentiment}`),
      dividerBlock(),
      sectionBlock(`*Last ${recent.length} messages:*\n\n${recentText}`),
    ],
  };
}

async function cmdUserInfo(text: string, agencyIds: string[]) {
  if (!text.trim()) return missingInput("/user-info");
  const user = await findAgencyUser(text, agencyIds);
  if (!user?.email) return notFound("user", text);
  const email = user.email.toLowerCase();

  const [aiRes, ownerRes, ticketRes, ticketCountRes, aiCountRes] = await Promise.all([
    supabase.from("ai_chat_messages").select("created_at").in("agency_id", agencyIds).ilike("user_identifier", email).order("created_at", { ascending: false }).limit(1),
    supabase.from("agency_owner_messages").select("created_at").in("agency_id", agencyIds).ilike("user_identifier", email).order("created_at", { ascending: false }).limit(1),
    supabase.from("support_tickets").select("updated_at").in("agency_id", agencyIds).ilike("customer_email", email).order("updated_at", { ascending: false }).limit(1),
    supabase.from("support_tickets").select("*", { count: "exact", head: true }).in("agency_id", agencyIds).ilike("customer_email", email),
    supabase.from("ai_chat_messages").select("*", { count: "exact", head: true }).in("agency_id", agencyIds).ilike("user_identifier", email),
  ]);
  const candidates = [
    aiRes.data?.[0]?.created_at,
    ownerRes.data?.[0]?.created_at,
    ticketRes.data?.[0]?.updated_at,
  ].filter(Boolean) as string[];
  const lastSupport = candidates.length
    ? new Date(candidates.sort((a, b) => new Date(b).getTime() - new Date(a).getTime())[0])
    : null;

  let lastVideoLine = "—";
  let totalCompletions = 0;
  const authId = await getAuthUserIdByEmail(email);
  if (authId) {
    const { data: latest } = await supabase
      .from("module_completion")
      .select("module_id, category_id, completed_at")
      .eq("user_id", authId)
      .eq("completed", true)
      .order("completed_at", { ascending: false })
      .limit(1);
    const { count: mcCount } = await supabase
      .from("module_completion")
      .select("*", { count: "exact", head: true })
      .eq("user_id", authId)
      .eq("completed", true);
    if (mcCount != null) totalCompletions = mcCount;
    if (latest && latest[0]) {
      lastVideoLine = `\`${latest[0].category_id ?? "?"} / ${latest[0].module_id ?? "?"}\` — ${new Date(latest[0].completed_at).toLocaleString()}`;
    }
  }

  return {
    response_type: "ephemeral",
    blocks: [
      headerBlock(`User info: ${user.full_name ?? email}`),
      sectionBlock([
        `*Email:* ${email}`,
        `*Agency:* ${agencyIds.join(", ")}`,
        `*Last support engagement:* ${lastSupport ? lastSupport.toLocaleString() : "none on record"}`,
        `*Total AI messages:* ${aiCountRes.count ?? 0}`,
        `*Total tickets:* ${ticketCountRes.count ?? 0}`,
        `*Last video watched:* ${lastVideoLine}`,
        `*Total videos watched:* ${totalCompletions}`,
      ].join("\n")),
    ],
  };
}

async function cmdTicketStatus(text: string, agencyIds: string[]) {
  if (!text.trim()) return missingInput("/ticket-status");
  const user = await findAgencyUser(text, agencyIds);
  if (!user?.email) return notFound("user", text);
  const email = user.email.toLowerCase();

  const { data: tickets } = await supabase
    .from("support_tickets")
    .select("ticket_number, status, issue_category, request_text, created_at, updated_at")
    .in("agency_id", agencyIds)
    .ilike("customer_email", email)
    .order("updated_at", { ascending: false })
    .limit(3);

  if (!tickets || tickets.length === 0) {
    return {
      response_type: "ephemeral",
      blocks: [
        headerBlock(`Tickets: ${user.full_name ?? email}`),
        sectionBlock(`No tickets found for *${email}*.`),
      ],
    };
  }

  const ticketBlocks = tickets.flatMap((t: any) => [
    sectionBlock([
      `*#${t.ticket_number ?? "—"}* — _${t.issue_category ?? "general"}_`,
      `Status: *${t.status ?? "unknown"}*`,
      `Last updated: ${new Date(t.updated_at).toLocaleString()}`,
      `Created: ${new Date(t.created_at).toLocaleString()}`,
      t.request_text ? `> ${String(t.request_text).slice(0, 300).replace(/\n/g, "\n> ")}` : "",
    ].filter(Boolean).join("\n")),
    dividerBlock(),
  ]);

  return {
    response_type: "ephemeral",
    blocks: [
      headerBlock(`Tickets: ${user.full_name ?? email}`),
      sectionBlock(`Showing ${tickets.length} most recent ticket(s).`),
      dividerBlock(),
      ...ticketBlocks,
    ],
  };
}

async function cmdReport(agencyIds: string[]) {
  // Distinct end-customer emails across all agency-scoped tables.
  const [aiEmails, ownerEmails, ticketEmails, threadEmails, aiCountRes, ownerCountRes, ticketCountRes, vidCountRes, mods] = await Promise.all([
    supabase.from("ai_chat_messages").select("user_identifier").in("agency_id", agencyIds).limit(10000),
    supabase.from("agency_owner_messages").select("user_identifier").in("agency_id", agencyIds).limit(10000),
    supabase.from("support_tickets").select("customer_email").in("agency_id", agencyIds).limit(10000),
    supabase.from("chat_threads").select("user_identifier").in("agency_id", agencyIds).limit(10000),
    supabase.from("ai_chat_messages").select("*", { count: "exact", head: true }).in("agency_id", agencyIds),
    supabase.from("agency_owner_messages").select("*", { count: "exact", head: true }).in("agency_id", agencyIds),
    supabase.from("support_tickets").select("*", { count: "exact", head: true }).in("agency_id", agencyIds),
    supabase.from("custom_onboarding_videos").select("*", { count: "exact", head: true }).in("agency_id", agencyIds),
    supabase.from("module_completion").select("user_id", { count: "exact", head: true }).eq("completed", true),
  ]);
  const users = new Set<string>();
  for (const r of aiEmails.data ?? []) if (r.user_identifier) users.add(String(r.user_identifier).toLowerCase());
  for (const r of ownerEmails.data ?? []) if (r.user_identifier) users.add(String(r.user_identifier).toLowerCase());
  for (const r of ticketEmails.data ?? []) if (r.customer_email) users.add(String(r.customer_email).toLowerCase());
  for (const r of threadEmails.data ?? []) if (r.user_identifier) users.add(String(r.user_identifier).toLowerCase());

  const aiCount = aiCountRes.count ?? 0;
  const ownerCount = ownerCountRes.count ?? 0;
  const ticketCount = ticketCountRes.count ?? 0;
  const customVidCount = vidCountRes.count ?? 0;
  const totalSupport = aiCount + ownerCount + ticketCount;

  return {
    response_type: "in_channel",
    blocks: [
      headerBlock(`SaaSSuite — Agency Report`),
      sectionBlock([
        `*Agency IDs:* ${agencyIds.join(", ")}`,
        `*Total end-customers seen:* ${users.size}`,
        `*Total support engagements:* ${totalSupport}  _(AI msgs: ${aiCount}, team msgs: ${ownerCount}, tickets: ${ticketCount})_`,
        `*Total custom videos:* ${customVidCount}`,
      ].join("\n")),
      { type: "context", elements: [{ type: "mrkdwn", text: `_As of ${new Date().toLocaleString()}_` }] },
    ],
  };
}

// /copilot <message> — routes the message to this account's AI CoPilot
// (same brain that answers in the SaaSSuite dashboard). Full history is
// persisted in copilot_chat_messages keyed by the linked owner email, so
// follow-up `/copilot yes` / `/copilot do it` calls continue the thread
// with full context.
async function cmdCopilot(text: string, link: WorkspaceLink, slackUserName: string | null) {
  const q = text.trim();
  if (!q) {
    return {
      response_type: "ephemeral",
      blocks: [sectionBlock(
        ":robot_face: *AI CoPilot* — ask anything about your account.\n\n" +
        "Example: `/copilot how many open tickets do I have?`\n" +
        "Follow up with `/copilot yes` or `/copilot do that` — the conversation stays in context."
      )],
    };
  }

  const ownerEmail = link.linked_by_email;

  // Load recent history for this owner so the copilot sees the ongoing thread.
  const { data: history } = await supabase
    .from("copilot_chat_messages")
    .select("role, content, created_at")
    .eq("owner_email", ownerEmail)
    .order("created_at", { ascending: false })
    .limit(20);
  const priorMessages = (history ?? [])
    .reverse()
    .filter((m: any) => m.role === "user" || m.role === "assistant")
    .map((m: any) => ({ role: m.role, content: m.content ?? "" }));

  const slackPrefix = slackUserName ? `[via Slack, from @${slackUserName}] ` : "[via Slack] ";
  const messages = [
    ...priorMessages,
    { role: "user", content: slackPrefix + q },
  ];

  try {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/chat-copilot`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${SERVICE_ROLE}`,
        apikey: SERVICE_ROLE,
      },
      body: JSON.stringify({ messages, userEmail: ownerEmail, client: "slack" }),
    });
    if (!res.ok) {
      const txt = await res.text();
      console.error("chat-copilot failed:", res.status, txt);
      return {
        response_type: "ephemeral",
        blocks: [sectionBlock(`:x: CoPilot request failed (${res.status}). Try again in a moment.`)],
      };
    }
    const data = await res.json();
    const finalReply = extractCopilotReply(data) || "_(CoPilot returned an empty response.)_";

    return {
      response_type: "ephemeral",
      blocks: [
        sectionBlock(`:speech_balloon: *You:* ${q}`),
        sectionBlock(`:robot_face: *CoPilot:*\n${finalReply}`),
        {
          type: "context",
          elements: [{
            type: "mrkdwn",
            text: "_Reply with `/copilot <your answer>` — the conversation stays in context._",
          }],
        },
      ],
    };
  } catch (e) {
    console.error("cmdCopilot error:", e);
    return {
      response_type: "ephemeral",
      blocks: [sectionBlock(`:x: CoPilot error: ${e instanceof Error ? e.message : String(e)}`)],
    };
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405, headers: corsHeaders });
  }

  const rawBody = await req.text();
  const ok = await verifySlack(req, rawBody);
  if (!ok) {
    console.warn("Slack signature verification failed");
    return new Response("invalid signature", { status: 401, headers: corsHeaders });
  }

  const params = new URLSearchParams(rawBody);
  const command = params.get("command") ?? "";
  const text = params.get("text") ?? "";
  const responseUrl = params.get("response_url") ?? "";
  const teamId = params.get("team_id") ?? "";
  const teamName = params.get("team_domain") ?? params.get("team_name") ?? null;
  const slackUserName = params.get("user_name") ?? null;

  const work = (async () => {
    try {
      let result: unknown;
      // /connect (alias: /link) is the one command that DOESN'T require an existing binding.
      if (command === "/connect" || command === "/link") {
        result = await cmdLink(text, teamId, teamName);
      } else {
        // All other commands require the workspace to be linked to an agency.
        const link = await getWorkspaceLink(teamId);
        if (!link) {
          result = notLinkedBlocks(teamName);
        } else {
          const agencyIds = link.agency_ids.length ? link.agency_ids : [link.agency_id];
          switch (command) {
            case "/support-status": result = await cmdSupportStatus(text, agencyIds); break;
            case "/user-info":      result = await cmdUserInfo(text, agencyIds); break;
            case "/ticket-status":  result = await cmdTicketStatus(text, agencyIds); break;
            case "/report":         result = await cmdReport(agencyIds); break;
            case "/copilot":        result = await cmdCopilot(text, link, slackUserName); break;
            default:
              result = { response_type: "ephemeral", blocks: [sectionBlock(`:warning: Unknown command \`${command}\``)] };
          }
        }
      }
      if (responseUrl) await postResponse(responseUrl, result);
    } catch (e) {
      console.error("command error:", e);
      if (responseUrl) {
        await postResponse(responseUrl, {
          response_type: "ephemeral",
          blocks: [sectionBlock(`:x: Error running \`${command}\`: ${e instanceof Error ? e.message : String(e)}`)],
        });
      }
    }
  })();
  // @ts-ignore
  if (typeof EdgeRuntime !== "undefined" && (EdgeRuntime as any).waitUntil) {
    // @ts-ignore
    (EdgeRuntime as any).waitUntil(work);
  }

  return new Response(
    JSON.stringify({ response_type: "ephemeral", text: ":hourglass_flowing_sand: Looking that up…" }),
    { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { resolveName } from "../_shared/derive-name.ts";
import { hubVersionFor } from "../_shared/hub-url.ts";
import { logCustomerMessage } from "../_shared/journey-log.ts";
import {
  WELCOME_MAX_ATTEMPTS,
  isBlockedEmail,
  isWelcomeForSession,
  postJsonWebhook,
  welcomeRetryDue,
  welcomeRetryPlan,
} from "../_shared/welcome-email.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const FOLLOWUP_WEBHOOK_URL = "https://services.leadconnectorhq.com/hooks/T69cI1milcirIORef4Ib/webhook-trigger/0179d008-873e-41a3-abc6-619365dc49af";
const SUCCESS_CALL_LINK = "https://saassuite.ai/success";

// Returning-user follow-ups are capped to one per week per account.
const RETURNING_COOLDOWN_DAYS = 7;

type Snapshot = Record<string, unknown>;

/** What the user actually has / hasn't done, read straight from the database. */
function buildSnapshot(user: any, session: any, events: any[]) {
  const devices = new Set<string>();
  for (const e of events) {
    const d = e?.metadata?.device;
    if (typeof d === "string") devices.add(d);
  }

  const pages = events.filter((e) => e?.type === "page_view").map((e) => e?.label).filter(Boolean);
  const skipped = events.filter((e) => e?.type === "question_skipped").map((e) => e?.label).filter(Boolean);

  const agencyId = String(
    user?.agency_id || user?.agency_id_basic || user?.agency_id_advanced || user?.agency_id_elite || "",
  ).trim();
  const hasAgencyId = !!agencyId;
  // The portal link is only "theirs" once they've told us their agency name —
  // auto-generated IDs with no agency name mean nothing was customized yet.
  const hasAgencyName = !!String(user?.agency_name || "").trim();
  const hubUrl = agencyId && hasAgencyName ? `https://yoursoftwareonboarding.com/v2/${agencyId}` : null;



  const outstanding: string[] = [];
  if (!user?.initial_questions_completed) outstanding.push("Finish the short intro questions");
  if (!user?.full_name) outstanding.push("Tell us their name");
  if (!user?.agency_name) outstanding.push("Set their agency name");
  if (!hasAgencyId) outstanding.push("Save their HighLevel agency ID");
  if (!user?.primary_color) outstanding.push("Pick their brand colors");
  if (!user?.onboarding_completed) outstanding.push("Install the branding stylesheet + menu links inside HighLevel");

  const mobileOnly = devices.size > 0 && !devices.has("desktop");

  return {
    plan: user?.plan || "STARTER (free)",
    full_name: user?.full_name || null,
    agency_name: user?.agency_name || null,
    agency_id_set: hasAgencyId,
    agency_id: agencyId || null,
    onboarding_portal_url: hubUrl,

    brand_colors_set: !!user?.primary_color,
    initial_questions_completed: !!user?.initial_questions_completed,
    onboarding_completed: !!user?.onboarding_completed,
    onboarding_step: user?.onboarding_step ?? null,
    login_count: user?.login_count ?? 0,
    last_login_at: user?.last_login_at ?? null,
    account_created_at: user?.created_at ?? null,
    devices_this_session: [...devices],
    mobile_only_session: mobileOnly,
    pages_visited: pages.slice(0, 40),
    questions_skipped: skipped,
    outstanding_setup: outstanding,
    session_started_at: session.session_started_at,
    session_ended_at: session.session_ended_at,
  } satisfies Snapshot;
}

const PLAN_FEATURES: Record<string, string> = {
  STARTER:
    "Free tier: 1 agency setup, branding stylesheet, basic onboarding walkthrough. No menu link removal, no AI chat support, no custom domain.",
  BASIC:
    "Basic: up to 5 agency setups, branding, menu link removal, AI chat support access. No custom domain.",
  ADVANCED:
    "Advanced: unlimited agency setups, branding, menu link removal, AI chat support, Client Hub customization, custom domain available as a $49/mo add-on.",
};

const planFeatureLine = (plan?: string | null) => {
  const key = (plan || "STARTER").toUpperCase();
  return PLAN_FEATURES[key] || PLAN_FEATURES.STARTER;
};

const isBlank = (v: unknown) => typeof v !== "string" || v.trim().length === 0;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const logDecision = async (row: Record<string, unknown>) => {
    try {
      await supabase.from("followup_email_log").insert(row as any);
    } catch (e) {
      console.error("followup_email_log insert failed", e);
    }
    const sent = row.sent === true;
    await logCustomerMessage({
      userEmail: typeof row.user_email === "string" ? row.user_email : null,
      channel: "webhook",
      templateKey: typeof row.email_type === "string" ? row.email_type : "followup",
      subject: typeof row.subject === "string" ? row.subject : null,
      provider: "ghl",
      status: sent ? "sent" : "suppressed",
      source: "analyze-user-session",
      detail: typeof row.suppressed_reason === "string" ? row.suppressed_reason : sent ? null : "not_sent",
    });
  };

  try {
    const { sessionId } = await req.json();
    if (!sessionId) {
      return new Response(JSON.stringify({ error: "sessionId required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: session, error: fetchErr } = await supabase
      .from("user_activity_sessions")
      .select("*")
      .eq("id", sessionId)
      .maybeSingle();

    if (fetchErr || !session) {
      return new Response(JSON.stringify({ error: "Session not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (session.email_sent) {
      return new Response(JSON.stringify({ ok: true, skipped: "already analyzed" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const email = String(session.user_email || "").trim().toLowerCase();
    const events = (session.events as any[]) || [];

    const finish = async (reason: string, extra: Record<string, unknown> = {}) => {
      await supabase
        .from("user_activity_sessions")
        .update({ status: `skipped_${reason}`.slice(0, 40), updated_at: new Date().toISOString() })
        .eq("id", sessionId);
      await logDecision({
        user_email: email,
        email_type: "none",
        session_id: sessionId,
        sent: false,
        suppressed_reason: reason,
        event_count: events.length,
        ...extra,
      });
      return new Response(JSON.stringify({ ok: true, skipped: reason }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    };

    // ---- Gate 1: never email junk / internal test addresses --------------
    const blocked = isBlockedEmail(email);
    if (blocked) return await finish(blocked);

    const { data: user } = await supabase
      .from("saas_suite_users")
      .select(
        "id, email, full_name, plan, agency_name, agency_id, agency_id_basic, agency_id_advanced, agency_id_elite, primary_color, login_count, onboarding_completed, onboarding_step, initial_questions_completed, last_login_at, billing_state, welcome_ai_email_sent_at, hub_welcome_email_sent_at, hub_welcome_email_queued_at, last_followup_email_sent_at, welcome_email_attempts, welcome_email_next_attempt_at, welcome_email_claimed_at, created_at",
      )
      .ilike("email", email)
      .maybeSingle();

    if (!user) return await finish("no_user_row");

    // Name for the greeting: DB -> Google/OAuth metadata -> "john@" style local part.
    const { fullName: resolvedFullName, firstName } = await resolveName(
      email,
      user.full_name as string | null,
    );



    // ---- Gate 2: decide which of the two purposes this send serves -------
    // The 48 hour welcome window is measured from the first login, not from
    // account creation. A paid user who opens the app after the old 48 hour
    // signup window still gets the welcome if none was sent.
    const { data: firstLogin, error: firstLoginError } = await supabase
      .from("login_events")
      .select("logged_in_at")
      .ilike("user_email", email)
      .order("logged_in_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    if (firstLoginError) console.error("first login lookup", firstLoginError.message);

    const sessionWelcome = isWelcomeForSession({
      welcomeSentAt: (user.welcome_ai_email_sent_at as string | null) ?? null,
      loginCount: (user.login_count as number | null) ?? null,
      lastLoginAt: (user.last_login_at as string | null) ?? null,
      earliestLoginAt: firstLoginError ? null : ((firstLogin?.logged_in_at as string | null) ?? null),
      sessionStartedAt: (session.session_started_at as string | null) ?? null,
      nowMs: Date.now(),
    });

    // The hub "Your Custom Onboarding" email IS the welcome email. If it has
    // already gone out (or is queued to go out), never send a second one here.
    if (sessionWelcome && ((user as any).hub_welcome_email_sent_at || (user as any).hub_welcome_email_queued_at)) {
      return await finish("hub_welcome_email_covers_welcome");
    }

    const welcomeAttempts = Number((user as any).welcome_email_attempts ?? 0);
    if (sessionWelcome && welcomeAttempts >= WELCOME_MAX_ATTEMPTS) {
      return await finish("welcome_attempts_exhausted");
    }
    if (
      sessionWelcome &&
      !welcomeRetryDue(welcomeAttempts, ((user as any).welcome_email_next_attempt_at as string | null) ?? null, Date.now())
    ) {
      return await finish("welcome_retry_waiting");
    }

    const isWelcome = sessionWelcome;

    const emailType: "welcome" | "returning" = isWelcome ? "welcome" : "returning";

    // ---- Billing awareness: never send a cheerful "you're thriving" email to
    // someone whose subscription just failed or was canceled. Re-read at send
    // time so a state change between session capture and send is respected.
    const billingState = ((user as any).billing_state as string | null) || null;
    const isPastDue = billingState === "PAST_DUE";

    // ---- Gate 3: cadence ------------------------------------------------
    if (!isWelcome) {
      const since = new Date(Date.now() - RETURNING_COOLDOWN_DAYS * 864e5).toISOString();
      const last = user.last_followup_email_sent_at as string | null;
      if (last && last > since) return await finish("weekly_cap");

      // Belt and braces: also check the log in case the stamp was missed.
      const { count } = await supabase
        .from("followup_email_log")
        .select("id", { count: "exact", head: true })
        .ilike("user_email", email)
        .eq("sent", true)
        .gte("created_at", since);
      if ((count ?? 0) > 0) return await finish("weekly_cap");
    }

    // ---- Gate 4: there has to be something to talk about ----------------
    const meaningfulEvents = events.filter((e) => e?.type && e.type !== "page_view");
    if (events.length === 0 && !isWelcome && !isPastDue) return await finish("no_events");
    if (!isWelcome && !isPastDue && meaningfulEvents.length === 0 && events.length < 3) {
      return await finish("trivial_session");
    }

    const snapshot = buildSnapshot(user, session, events);
    if ((snapshot as any).onboarding_portal_url) {
      const hid = String((snapshot as any).onboarding_portal_url).split("/").pop() as string;
      const hv = await hubVersionFor(supabase, hid);
      (snapshot as any).onboarding_portal_url = String((snapshot as any).onboarding_portal_url).replace("/v2/", `/v${hv}/`);
    }

    const hubUrl = (snapshot as any).onboarding_portal_url as string | null;

    const sharedRules = `Hard rules:
- Only reference actions the snapshot or the activity log actually confirms. Never invent progress.
- Never mention features the user's plan does not include. Their plan: ${snapshot.plan}. ${planFeatureLine(user.plan as string)}
- Plain text only. No markdown, no bullet characters, no emojis. Short paragraphs.
- Sign off with exactly these two lines: "— Andrew George" then "Founder, SaaSSuite".
- Include this exact link once, as the offer of help: ${SUCCESS_CALL_LINK}
- Correct app links look like https://saassuite.ai/app/... — never app.saassuite.ai.

TONE (this matters more than anything):
- Encouraging, celebratory, coach-like. Never scolding, never a report card.
- Frame progress as a win first: "I saw you set up your agency name — that's awesome."
- Never phrase anything as "but you didn't..." or "you haven't...". No lists of failures, no "here's what you did in your session".
- Turn any gap into an upside opportunity instead: "If you head to X and do Y, you'd get a ton of value out of that based on how you've set things up."
- End on encouragement, e.g. "Keep up the great work."`;

    // No agency name = nothing has been customized for them yet, so we must NOT
    // send a portal link. We ask for the agency name instead.
    const askForAgencyName = isWelcome && !hubUrl;
    const AGENCY_NAME_ASK =
      "What's your agency name? Your company name? We'll use that to make a custom tailored client acquisition and retention tool just for you- just respond to this email or log back into SaaSSuite to finish.";

    const welcomeSubject = askForAgencyName
      ? "Your custom onboarding portal is waiting on one thing"
      : "Your Custom Onboarding";

    const STRIPE_PORTAL_LINK = "https://billing.stripe.com/p/login/bIY04697i9jzghy4gg";

    const pastDueSubject = "Your SaaSSuite account is paused";

    const systemPrompt = isPastDue
      ? `You write a win-back email for SaaSSuite (a HighLevel white-label onboarding platform).
IMPORTANT CONTEXT: this user's subscription payment failed or they canceled, so their account is currently PAUSED (billing_state = PAST_DUE). They were downgraded to Starter, their customers can no longer log into their portal (only their very first customer), and their branding and menu link removals are saved but not applied.
You MUST set send_email to true and user_health to "at_risk".
The subject line must be exactly: ${pastDueSubject}

Structure the body exactly like this:
1. One warm, no-guilt line using their first name if known${firstName ? ` (their first name is ${firstName})` : ""}, acknowledging their subscription is currently inactive.
2. State plainly and kindly what that means right now: their customers can't log into their onboarding portal (only their very first customer), and their branding and settings are still saved, just not applied.
3. Reassure them that everything comes back instantly the moment billing is active again — nothing was deleted.
4. Give this exact link once so they can update their card or restart: ${STRIPE_PORTAL_LINK}
5. If they canceled on purpose, invite one line of honest feedback on what was missing — offer help with this link once: ${SUCCESS_CALL_LINK}

CRITICAL: Do NOT congratulate them on progress, do NOT say things are going great, do NOT tell them to go use paid features, and do NOT include any yoursoftwareonboarding.com portal link.

Hard rules:
- Plain text only. No markdown, no bullet characters, no emojis. Short paragraphs.
- Sign off with exactly these two lines: "— Andrew George" then "Founder, SaaSSuite".
- Respectful and human, never pushy or scolding.`
      : askForAgencyName
      ? `You write the first welcome email for SaaSSuite (a HighLevel white-label onboarding platform).
This person signed up but has NOT given us their agency / company name yet, so nothing has been customized for them.
You MUST set send_email to true. The subject line must be exactly: ${welcomeSubject}

Structure the body exactly like this:
1. A one-line warm, upbeat welcome using their first name if known${firstName ? ` (their first name is ${firstName})` : ""}.
2. One or two sentences saying their white-labeled client onboarding portal gets generated the moment we know their agency name — that's the only thing standing between them and a done-for-them onboarding portal they hand to their own customers.
3. If the session shows something real they did, celebrate it in one short positive line. Otherwise skip this.
4. End the email with this paragraph, verbatim, as the final line before the sign-off:
${AGENCY_NAME_ASK}

CRITICAL: Do NOT include any yoursoftwareonboarding.com link, portal URL or agency ID anywhere — it does not exist for them yet. Do not include the success call link either.

Hard rules:
- Plain text only. No markdown, no bullet characters, no emojis. Short paragraphs.
- Sign off with exactly these two lines: "— Andrew George" then "Founder, SaaSSuite".
- Encouraging and warm, never scolding. Never say "you didn't" or "you failed to".
- The only link you may mention is https://saassuite.ai/app.`
      : isWelcome
      ? `You write the first welcome email for SaaSSuite (a HighLevel white-label onboarding platform).
This is the user's FIRST session. You MUST set send_email to true.
The subject line must be exactly: Your Custom Onboarding

Structure the body exactly like this:
1. A one-line warm, upbeat welcome using their first name if known${firstName ? ` (their first name is ${firstName})` : ""}.
2. Within the FIRST TWO SENTENCES of the email, include their live onboarding portal URL verbatim exactly once: ${hubUrl} — tell them this is the link they hand to their own customers.
3. Celebrate something real they actually did this session (one short line, genuinely positive).
4. One clear, opportunity-framed next step: where to go and what they'd get out of it, based on their setup.
5. Close by offering help with the success call link, then an encouraging sign-off.

${sharedRules}`

      : `You write a returning-user encouragement email for SaaSSuite (a HighLevel white-label onboarding platform).
This user is coming back. You may send at most one of these per week, so make it count.

Send an email if there is anything genuinely useful and positive to say about their progress or what to do next.
Do NOT send if the session shows nothing meaningful at all.

When sending, structure the body exactly like this:
1. One upbeat line recognising what they worked on, framed as a win.
2. One to three opportunity-framed next actions — "if you go here and do this, you'd get a lot of value out of it" — never framed as things they failed to do.
3. One short "did you know you can..." tip that is genuinely available on their plan.
4. Close by offering help with the success call link, then an encouraging sign-off.

${sharedRules}`;


    const userPrompt = `User: ${resolvedFullName || firstName || email} (${email})
Known first name: ${firstName || "(unknown)"}
Email type: ${emailType}
Billing state: ${billingState || "ACTIVE"}${isPastDue ? " (subscription inactive / canceled — win-back email)" : ""}

Account snapshot (authoritative — this is real database state):
${JSON.stringify(snapshot, null, 2)}

Session duration: ${
      session.session_ended_at
        ? Math.round(
            (new Date(session.session_ended_at).getTime() - new Date(session.session_started_at).getTime()) / 60000,
          )
        : "still active"
    } min
Total events: ${events.length}

Activity log:
${events
  .map(
    (e: any, i: number) =>
      `${i + 1}. [${e.timestamp || ""}] ${e.type}${e.label ? ` - ${e.label}` : ""}${
        e.metadata ? ` (${JSON.stringify(e.metadata)})` : ""
      }`,
  )
  .join("\n") || "(no events recorded)"}`;

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "decide_followup",
              description: "Decide whether to send a follow-up email and what to say",
              parameters: {
                type: "object",
                properties: {
                  send_email: { type: "boolean", description: "Whether a follow-up email should be sent" },
                  reason: { type: "string", description: "Brief reason for the decision (1-2 sentences)" },
                  user_health: { type: "string", enum: ["thriving", "on_track", "stuck", "at_risk"] },
                  drop_off_point: {
                    type: "string",
                    description: "Where the user appears to have stalled, or empty string if nowhere.",
                  },
                  next_steps: {
                    type: "array",
                    items: { type: "string" },
                    description: "One to three concrete next actions.",
                  },
                  email_subject: {
                    type: "string",
                    description: "Email subject line. Required. Empty string only if send_email is false.",
                  },
                  email_body: {
                    type: "string",
                    description:
                      "Plain-text email body following the required structure. Required whenever send_email is true.",
                  },
                  key_observation: { type: "string", description: "The most important thing observed this session" },
                },
                required: [
                  "send_email",
                  "reason",
                  "user_health",
                  "key_observation",
                  "email_subject",
                  "email_body",
                  "drop_off_point",
                  "next_steps",
                ],
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "decide_followup" } },
      }),
    });

    if (!aiResponse.ok) {
      const text = await aiResponse.text();
      console.error("AI gateway error:", aiResponse.status, text);
      throw new Error(`AI gateway returned ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
    const analysis = toolCall ? JSON.parse(toolCall.function.arguments) : null;
    if (!analysis) throw new Error("AI did not return structured analysis");

    analysis.email_type = emailType;

    // Past due / canceled: force the win-back framing regardless of what the
    // model decided, and strip any portal link or congratulatory sign-off.
    if (isPastDue) {
      analysis.send_email = true;
      analysis.user_health = "at_risk";
      analysis.email_subject = pastDueSubject;
      if (isBlank(analysis.email_body)) {
        analysis.email_body =
          `Hey ${firstName || "there"},\n\n` +
          `Your SaaSSuite subscription is currently inactive, so your account is paused. That means your customers can't log into your onboarding portal right now (only the very first customer you added), and your branding and menu link removals are still saved but not applied.\n\n` +
          `Nothing was deleted. The moment billing is active again, everything switches back on exactly as you had it: ${STRIPE_PORTAL_LINK}\n\n` +
          `And if you canceled on purpose, I'd genuinely like to know what was missing — you can reply here, or grab a time with me: ${SUCCESS_CALL_LINK}\n\n— Andrew George\nFounder, SaaSSuite`;
      } else {
        let body = String(analysis.email_body)
          .replace(/https?:\/\/(www\.)?yoursoftwareonboarding\.com\S*/gi, "")
          .replace(/keep up the great work\.?/gi, "")
          .trimEnd();
        if (!body.includes(STRIPE_PORTAL_LINK)) {
          body += `\n\nYou can update your card or restart here: ${STRIPE_PORTAL_LINK}`;
        }
        if (!/Founder,\s*SaaSSuite/i.test(body)) body += `\n\n— Andrew George\nFounder, SaaSSuite`;
        analysis.email_body = body;
      }
    } else if (isWelcome) {
      analysis.send_email = true;
      analysis.email_subject = welcomeSubject;
      const greeting = `Hey ${firstName || "there"},`;

      if (askForAgencyName) {
        if (isBlank(analysis.email_body)) {
          analysis.email_body =
            `${greeting}\n\n` +
            `Welcome to SaaSSuite — you're in. The one thing we still need is your agency (company) name, because that's what we use to generate your white-labeled client onboarding portal: the link you hand to your own customers so they onboard themselves.\n\n` +
            `Add it at https://saassuite.ai/app and it's built for you instantly.\n\n` +
            `${AGENCY_NAME_ASK}\n\n— Andrew George\nFounder, SaaSSuite`;
        } else {
          // Strip portal links, the call link, the sign-off, and any paraphrase of
          // the closing ask, then append the canonical ask exactly once.
          const body = String(analysis.email_body)
            .split("\n")
            .filter((l) =>
              !/yoursoftwareonboarding\.com/i.test(l) &&
              !/agency name\?/i.test(l) &&
              !/custom tailored client acquisition/i.test(l) &&
              !/^\s*—\s*Andrew(\s+George)?\s*$/i.test(l) &&
              !/^\s*Founder,\s*SaaSSuite\s*$/i.test(l)
            )
            .join("\n")
            .replace(/https?:\/\/(www\.)?yoursoftwareonboarding\.com\S*/gi, "")
            .replace(new RegExp(SUCCESS_CALL_LINK.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi"), "")
            .trimEnd();
          analysis.email_body = `${body}\n\n${AGENCY_NAME_ASK}\n\n— Andrew George\nFounder, SaaSSuite`;
        }

      } else if (isBlank(analysis.email_body)) {
        analysis.email_body =
          `${greeting}\n\n` +
          `Great news — your custom onboarding portal is already live at ${hubUrl}. That's the link you hand to your own customers.\n\n` +
          `You're off to a strong start. Head into https://saassuite.ai/app and take a look at the training videos and support section — that's where most people get the biggest early win, and it's what keeps your clients from asking you the same questions over and over.\n\n` +
          `Want a hand getting it dialed in? Grab a time here: ${SUCCESS_CALL_LINK}\n\nKeep up the great work.\n\n— Andrew George\nFounder, SaaSSuite`;
      } else if (hubUrl && !analysis.email_body.includes(hubUrl)) {
        // The portal link is non-negotiable and must land in the opening lines.
        const lines = String(analysis.email_body).split("\n");
        const firstIdx = lines.findIndex((l: string) => l.trim().length > 0);
        lines.splice(
          firstIdx + 1,
          0,
          "",
          `Your custom onboarding portal is already live at ${hubUrl} — that's the link you hand to your own customers.`,
        );
        analysis.email_body = lines.join("\n");
      }
    }



    // Never hand a blank email to the webhook.
    if (analysis.send_email && (isBlank(analysis.email_subject) || isBlank(analysis.email_body))) {
      console.error("Blank email content from AI — suppressing send", { sessionId, email });
      analysis.send_email = false;
      analysis.suppressed_reason = "blank_email_content";
    }

    // Guard against hallucinated links.
    if (typeof analysis.email_body === "string") {
      analysis.email_body = analysis.email_body.replace(/https?:\/\/app\.saassuite\.ai/gi, "https://saassuite.ai/app");
    }

    await supabase
      .from("user_activity_sessions")
      .update({ ai_analysis: analysis, status: "analyzed", updated_at: new Date().toISOString() })
      .eq("id", sessionId);

    if (analysis.send_email) {
      if (Deno.env.get("WELCOME_EMAIL_DISABLE_SEND") === "1") {
        console.log("followup send disabled", email, emailType);
        await logDecision({
          user_email: email,
          email_type: emailType,
          session_id: sessionId,
          subject: analysis.email_subject,
          sent: false,
          suppressed_reason: "send_disabled",
          event_count: events.length,
        });
      } else {
        const payload = {
          email,
          full_name: resolvedFullName || firstName || "",
          email_type: emailType,
          subject: analysis.email_subject,
          body: analysis.email_body,
          user_health: analysis.user_health,
          drop_off_point: analysis.drop_off_point || "",
          next_steps: analysis.next_steps || [],
          reason: analysis.reason,
          key_observation: analysis.key_observation,
          success_call_link: SUCCESS_CALL_LINK,
          plan: user.plan || "STARTER",
          session_id: sessionId,
          event_count: events.length,
          is_first_session: isWelcome,
        };

        let claimedWelcome = true;
        if (isWelcome) {
          let claim = supabase
            .from("saas_suite_users")
            .update({ welcome_email_claimed_at: new Date().toISOString() })
            .eq("id", user.id)
            .is("welcome_ai_email_sent_at", null);
          const seenClaim = (user as any).welcome_email_claimed_at as string | null;
          claim = seenClaim ? claim.eq("welcome_email_claimed_at", seenClaim) : claim.is("welcome_email_claimed_at", null);
          const { data: claimed, error: claimError } = await claim.select("id");
          if (claimError) console.error("welcome claim failed", claimError.message);
          claimedWelcome = !claimError && (claimed?.length ?? 0) === 1;
        }

        if (!claimedWelcome) {
          await logDecision({
            user_email: email,
            email_type: emailType,
            session_id: sessionId,
            subject: analysis.email_subject,
            sent: false,
            suppressed_reason: "welcome_already_claimed",
            event_count: events.length,
          });
        } else {
          const webhook = await postJsonWebhook(fetch, FOLLOWUP_WEBHOOK_URL, payload);
          if (!webhook.ok) {
            const reason = webhook.status ? `webhook_http_${webhook.status}` : "webhook_error";
            console.error("Webhook not accepted", email, reason, webhook.error);
            if (isWelcome) {
              const plan = welcomeRetryPlan(welcomeAttempts, Date.now());
              await supabase
                .from("saas_suite_users")
                .update({
                  welcome_email_claimed_at: null,
                  welcome_email_attempts: plan.attempts,
                  welcome_email_next_attempt_at: new Date(plan.retryAtMs).toISOString(),
                  welcome_email_last_error: `${reason}${webhook.error ? `: ${webhook.error}` : ""}`.slice(0, 500),
                })
                .eq("id", user.id)
                .is("welcome_ai_email_sent_at", null);
            }
            await logDecision({
              user_email: email,
              email_type: emailType,
              session_id: sessionId,
              subject: analysis.email_subject,
              sent: false,
              suppressed_reason: reason,
              event_count: events.length,
            });
          } else {
            const now = new Date().toISOString();
            await supabase
              .from("user_activity_sessions")
              .update({ email_sent: true, email_sent_at: now })
              .eq("id", sessionId);

            if (isWelcome) {
              const { data: stamped, error: stampError } = await supabase
                .from("saas_suite_users")
                .update({
                  last_followup_email_sent_at: now,
                  welcome_ai_email_sent_at: now,
                  welcome_email_claimed_at: null,
                  welcome_email_last_error: null,
                })
                .eq("id", user.id)
                .is("welcome_ai_email_sent_at", null)
                .select("id");
              if (stampError || !stamped?.length) {
                console.error("welcome stamp missed", email, stampError?.message);
              }
            } else {
              await supabase
                .from("saas_suite_users")
                .update({ last_followup_email_sent_at: now })
                .ilike("email", email);
            }

            await logDecision({
              user_email: email,
              email_type: emailType,
              session_id: sessionId,
              subject: analysis.email_subject,
              body: analysis.email_body,
              sent: true,
              user_health: analysis.user_health,
              event_count: events.length,
            });
          }
        }
      }
    } else {
      await logDecision({
        user_email: email,
        email_type: emailType,
        session_id: sessionId,
        subject: analysis.email_subject || null,
        sent: false,
        suppressed_reason: analysis.suppressed_reason || "ai_declined",
        user_health: analysis.user_health,
        event_count: events.length,
      });
    }

    return new Response(JSON.stringify({ ok: true, analysis }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("analyze-user-session error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

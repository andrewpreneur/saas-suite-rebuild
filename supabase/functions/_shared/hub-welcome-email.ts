import { resolveHubUrl } from "./hub-url.ts";
// Shared: the "your onboarding portal is live" AI welcome email.
//
// Fired the moment a new agency owner enters their agency name (i.e. from
// provision-hub, right after their agency_id / hub URL exists). The email is
// AI-written per account but ALWAYS contains two links, non-negotiable:
//   1. their live hub  -> https://yoursoftwareonboarding.com/v2/<agency_id>
//   2. customisation    -> https://saassuite.ai/app
// Delivery goes through the LeadConnector inbound webhook in
// HUB_WELCOME_WEBHOOK_URL, which sends the one-off email.

import { resolveName } from "./derive-name.ts";
import { logCustomerMessage } from "./journey-log.ts";
const HUB_BASE = "https://yoursoftwareonboarding.com/v2";
export const APP_URL = "https://saassuite.ai/app";

export function hubUrlFor(agencyId: string): string {
  return `${HUB_BASE}/${agencyId}`;
}

const HEX_ID = /^[0-9a-f]{24,}$/i;

/**
 * The agency id the customer actually sees in the app for their plan's hub.
 * Legacy accounts (and Stripe-provisioned ones) carry a raw hex `agency_id`
 * while the readable slug lives in agency_id_basic/advanced/elite — the email
 * must always link the readable, plan-correct one.
 */
export function publicHubAgencyId(row: {
  plan?: string | null;
  agency_id?: string | null;
  agency_id_basic?: string | null;
  agency_id_advanced?: string | null;
  agency_id_elite?: string | null;
}): string {
  const basic = (row.agency_id_basic || "").trim();
  const advanced = (row.agency_id_advanced || "").trim();
  const elite = (row.agency_id_elite || "").trim();
  const base = (row.agency_id || "").trim();
  const plan = String(row.plan || "STARTER").toUpperCase();

  const byPlan =
    plan === "ADVANCED" || plan === "ELITE"
      ? [advanced, elite, basic, base]
      : [basic, advanced, elite, base];

  // Prefer a readable slug over a raw hex id.
  const readable = byPlan.find((id) => id && !HEX_ID.test(id));
  return readable || byPlan.find(Boolean) || "";
}


type Copy = { subject: string; body: string; body_html: string };

/**
 * Subject line is personalised: their agency name if we have a real one,
 * otherwise their first name, otherwise a generic line.
 */
export function welcomeSubject(firstName: string, agencyName: string): string {
  const agency = (agencyName || "").trim();
  const generic = !agency || /^your agency$/i.test(agency);
  const label = !generic ? agency : (firstName || "").trim();
  if (!label) return "Your Custom Onboarding Link";
  const possessive = /s$/i.test(label) ? `${label}'` : `${label}'s`;
  return `${possessive} Custom Onboarding Link`;
}

function fallbackCopy(firstName: string, agencyName: string, hubUrl: string): Copy {
  const hi = firstName ? `Hi ${firstName},` : "Hi,";
  const subject = welcomeSubject(firstName, agencyName);
  const lines = [
    hi,
    "",
    `Your white-labeled onboarding portal for ${agencyName} is live right now:`,
    hubUrl,
    "",
    "Here's exactly what to do next (10 minutes, tops):",
    "1. Open your portal link above — this is the link you'll give your customers.",
    "2. Watch a couple of the training videos inside so you know what your clients will see.",
    "3. Check out the education and support sections — that's the stuff that keeps your clients from asking you the same questions over and over.",
    "",
    `Want to customise it — your colors, your videos, your checklist, your branding? Do it here: ${APP_URL}`,
    "",
    "That's it. Use the link, look around, then make it yours.",
    "",
    "— Andrew George",
    "Founder, SaaSSuite",
  ];
  const body = lines.join("\n");
  const body_html = `<p>${hi}</p>
<p>Your white-labeled onboarding portal for <strong>${agencyName}</strong> is live right now:</p>
<p><a href="${hubUrl}">${hubUrl}</a></p>
<p>Here's exactly what to do next (10 minutes, tops):</p>
<ol>
<li>Open your portal link above — this is the link you'll give your customers.</li>
<li>Watch a couple of the training videos inside so you know what your clients will see.</li>
<li>Check out the education and support sections — that's what keeps clients from asking you the same questions over and over.</li>
</ol>
<p>Want to customise it — your colors, your videos, your checklist, your branding? Do it here: <a href="${APP_URL}">${APP_URL}</a></p>
<p>That's it. Use the link, look around, then make it yours.</p>
<p>— Andrew George<br/>Founder, SaaSSuite</p>`;
  return { subject, body, body_html };
}

async function generateCopy(
  firstName: string,
  agencyName: string,
  hubUrl: string,
  plan: string,
): Promise<Copy> {
  const subjectLine = welcomeSubject(firstName, agencyName);
  const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
  if (!apiKey) return fallbackCopy(firstName, agencyName, hubUrl);

  const prompt = `Write a short, warm, high-energy onboarding email for a brand-new SaaSSuite customer who just created their white-labeled client onboarding portal.

Recipient first name: ${firstName || "(unknown - use a generic greeting)"}
Their agency name: ${agencyName}
Their plan: ${plan || "STARTER"}

NON-NEGOTIABLE REQUIREMENTS:
- Include their live portal URL verbatim, exactly once as the hero of the email: ${hubUrl}
- Tell them this is the link they give their own customers.
- Tell them to look at the education/training videos and the support section inside it.
- Include this URL verbatim for customising branding, videos and checklists: ${APP_URL}
- Do NOT invent any other links, prices, logins or promises.
- Under 180 words, plain and human, no emoji, no marketing fluff, no "I hope this email finds you well".
- Sign off with exactly these two lines: "— Andrew George" then "Founder, SaaSSuite".
- Tone: encouraging and celebratory, like a coach. Never say "but you didn't" or list what they haven't done. Frame every next step as an upside ("if you go here and do this, you'd get a lot of value out of it") and end on encouragement.

The subject MUST be exactly: ${subjectLine}
The portal URL must appear within the first two sentences of the body.

Respond with ONLY raw JSON (no markdown fences):
{"subject":"...","body":"...","body_html":"..."}
body_html must be simple HTML paragraphs/lists with real <a href> anchors for both URLs.`;

  const MODELS = [
    "claude-haiku-4-5-20251001",
    "claude-sonnet-4-5-20250929",
    "claude-opus-4-5-20251101",
  ];

  try {
    let data: any = null;
    for (const model of MODELS) {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model,
          max_tokens: 1200,
          messages: [{ role: "user", content: prompt }],
        }),
      });
      if (res.ok) {
        data = await res.json();
        break;
      }
      console.error("[hub-welcome-email] anthropic failed", model, res.status, await res.text());
    }
    if (!data) return fallbackCopy(firstName, agencyName, hubUrl);
    const text = String(data?.content?.[0]?.text || "").replace(/```json|```/g, "").trim();
    const parsed = JSON.parse(text) as Partial<Copy>;

    let subject = subjectLine;
    let body = String(parsed.body || "").trim();
    let body_html = String(parsed.body_html || "").trim();
    if (!body || !body_html) return fallbackCopy(firstName, agencyName, hubUrl);

    // Guarantee both links survived the model.
    if (!body.includes(hubUrl)) body += `\n\nYour portal: ${hubUrl}`;
    if (!body.includes(APP_URL)) body += `\nCustomise it: ${APP_URL}`;
    if (!body_html.includes(hubUrl)) body_html += `<p>Your portal: <a href="${hubUrl}">${hubUrl}</a></p>`;
    if (!body_html.includes(APP_URL)) body_html += `<p>Customise it: <a href="${APP_URL}">${APP_URL}</a></p>`;
    return { subject, body, body_html };
  } catch (e) {
    console.error("[hub-welcome-email] generate error", e);
    return fallbackCopy(firstName, agencyName, hubUrl);
  }
}

export type HubWelcomeResult = {
  ok: boolean;
  skipped?: string;
  hub_url?: string;
  subject?: string;
  status?: number;
};

/**
 * Send (once per account) the hub welcome email. Safe to call fire-and-forget —
 * it never throws.
 */
export async function sendHubWelcomeEmail(
  supabase: any,
  email: string,
  opts: { agencyId: string; agencyName?: string | null; fullName?: string | null; plan?: string | null; force?: boolean },
): Promise<HubWelcomeResult> {
  try {
    const normalized = email.trim().toLowerCase();
    const agencyId = (opts.agencyId || "").trim();
    if (!agencyId) return { ok: false, skipped: "no_agency_id" };

    if (!opts.force) {
      const { data: existing } = await supabase
        .from("saas_suite_users")
        .select("hub_welcome_email_sent_at")
        .ilike("email", normalized)
        .maybeSingle();
      if (existing?.hub_welcome_email_sent_at) return { ok: true, skipped: "already_sent" };
    }

    const webhookUrl = Deno.env.get("HUB_WELCOME_WEBHOOK_URL");
    const hubUrl = await resolveHubUrl(supabase, agencyId);
    const agencyName = (opts.agencyName || opts.fullName || "your agency").trim();
    const resolved = await resolveName(normalized, opts.fullName);
    const firstName = resolved.firstName;


    const copy = await generateCopy(firstName, agencyName, hubUrl, String(opts.plan || "STARTER"));

    if (!webhookUrl) {
      console.error("[hub-welcome-email] HUB_WELCOME_WEBHOOK_URL not configured — nothing sent");
      await logCustomerMessage({
        userEmail: normalized,
        channel: "webhook",
        templateKey: "hub_welcome_email",
        subject: copy.subject,
        provider: "ghl",
        status: "suppressed",
        source: "send-hub-welcome-email",
        detail: "webhook_not_configured",
      });
      return { ok: false, skipped: "webhook_not_configured", hub_url: hubUrl, subject: copy.subject };
    }

    const payload = {
      event: "hub_welcome_email",
      email: normalized,
      first_name: firstName,
      resolved_full_name: resolved.fullName || opts.fullName || "",
      full_name: opts.fullName || "",
      agency_name: agencyName,
      agency_id: agencyId,
      plan: opts.plan || "STARTER",
      // The two links that MUST be in the email:
      onboarding_url: hubUrl,
      hub_url: hubUrl,
      customize_url: APP_URL,
      app_url: APP_URL,
      subject: copy.subject,
      body: copy.body,
      body_html: copy.body_html,
      sent_at: new Date().toISOString(),
    };

    const res = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      console.error("[hub-welcome-email] webhook failed", res.status, await res.text());
      await logCustomerMessage({
        userEmail: normalized,
        channel: "webhook",
        templateKey: "hub_welcome_email",
        subject: copy.subject,
        provider: "ghl",
        status: "failed",
        source: "send-hub-welcome-email",
        detail: `http_${res.status}`,
      });
      return { ok: false, status: res.status, hub_url: hubUrl };
    }

    await supabase
      .from("saas_suite_users")
      .update({ hub_welcome_email_sent_at: payload.sent_at })
      .ilike("email", normalized);

    await logCustomerMessage({
      userEmail: normalized,
      channel: "webhook",
      templateKey: "hub_welcome_email",
      subject: copy.subject,
      provider: "ghl",
      status: "sent",
      source: "send-hub-welcome-email",
    });

    return { ok: true, hub_url: hubUrl, subject: copy.subject };
  } catch (e) {
    console.error("[hub-welcome-email]", e);
    return { ok: false, skipped: String(e) };
  }
}

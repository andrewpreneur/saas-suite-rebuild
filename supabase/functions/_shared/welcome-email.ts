/**
 * Account welcome email.
 *
 * The cron sends this after the account row exists. analyze-user-session still
 * sends it on a first session when nothing has gone out. Neither path stamps
 * welcome_ai_email_sent_at unless the GoHighLevel webhook returns 2xx.
 * Accounts created before WELCOME_EMAIL_CUTOVER_ISO are not selected unless
 * someone sets welcome_email_force.
 */
import { nameFromEmail } from "./derive-name.ts";

export const WELCOME_EMAIL_CUTOVER_ISO = "2026-10-22T02:00:00.000Z";
export const WELCOME_QUIET_MS = 10 * 60 * 1000;
export const WELCOME_CLAIM_STALE_MS = 15 * 60 * 1000;
export const WELCOME_MAX_ATTEMPTS = 5;
export const WELCOME_MAX_AGE_HOURS = 48;
export const WELCOME_LOGIN_REDIRECT = "https://saassuite.ai/reset-password";
export const WELCOME_APP_URL = "https://saassuite.ai/app";
export const WELCOME_SUCCESS_CALL_LINK = "https://saassuite.ai/success";

const EXCLUDED_SOURCES = new Set(["internal", "admin_granted"]);

const BACKOFF_MS = [
  5 * 60 * 1000,
  30 * 60 * 1000,
  2 * 60 * 60 * 1000,
  12 * 60 * 60 * 1000,
];

/** Same junk-address rules analyze-user-session already used. */
export const isBlockedEmail = (raw: string): string | null => {
  const email = (raw || "").trim().toLowerCase();
  if (!email || !email.includes("@")) return "invalid_email";
  const [local, domain] = email.split("@");
  const blockedDomains = ["example.com", "example.org", "hmail.com", "test.com", "mailinator.com", "proton.me"];
  if (blockedDomains.includes(domain)) return "blocked_domain";
  if (local.startsWith("test") || local.includes("+test") || local.includes("testing")) return "test_address";
  if (local.startsWith("escadmin")) return "test_address";
  return null;
};

export function isAutoWelcomeSource(source: string | null | undefined): boolean {
  const value = (source ?? "").trim().toLowerCase();
  if (!value) return true;
  return !EXCLUDED_SOURCES.has(value);
}

export type WelcomeCandidate = {
  email: string | null;
  createdAt: string | null;
  welcomeSentAt: string | null;
  hubWelcomeSentAt: string | null;
  hubWelcomeQueuedAt: string | null;
  source: string | null;
  force: boolean;
  attempts: number;
  nextAttemptAt: string | null;
  claimedAt: string | null;
};

export function welcomeRetryDue(attempts: number, nextAttemptAt: string | null, nowMs: number): boolean {
  if (attempts >= WELCOME_MAX_ATTEMPTS) return false;
  if (!nextAttemptAt) return true;
  const at = Date.parse(nextAttemptAt);
  if (!Number.isFinite(at)) return true;
  return at <= nowMs;
}

export function welcomeClaimHeld(claimedAt: string | null, nowMs: number): boolean {
  if (!claimedAt) return false;
  const at = Date.parse(claimedAt);
  if (!Number.isFinite(at)) return false;
  return nowMs - at < WELCOME_CLAIM_STALE_MS;
}

export function welcomeRetryPlan(attempts: number, nowMs: number): {
  attempts: number;
  retryAtMs: number;
  exhausted: boolean;
} {
  const next = attempts + 1;
  if (next >= WELCOME_MAX_ATTEMPTS) {
    return { attempts: next, retryAtMs: nowMs + 365 * 24 * 60 * 60 * 1000, exhausted: true };
  }
  const wait = BACKOFF_MS[Math.min(next - 1, BACKOFF_MS.length - 1)];
  return { attempts: next, retryAtMs: nowMs + wait, exhausted: false };
}

/** Stop scanning this row. Does not stamp the email as sent. */
export function terminalSkipUpdate(reason: string): { attempts: number; lastError: string } | null {
  if (reason === "blocked_email" || reason === "invalid_email" || reason === "excluded_source") {
    return { attempts: WELCOME_MAX_ATTEMPTS, lastError: reason };
  }
  return null;
}

export function pendingWelcomeDecision(
  row: WelcomeCandidate,
  nowMs: number,
  cutoverIso: string = WELCOME_EMAIL_CUTOVER_ISO,
): { send: true } | { send: false; reason: string } {
  const email = (row.email ?? "").trim();
  if (!email) return { send: false, reason: "invalid_email" };
  const blocked = isBlockedEmail(email);
  if (blocked) return { send: false, reason: blocked === "invalid_email" ? "invalid_email" : "blocked_email" };
  if (row.welcomeSentAt) return { send: false, reason: "already_sent" };
  if (row.hubWelcomeSentAt || row.hubWelcomeQueuedAt) return { send: false, reason: "hub_welcome" };
  if (!row.force && !isAutoWelcomeSource(row.source)) return { send: false, reason: "excluded_source" };
  if ((row.attempts ?? 0) >= WELCOME_MAX_ATTEMPTS) return { send: false, reason: "attempts_exhausted" };
  if (!welcomeRetryDue(row.attempts ?? 0, row.nextAttemptAt, nowMs)) return { send: false, reason: "waiting_backoff" };
  if (welcomeClaimHeld(row.claimedAt, nowMs)) return { send: false, reason: "claimed" };

  const createdMs = row.createdAt ? Date.parse(row.createdAt) : NaN;
  if (!row.force) {
    if (!Number.isFinite(createdMs)) return { send: false, reason: "missing_created_at" };
    if (createdMs < Date.parse(cutoverIso)) return { send: false, reason: "before_cutover" };
    if (nowMs - createdMs < WELCOME_QUIET_MS) return { send: false, reason: "too_new" };
  }
  return { send: true };
}

/**
 * First-session welcome. The 48 hour window is from the first login, not from
 * account creation, so a paid user who opens the app later still gets it once.
 */
export function isWelcomeForSession(input: {
  welcomeSentAt: string | null;
  loginCount: number | null;
  lastLoginAt: string | null;
  earliestLoginAt: string | null;
  sessionStartedAt: string | null;
  nowMs: number;
}): boolean {
  if (input.welcomeSentAt) return false;
  const logins = input.loginCount ?? 0;
  if (logins > 2) return false;
  // login_count 0 means we never counted a sign-in. last_login_at used to be
  // stamped at insert, so it is not the first login in that case.
  const anchor = input.earliestLoginAt
    || (logins === 0 ? input.sessionStartedAt : null)
    || input.lastLoginAt
    || input.sessionStartedAt;
  if (!anchor) return false;
  const ageHours = (input.nowMs - Date.parse(anchor)) / 36e5;
  if (!Number.isFinite(ageHours)) return false;
  if (ageHours < 0) return true;
  return ageHours <= WELCOME_MAX_AGE_HOURS;
}

export function welcomeFirstName(fullName: string | null | undefined, email: string): string {
  const named = String(fullName ?? "").trim().split(/\s+/)[0] ?? "";
  if (named && /^[a-z][a-z'-]{1,30}$/i.test(named)) {
    return named.charAt(0).toUpperCase() + named.slice(1);
  }
  return nameFromEmail(email);
}

const HEX_ID = /^[0-9a-f]{24,}$/i;

/** Readable hub id, same preference as publicHubAgencyId. */
export function welcomeHubAgencyId(row: {
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
  const byPlan = plan === "ADVANCED" || plan === "ELITE"
    ? [advanced, elite, basic, base]
    : [basic, advanced, elite, base];
  const readable = byPlan.find((id) => id && !HEX_ID.test(id));
  return readable || byPlan.find(Boolean) || "";
}

export function accountWelcomeCopy(input: {
  firstName: string;
  hubUrl: string | null;
  setPasswordUrl: string | null;
}): { subject: string; body: string } {
  const greeting = `Hey ${input.firstName || "there"},`;
  const password = input.setPasswordUrl
    ? `This link sets your password and signs you in. It expires soon:\n${input.setPasswordUrl}\n\n`
    : "";
  if (!input.hubUrl) {
    return {
      subject: "Your custom onboarding portal is waiting on one thing",
      body:
        `${greeting}\n\n` +
        `Welcome to SaaSSuite — you're in. The one thing we still need is your agency (company) name, because that's what we use to generate your white-labeled client onboarding portal: the link you hand to your own customers so they onboard themselves.\n\n` +
        password +
        `Add it at ${WELCOME_APP_URL} and it's built for you instantly.\n\n` +
        `What's your agency name? Your company name? We'll use that to make a custom tailored client acquisition and retention tool just for you- just respond to this email or log back into SaaSSuite to finish.\n\n` +
        `— Andrew George\nFounder, SaaSSuite`,
    };
  }
  return {
    subject: "Your Custom Onboarding",
    body:
      `${greeting}\n\n` +
      `Great news — your custom onboarding portal is already live at ${input.hubUrl}. That's the link you hand to your own customers.\n\n` +
      password +
      `You're off to a strong start. Head into ${WELCOME_APP_URL} and take a look at the training videos and support section — that's where most people get the biggest early win.\n\n` +
      `Want a hand getting it dialed in? Grab a time here: ${WELCOME_SUCCESS_CALL_LINK}\n\n` +
      `Keep up the great work.\n\n— Andrew George\nFounder, SaaSSuite`,
  };
}

export type WelcomeWebhookBody = {
  email: string;
  full_name: string;
  email_type: "welcome";
  subject: string;
  body: string;
  set_password_url: string;
  has_auth_login: boolean;
  user_health: "on_track";
  success_call_link: string;
  plan: string;
  session_id: null;
  event_count: 0;
  is_first_session: false;
  reason: "account_created";
  source: "send-pending-welcome";
};

export function buildAccountWelcomePayload(input: {
  email: string;
  fullName: string | null;
  plan: string | null;
  hubUrl: string | null;
  setPasswordUrl: string | null;
  hasAuthLogin: boolean;
}): WelcomeWebhookBody {
  const firstName = welcomeFirstName(input.fullName, input.email);
  const copy = accountWelcomeCopy({
    firstName,
    hubUrl: input.hubUrl,
    setPasswordUrl: input.setPasswordUrl,
  });
  return {
    email: input.email.trim().toLowerCase(),
    full_name: (input.fullName || firstName || "").trim(),
    email_type: "welcome",
    subject: copy.subject,
    body: copy.body,
    set_password_url: input.setPasswordUrl || "",
    has_auth_login: input.hasAuthLogin,
    user_health: "on_track",
    success_call_link: WELCOME_SUCCESS_CALL_LINK,
    plan: input.plan || "STARTER",
    session_id: null,
    event_count: 0,
    is_first_session: false,
    reason: "account_created",
    source: "send-pending-welcome",
  };
}

export type WebhookResult = { ok: boolean; status: number | null; error: string | null };

export function webhookAccepted(status: number | null): boolean {
  return status !== null && status >= 200 && status < 300;
}

/** POST JSON. The caller passes fetch and the URL. A non-2xx is not a send. */
export async function postJsonWebhook(
  fetchImpl: typeof fetch,
  url: string,
  body: unknown,
  timeoutMs = 10000,
): Promise<WebhookResult> {
  try {
    const response = await fetchImpl(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!webhookAccepted(response.status)) {
      const text = await response.text().catch(() => "");
      return { ok: false, status: response.status, error: text.slice(0, 300) };
    }
    return { ok: true, status: response.status, error: null };
  } catch (error) {
    return {
      ok: false,
      status: null,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

export type LinkAdmin = {
  generateLink(args: {
    type: "invite" | "recovery";
    email: string;
    options: { redirectTo: string };
  }): Promise<{
    data: { properties?: { action_link?: string | null } | null } | null;
    error: { message?: string; code?: string } | null;
  }>;
};

const ALREADY_REGISTERED = /already (been )?registered|already exists|user already|email address (has already|already)/i;

/**
 * Users with an auth login get no link. Everyone else gets a recovery link
 * (invite first, so the auth user exists) that /reset-password already accepts.
 * generateLink does not send Supabase's own email.
 */
export async function resolveWelcomeLoginLink(
  admin: LinkAdmin,
  email: string,
  hasAuthUser: boolean,
): Promise<{ ok: true; url: string | null } | { ok: false; error: string }> {
  if (hasAuthUser) return { ok: true, url: null };
  const clean = email.trim().toLowerCase();
  const options = { redirectTo: WELCOME_LOGIN_REDIRECT };
  const invited = await admin.generateLink({ type: "invite", email: clean, options });
  const inviteMessage = invited.error?.message || "";
  if (invited.error && ALREADY_REGISTERED.test(inviteMessage)) return { ok: true, url: null };
  const recovery = await admin.generateLink({ type: "recovery", email: clean, options });
  const recoveryUrl = recovery.data?.properties?.action_link || "";
  if (recoveryUrl) return { ok: true, url: recoveryUrl };
  const inviteUrl = invited.data?.properties?.action_link || "";
  if (inviteUrl) return { ok: true, url: inviteUrl };
  return { ok: false, error: recovery.error?.message || inviteMessage || "set_password_link_unavailable" };
}

export type WelcomeUserRow = {
  id: number;
  email: string | null;
  full_name: string | null;
  plan: string | null;
  source: string | null;
  agency_name: string | null;
  agency_id: string | null;
  agency_id_basic: string | null;
  agency_id_advanced: string | null;
  agency_id_elite: string | null;
  created_at: string | null;
  welcome_ai_email_sent_at: string | null;
  hub_welcome_email_sent_at: string | null;
  hub_welcome_email_queued_at: string | null;
  welcome_email_attempts: number | null;
  welcome_email_next_attempt_at: string | null;
  welcome_email_claimed_at: string | null;
  welcome_email_force: boolean | null;
};

export function candidateFromRow(row: WelcomeUserRow): WelcomeCandidate {
  return {
    email: row.email,
    createdAt: row.created_at,
    welcomeSentAt: row.welcome_ai_email_sent_at,
    hubWelcomeSentAt: row.hub_welcome_email_sent_at,
    hubWelcomeQueuedAt: row.hub_welcome_email_queued_at,
    source: row.source,
    force: row.welcome_email_force === true,
    attempts: row.welcome_email_attempts ?? 0,
    nextAttemptAt: row.welcome_email_next_attempt_at,
    claimedAt: row.welcome_email_claimed_at,
  };
}

export type WelcomeDelivery = {
  email: string;
  status: "sent" | "failed" | "skipped" | "dry_run";
  reason: string | null;
};

export async function deliverWelcomeBatch(input: {
  rows: WelcomeUserRow[];
  nowMs: number;
  dryRun: boolean;
  claim: (row: WelcomeUserRow) => Promise<boolean>;
  authStatus: (email: string) => Promise<"auth" | "none" | "error">;
  issueLink: (email: string) => Promise<{ ok: true; url: string | null } | { ok: false; error: string }>;
  hubUrl: (row: WelcomeUserRow) => Promise<string | null>;
  post: (payload: WelcomeWebhookBody) => Promise<WebhookResult>;
  markSent: (row: WelcomeUserRow, nowIso: string, payload: WelcomeWebhookBody) => Promise<boolean>;
  markRetry: (row: WelcomeUserRow, plan: { attempts: number; retryAtMs: number; exhausted: boolean }, error: string) => Promise<void>;
  markTerminal: (row: WelcomeUserRow, update: { attempts: number; lastError: string }) => Promise<void>;
}): Promise<WelcomeDelivery[]> {
  const results: WelcomeDelivery[] = [];
  for (const row of input.rows) {
    const email = String(row.email ?? "").trim().toLowerCase();
    const decision = pendingWelcomeDecision(candidateFromRow(row), input.nowMs);
    if (!decision.send) {
      const terminal = terminalSkipUpdate(decision.reason);
      if (terminal) await input.markTerminal(row, terminal);
      results.push({ email, status: "skipped", reason: decision.reason });
      continue;
    }
    if (input.dryRun) {
      results.push({ email, status: "dry_run", reason: null });
      continue;
    }
    const claimed = await input.claim(row);
    if (!claimed) {
      results.push({ email, status: "skipped", reason: "claimed" });
      continue;
    }
    const fail = async (error: string) => {
      await input.markRetry(row, welcomeRetryPlan(row.welcome_email_attempts ?? 0, input.nowMs), error);
      results.push({ email, status: "failed", reason: error });
    };
    const auth = await input.authStatus(email);
    if (auth === "error") {
      await fail("auth_status_unavailable");
      continue;
    }
    let setPasswordUrl: string | null = null;
    let hasAuthLogin = auth === "auth";
    if (!hasAuthLogin) {
      const link = await input.issueLink(email);
      if (!link.ok) {
        await fail(link.error);
        continue;
      }
      if (link.url) setPasswordUrl = link.url;
      else hasAuthLogin = true;
    }
    const agencyId = welcomeHubAgencyId(row);
    const named = !!String(row.agency_name ?? "").trim();
    const hubUrl = named && agencyId ? await input.hubUrl(row) : null;
    const payload = buildAccountWelcomePayload({
      email,
      fullName: row.full_name,
      plan: row.plan,
      hubUrl,
      setPasswordUrl,
      hasAuthLogin,
    });
    const posted = await input.post(payload);
    if (!posted.ok) {
      const reason = posted.status ? `webhook_http_${posted.status}` : "webhook_error";
      await fail(posted.error ? `${reason}: ${posted.error}` : reason);
      continue;
    }
    const stamped = await input.markSent(row, new Date(input.nowMs).toISOString(), payload);
    if (!stamped) {
      results.push({ email, status: "failed", reason: "stamp_failed" });
      continue;
    }
    results.push({ email, status: "sent", reason: null });
  }
  return results;
}

/** Where a kit magic link and the thank-you button land after sign-in. */
export const KIT_LOGIN_REDIRECT = "https://saassuite.ai/app/dashboard?view=kit";
export const KIT_LOGIN_SUBJECT = "Your One Feature Kit is ready";

const esc = (value: string) =>
  value.replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch] ?? ch));

export function kitLoginHtml(name: string, actionLink: string): string {
  const greet = name.trim() ? `Hi ${esc(name.trim())},` : "Hi,";
  return `<div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;padding:24px;color:#111">
<p>${greet}</p>
<p>Your One Feature Kit is ready. This link sets your password if you don't have one yet, then opens the kit. If you already have a password, it signs you in.</p>
<p style="text-align:center;margin:32px 0"><a href="${esc(actionLink)}" style="background:#111;color:#fff;padding:14px 28px;border-radius:8px;text-decoration:none;font-weight:bold">Set your password and open the kit</a></p>
<p style="font-size:12px;color:#666">The link expires soon. You can also sign in at https://saassuite.ai/signup with this same email.</p>
</div>`;
}

export type KitLoginLink = { userId: string; actionLink: string };

export type KitLoginAdmin = {
  generateLink(args: {
    type: "invite" | "magiclink";
    email: string;
    options: { redirectTo: string; data?: Record<string, string> };
  }): Promise<{
    data: { properties?: { action_link?: string | null } | null; user?: { id?: string | null } | null } | null;
    error: { message?: string } | null;
  }>;
};

/** Invite a new buyer. An existing account gets a magic link to the same kit page. */
export async function issueKitLoginLink(admin: KitLoginAdmin, email: string, name: string): Promise<KitLoginLink> {
  const clean = email.trim().toLowerCase();
  if (!clean.includes("@")) throw new Error("Buyer email is missing");
  const options = { redirectTo: KIT_LOGIN_REDIRECT, data: { full_name: name.trim(), source: "one-feature-kit" } };
  const invited = await admin.generateLink({ type: "invite", email: clean, options });
  const issued = invited.error || !invited.data?.properties?.action_link
    ? await admin.generateLink({ type: "magiclink", email: clean, options })
    : invited;
  const actionLink = issued.data?.properties?.action_link ?? "";
  const userId = issued.data?.user?.id ?? "";
  if (!actionLink || !userId) throw new Error("Kit login link unavailable");
  return { userId, actionLink };
}

export type KitLoginClaim = { completed: boolean } | null;

/** Supabase invite and magic links use the project OTP window, one hour by default. */
export const KIT_LOGIN_LINK_TTL_MS = 50 * 60 * 1000;

export type KitStoredLogin = { userId: string; actionLink: string; issuedAt: string };

export type KitBuyerContext = {
  name: string;
  metadata: Record<string, string | null | undefined> | null;
};

export type KitLoginDelivery = {
  checkoutId: string;
  email: string;
  name: string;
  metadata?: Record<string, string | null | undefined> | null;
  claim: (key: string) => Promise<boolean | null>;
  readClaim: (key: string) => Promise<KitLoginClaim>;
  releaseClaim: (key: string) => Promise<void>;
  /**
   * Not used. Minting the link does not mean the login email was delivered.
   * `kit-login:<checkout>` is marked completed only after GoHighLevel returns 2xx.
   */
  completeClaim?: (key: string) => Promise<void>;
  admin: KitLoginAdmin;
  ensureStarter: (email: string, context: KitBuyerContext) => Promise<void>;
  linkUser: (email: string, userId: string) => Promise<void>;
  /**
   * Ignored. A completed login row stays completed when the stored magic link
   * expires. GoHighLevel already sent login_url.
   */
  reopenClaim?: (key: string) => Promise<void>;
  /** A login link saved on an earlier attempt for this checkout. */
  readStoredLogin?: () => Promise<KitStoredLogin | null>;
  rememberLogin?: (login: KitStoredLogin) => Promise<void>;
  /** Test clock. Production uses Date.now. */
  now?: number;
};

export function kitStoredLoginStillValid(login: KitStoredLogin, now = Date.now(), ttlMs = KIT_LOGIN_LINK_TTL_MS): boolean {
  const issued = Date.parse(login.issuedAt);
  if (!Number.isFinite(issued)) return false;
  const age = now - issued;
  return age >= 0 && age < ttlMs;
}

/** Parse a login link stored on the kit-login claim. Payment-intent ids are ignored. */
export function parseStoredKitLogin(raw: string | null | undefined): KitStoredLogin | null {
  if (!raw || !raw.startsWith("{")) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<KitStoredLogin>;
    if (typeof parsed.userId !== "string" || typeof parsed.actionLink !== "string" || typeof parsed.issuedAt !== "string") return null;
    if (!/^[A-Za-z0-9_-]{1,64}$/.test(parsed.userId)) return null;
    if (parsed.actionLink.length > 2000) return null;
    const url = new URL(parsed.actionLink);
    if (url.protocol !== "https:") return null;
    if (!Number.isFinite(Date.parse(parsed.issuedAt))) return null;
    return { userId: parsed.userId, actionLink: parsed.actionLink, issuedAt: parsed.issuedAt };
  } catch {
    return null;
  }
}

export type KitLoginResult = {
  ok: true;
  /** Always false. GoHighLevel sends the login email from the purchase webhook. */
  emailed: false;
  userId: string | null;
  /** Magic link from this attempt. A repeat delivery reuses one that is still valid. */
  actionLink: string | null;
  /** Signup URL that does not expire. The purchase webhook sends this as login_url. */
  signInUrl: string;
  duplicate?: boolean;
  skipped?: string;
};

/** Same signup link the thank-you button uses when a fresh magic link is not available. */
export function kitBuyerSignInUrl(email: string): string {
  const clean = email.trim().toLowerCase();
  const next = encodeURIComponent("/app/dashboard?view=kit");
  return `https://saassuite.ai/signup?email=${encodeURIComponent(clean)}&next=${next}`;
}

/** Action row that ops reads as "login done" for one checkout. */
export function kitLoginActionKey(checkoutId: string): string {
  return `kit-login:${checkoutId}`;
}

/**
 * True only when this attempt's GoHighLevel kit_purchased POST returned 2xx.
 * A timeout, a network error, and a non-2xx leave the login row incomplete.
 */
export async function completeKitLoginAfterGhl(input: {
  checkoutId: string;
  outcome: string;
  markCompleted: (key: string) => Promise<void>;
}): Promise<boolean> {
  if (input.outcome !== "sent") return false;
  await input.markCompleted(kitLoginActionKey(input.checkoutId));
  return true;
}

/**
 * Mint or reuse the buyer's sign-in link. This does not send email and does not
 * mark kit-login completed. GoHighLevel sends login_url (durable) and magic_link
 * (this action link) from kit_purchased. That row is completed only after a 2xx.
 * A stored link inside the mailer window is reused. An expired one is minted again.
 */
export async function deliverKitBuyerLogin(input: KitLoginDelivery): Promise<KitLoginResult> {
  const email = input.email.trim().toLowerCase();
  if (!email.includes("@")) throw new Error("Buyer email is missing");
  const key = kitLoginActionKey(input.checkoutId);
  const now = input.now ?? Date.now();
  const signInUrl = kitBuyerSignInUrl(email);
  const stored = await reuseKitLogin(input, now);
  if (stored) {
    try {
      await input.ensureStarter(email, { name: input.name, metadata: input.metadata ?? null });
    } catch {
      /* The account row is repaired on the thank-you verify or a later delivery. */
    }
    try {
      await input.linkUser(email, stored.userId);
    } catch {
      /* kit_purchases.user_id is filled on the next delivery. */
    }
    return { ok: true, emailed: false, userId: stored.userId, actionLink: stored.actionLink, signInUrl, duplicate: true };
  }
  const claimed = await input.claim(key);
  if (claimed === null) throw new Error("Kit login claim failed");
  if (!claimed) {
    const prior = await input.readClaim(key);
    if (prior?.completed) return { ok: true, emailed: false, userId: null, actionLink: null, signInUrl, duplicate: true };
    return { ok: true, emailed: false, userId: null, actionLink: null, signInUrl, skipped: "in progress" };
  }
  try {
    const link = await issueKitLoginLink(input.admin, email, input.name);
    try {
      await input.rememberLogin?.({ userId: link.userId, actionLink: link.actionLink, issuedAt: new Date(now).toISOString() });
    } catch {
      /* A later retry can mint again if the link was not stored. */
    }
    try {
      await input.ensureStarter(email, { name: input.name, metadata: input.metadata ?? null });
    } catch {
      /* The account row is repaired on the thank-you verify or a later delivery. */
    }
    try {
      await input.linkUser(email, link.userId);
    } catch {
      /* kit_purchases.user_id is filled on the next delivery. */
    }
    return { ok: true, emailed: false, userId: link.userId, actionLink: link.actionLink, signInUrl };
  } catch (error) {
    await input.releaseClaim(key);
    throw error;
  }
}

async function reuseKitLogin(input: KitLoginDelivery, now: number): Promise<KitLoginLink | null> {
  if (!input.readStoredLogin) return null;
  try {
    const stored = await input.readStoredLogin();
    if (!stored || !kitStoredLoginStillValid(stored, now)) return null;
    return { userId: stored.userId, actionLink: stored.actionLink };
  } catch {
    return null;
  }
}

/**
 * Lynkific, Slack, and the Purchase event run even when one of them throws.
 * The Stripe webhook returns 200 after this. GoHighLevel sends the login email.
 */
export async function fulfillKitCheckout(input: {
  deliverLynkific: () => Promise<void>;
  notify: () => Promise<void>;
  emitPurchase: () => Promise<void>;
  onLynkificError?: (error: unknown) => void;
  onNotifyError?: (error: unknown) => void;
  onPurchaseError?: (error: unknown) => void;
}): Promise<{ ok: true }> {
  try {
    await input.deliverLynkific();
  } catch (error) {
    input.onLynkificError?.(error);
  }
  try {
    await input.notify();
  } catch (error) {
    input.onNotifyError?.(error);
  }
  try {
    await input.emitPurchase();
  } catch (error) {
    input.onPurchaseError?.(error);
  }
  return { ok: true };
}

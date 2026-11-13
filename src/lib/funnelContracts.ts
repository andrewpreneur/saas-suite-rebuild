import { GHL_AFFILIATE_SIGNUP_URL, GHL_AFFILIATE_TRIAL_URL } from "@/constants/ghlAffiliate";

/** Outcome-led headline A for /onefeaturetraining-5. */
export const OUTCOME_HEADLINE_A =
  "Sell ONE GoHighLevel Feature as Your Own Software, and We'll Set It Up For You";

/** Locked SMS line under the Agents phone submit button. Sent to GHL only on final submit. */
export const AGENTS_SMS_CONSENT_TEXT =
  "By submitting, you agree SaaSSuite may text you about your application and the beta. Msg & data rates may apply. Reply STOP to opt out.";

/** SMS prefill on /founders-plan. The founder affiliate link is texted after, never shown on the page. */
export const FOUNDERS_PLAN_TEXT_US_BODY = "I have a question about the Founders Plan:";

/** Visible label for every /founders-plan Text Us control. */
export const FOUNDERS_PLAN_TEXT_US_LABEL = "Text Us to Learn More";

/**
 * Primary CTA href. Uses the `?&body=` shape from the Illegal text-us lander.
 * supportSmsUrl emits `?body=`, which is not this locked ad href.
 */
export const FOUNDERS_PLAN_TEXT_US_HREF =
  "sms:+13372270501?&body=" + encodeURIComponent(FOUNDERS_PLAN_TEXT_US_BODY);

/** Visible under the phone field on /founders-plan. Stored with the lead on submit. */
export const FOUNDERS_PLAN_SMS_CONSENT_TEXT =
  "By submitting, you agree we may text you about your bonuses and setup. Msg/data rates may apply. Reply STOP to opt out.";

/** Email line under the work-with-us submit button. */
export const WORK_WITH_US_EMAIL_CONSENT_TEXT =
  "By submitting, you agree SaaSSuite may email you about your application.";

/** Set on Work With Us OTP metadata so the starter trigger skips this lead. The quiz does not set it. */
export const WWU_SIGNUP_SOURCE = "work_with_us";

export const TRAINING_PAGE_RE = /^onefeaturetraining-(?:\d+|success|quiz)$/;

export function trainingPageAllowed(page: string): boolean {
  return TRAINING_PAGE_RE.test(page);
}

const PAID_SOCIAL_SESSION_KEY = "ss_paid_social";

function paidSocialStorage(): Storage | null {
  try {
    return typeof sessionStorage === "undefined" ? null : sessionStorage;
  } catch {
    return null;
  }
}

/** Facebook/Meta signals only. A bare paid medium (cpc, paid, paid_social) does not qualify. */
export function isPaidSocialVisit(search: string): boolean {
  const params = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
  const source = (params.get("utm_source") || "").toLowerCase();
  if (params.get("fbclid")) return true;
  return ["facebook", "fb", "meta", "instagram", "ig"].includes(source);
}

/** Remember a Meta landing so a later page without the query still uses Russell's link. */
export function rememberPaidSocial(search: string) {
  if (!isPaidSocialVisit(search)) return;
  paidSocialStorage()?.setItem(PAID_SOCIAL_SESSION_KEY, "1");
}

export function paidSocialActive(search: string): boolean {
  if (isPaidSocialVisit(search)) {
    rememberPaidSocial(search);
    return true;
  }
  return paidSocialStorage()?.getItem(PAID_SOCIAL_SESSION_KEY) === "1";
}

export function ghlAffiliateUrl(search: string): string {
  return paidSocialActive(search) ? GHL_AFFILIATE_SIGNUP_URL : GHL_AFFILIATE_TRIAL_URL;
}

/**
 * Facebook/Meta uses Russell's existing signup link.
 * Everyone else uses the existing andrewgeorge trial URL. Never a placeholder token.
 */
export function trainingGhlHref(search: string): string {
  return paidSocialActive(search) ? GHL_AFFILIATE_SIGNUP_URL : GHL_AFFILIATE_TRIAL_URL;
}

export type MetaInAppKind = "facebook" | "instagram" | "messenger" | "threads";

/**
 * Meta in-app browsers. fbclid alone does not count: it stays after "Open in browser".
 * `?iab=1` / `?iab=0` apply only when preview is true, never on production hosts.
 */
export function detectMetaInAppBrowser(input: {
  userAgent: string;
  search?: string;
  referrer?: string;
  preview?: boolean;
}): MetaInAppKind | null {
  const ua = input.userAgent || "";
  const params = new URLSearchParams((input.search || "").replace(/^\?/, ""));
  if (input.preview && params.has("iab")) return params.get("iab") === "1" ? "facebook" : null;
  if (/Instagram/i.test(ua)) return "instagram";
  if (/Barcelona/i.test(ua)) return "threads";
  if (/MessengerForiOS|MessengerLite|FB_IAB\/MESSENGER|Orca-Android/i.test(ua)) return "messenger";
  if (/FBAN|FBAV|FBIOS|FB4A|FB_IAB|FBSV|FBDV|FBMD|FBCR|FBLC|FBBV/i.test(ua)) return "facebook";
  const fromMeta = params.has("fbclid") || /facebook|instagram/i.test(input.referrer || "");
  const androidWebView = /Android/i.test(ua) && /; wv\)/.test(ua);
  const iosWebView =
    /iPhone|iPad|iPod/i.test(ua) && !/Safari\//i.test(ua) && !/CriOS|FxiOS|EdgiOS/i.test(ua);
  if (fromMeta && (androidWebView || iosWebView)) return "facebook";
  return null;
}

export function isMetaInAppBrowser(userAgent: string): boolean {
  return detectMetaInAppBrowser({ userAgent }) !== null;
}

/** Production hosts ignore the ?iab= preview switch. */
export function wwuPreviewHost(hostname: string): boolean {
  const host = (hostname || "").toLowerCase();
  return host !== "saassuite.ai" && host !== "www.saassuite.ai";
}

/** US 10-digit numbers become +1. A leading + must already be E.164. */
export function toE164(raw: string): string | null {
  const trimmed = (raw || "").trim();
  const digits = trimmed.replace(/\D/g, "");
  if (trimmed.startsWith("+")) {
    const e164 = `+${digits}`;
    return /^\+[1-9]\d{7,14}$/.test(e164) ? e164 : null;
  }
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return null;
}

export const LEAD_ONLY_META_KEY = "ss_lead_only";

/** SMS prefill on /one-feature-away. The keyword routes the text to the challenge workflow on the Founders number. */
export const ONE_FEATURE_AWAY_TEXT_US_BODY =
  "CHALLENGE - I want to join the One Feature Away challenge";

/** Every /one-feature-away CTA opens a text to the Founders number. */
export const ONE_FEATURE_AWAY_TEXT_US_HREF =
  "sms:+13372270501?&body=" + encodeURIComponent(ONE_FEATURE_AWAY_TEXT_US_BODY);

/**
 * SnapMe buttons (slugs from SnapMe's Buttons screen) that replace the pages' own "text us" buttons.
 * SnapMe opens the text to +1 337-227-0501 and reports the tap and the text-in to Meta (Conversions API).
 * Leave a slug empty to keep the page's own button.
 */
export const SNAPME_BUTTONS = {
  oneFeatureAway: "untitled-fsmgyib",
  blackFriday: "untitled-2p4enkf",
} as const;

/**
 * /skool-challenge: the One Feature Away challenge run inside the SaaS and AI Mastery community on Skool.
 * Set SKOOL_CHALLENGE_URL to the Skool join link when it exists; until then every CTA texts the Founders number
 * with the SKOOL keyword so no visitor hits a dead button.
 */
export const SKOOL_CHALLENGE_URL = "";

/** SnapMe button (Buttons screen, "Skool") shown until SKOOL_CHALLENGE_URL is set. Texts +1 337-227-0501; SnapMe reports it to Meta. */
export const SKOOL_SNAPME_BUTTON = "untitled-la695gl";

export const SKOOL_CHALLENGE_TEXT_US_BODY =
  "SKOOL - I want to join the One Feature Away challenge on Skool";

export const SKOOL_CHALLENGE_HREF =
  SKOOL_CHALLENGE_URL ||
  "sms:+13372270501?&body=" + encodeURIComponent(SKOOL_CHALLENGE_TEXT_US_BODY);

/** SMS prefill on /black-friday until the Stripe link for the $1,997 annual deal is set. */
export const BLACK_FRIDAY_TEXT_US_BODY = "BLACKFRIDAY - I want the $1,997 SaaSSuite annual deal";

export const BLACK_FRIDAY_TEXT_US_HREF =
  "sms:+13372270501?&body=" + encodeURIComponent(BLACK_FRIDAY_TEXT_US_BODY);

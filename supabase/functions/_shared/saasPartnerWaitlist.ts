/**
 * Pure validation for the public SaaS directory waitlist.
 * The edge function and the page both use this module. It does not touch the network.
 */

export const SAAS_PARTNER_MIN_FILL_MS = 1500;
export const SAAS_PARTNER_MAX_AGE_MS = 48 * 60 * 60 * 1000;
export const SAAS_PARTNER_RATE_LIMIT = 5;
export const SAAS_PARTNER_RATE_WINDOW_MS = 15 * 60 * 1000;
export const SAAS_PARTNER_MAX_LOGO_BYTES = 2 * 1024 * 1024;
export const SAAS_PARTNER_BUCKET = "saas-partner-logos";
export const SAAS_PARTNER_SOURCE = "saaspartner_page";
export const SAAS_PARTNER_WEBHOOK_ENV = "GHL_SAAS_PARTNER_WEBHOOK_URL";
export const SAAS_PARTNER_WEBHOOK_EVENT = "saassuite.saas_partner_waitlist";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const UTM_KEYS = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"] as const;

export type SaasPartnerUtmKey = (typeof UTM_KEYS)[number];

export type SaasPartnerField =
  | "business_name"
  | "website"
  | "contact_name"
  | "email"
  | "phone"
  | "affiliate_link"
  | "logo"
  | "started_at";

export type SaasPartnerLogoType = "image/png" | "image/jpeg" | "image/webp" | "image/svg+xml";

export type SaasPartnerLogo = {
  bytes: Uint8Array;
  contentType: SaasPartnerLogoType;
  ext: "png" | "jpg" | "webp" | "svg";
};

export type SaasPartnerRow = {
  business_name: string;
  website: string;
  contact_name: string;
  email: string;
  phone: string;
  affiliate_link: string | null;
  source: string;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  utm_content: string | null;
  utm_term: string | null;
};

export type SaasPartnerDecision =
  | { kind: "honeypot" }
  | {
      kind: "invalid";
      status: 400;
      error: string;
      field?: SaasPartnerField;
      fields: Partial<Record<SaasPartnerField, string>>;
    }
  | { kind: "ok"; row: SaasPartnerRow; logo: SaasPartnerLogo | null };

const FIELD_ORDER: SaasPartnerField[] = [
  "business_name",
  "website",
  "contact_name",
  "email",
  "phone",
  "affiliate_link",
  "logo",
  "started_at",
];

export function normalizeHttpUrl(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed || trimmed.length > 500 || /\s/.test(trimmed)) return null;
  const withScheme = /^[a-z][a-z0-9+.-]*:/i.test(trimmed) ? trimmed : `https://${trimmed}`;
  let url: URL;
  try {
    url = new URL(withScheme);
  } catch {
    return null;
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return null;
  if (url.username || url.password) return null;
  const host = url.hostname.replace(/\.$/, "");
  if (!host || host === "localhost" || !host.includes(".")) return null;
  url.hostname = host;
  return url.toString();
}

export function normalizePhone(raw: string): string | null {
  const trimmed = raw.trim().replace(/\s+/g, " ");
  if (!trimmed || trimmed.length > 40) return null;
  if (!/^[+()\d][+\d().\-\s]*$/.test(trimmed)) return null;
  const digits = trimmed.replace(/\D/g, "");
  if (digits.length < 7 || digits.length > 15) return null;
  return trimmed;
}

/** Reject SVG that can run script or pull in remote documents. Simple drawings pass through. */
export function sanitizeSvg(source: string): string | null {
  const text = source.replace(/^\uFEFF/, "").trim();
  if (!text || text.length > SAAS_PARTNER_MAX_LOGO_BYTES) return null;
  if (!/^<\?xml[\s>]|^<svg[\s>]/i.test(text)) return null;
  if (!/<svg[\s>]/i.test(text)) return null;
  if (/<!DOCTYPE|<!ENTITY/i.test(text)) return null;
  if (/<(script|foreignObject|iframe|embed|object|link|meta|image|set|animate)\b/i.test(text)) return null;
  if (/\son[a-z]+\s*=/i.test(text)) return null;
  if (/javascript:|vbscript:|data:text\/html|expression\s*\(/i.test(text)) return null;
  if (/@import/i.test(text)) return null;
  if (/url\s*\(/i.test(text)) return null;
  if (/\b(?:xlink:href|href|src)\s*=\s*["'](?!#)/i.test(text)) return null;
  if (/\b(?:xlink:href|href|src)\s*=\s*(?!["'#])/i.test(text)) return null;
  return text;
}

export function bytesToBase64(bytes: Uint8Array): string {
  const chunk = 0x4000;
  let binary = "";
  for (let i = 0; i < bytes.length; i += chunk) {
    const slice = bytes.subarray(i, i + chunk);
    const parts = new Array<string>(slice.length);
    for (let j = 0; j < slice.length; j++) parts[j] = String.fromCharCode(slice[j]);
    binary += parts.join("");
  }
  return btoa(binary);
}

export function decodeBase64(value: string): Uint8Array | null {
  const payload = value.replace(/^data:[^;]+;base64,/, "").replace(/\s/g, "");
  if (!payload || payload.length > 2_900_000) return null;
  if (!/^[A-Za-z0-9+/]+=*$/.test(payload)) return null;
  try {
    const binary = atob(payload);
    if (binary.length > SAAS_PARTNER_MAX_LOGO_BYTES) return null;
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return bytes;
  } catch {
    return null;
  }
}

function sniffLogo(bytes: Uint8Array): SaasPartnerLogo | null {
  if (bytes.length >= 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) {
    return { bytes, contentType: "image/png", ext: "png" };
  }
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return { bytes, contentType: "image/jpeg", ext: "jpg" };
  }
  if (
    bytes.length >= 12 &&
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  ) {
    return { bytes, contentType: "image/webp", ext: "webp" };
  }
  const text = new TextDecoder("utf-8", { fatal: false }).decode(bytes).replace(/^\uFEFF/, "").trim();
  if (!text.startsWith("<")) return null;
  const clean = sanitizeSvg(text);
  if (!clean) return null;
  return {
    bytes: new TextEncoder().encode(clean),
    contentType: "image/svg+xml",
    ext: "svg",
  };
}

function declaredMatches(declared: string, sniffed: SaasPartnerLogoType): boolean {
  const type = declared.toLowerCase().split(";")[0].trim();
  if (!type || type === "application/octet-stream") return true;
  if (type === "image/jpg" && sniffed === "image/jpeg") return true;
  if (type === "image/svg" && sniffed === "image/svg+xml") return true;
  return type === sniffed;
}

export function inspectLogo(
  bytes: Uint8Array,
  declared = "",
): { ok: true; logo: SaasPartnerLogo; error?: undefined } | { ok: false; logo?: undefined; error: string } {
  if (bytes.byteLength === 0) return { ok: false, error: "That logo file is empty." };
  if (bytes.byteLength > SAAS_PARTNER_MAX_LOGO_BYTES) {
    return { ok: false, error: "Logo must be a PNG, JPG, WEBP, or SVG under 2 MB." };
  }
  const sniffed = sniffLogo(bytes);
  if (!sniffed) {
    const text = new TextDecoder("utf-8", { fatal: false }).decode(bytes.slice(0, 200)).trim();
    if (text.startsWith("<") && /<svg/i.test(text)) {
      return { ok: false, error: "That SVG isn't allowed. Upload a PNG, JPG, WEBP, or a simple SVG logo." };
    }
    return { ok: false, error: "Upload a PNG, JPG, WEBP, or SVG logo." };
  }
  if (!declaredMatches(declared, sniffed.contentType)) {
    return { ok: false, error: "That file doesn't match its image type." };
  }
  return { ok: true, logo: sniffed };
}

function text(value: unknown): string {
  return typeof value === "string" ? value : value == null ? "" : String(value);
}

function clip(value: string, max: number): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.slice(0, max);
}

function invalid(fields: Partial<Record<SaasPartnerField, string>>): SaasPartnerDecision {
  const field = FIELD_ORDER.find((key) => fields[key]);
  return {
    kind: "invalid",
    status: 400,
    error: (field && fields[field]) || "Check the highlighted fields.",
    field,
    fields,
  };
}

export function evaluateSaasPartnerSubmission(input: Record<string, unknown>, nowMs: number): SaasPartnerDecision {
  if (text(input.company_url).trim() || text(input.ss_company_url).trim()) {
    return { kind: "honeypot" };
  }

  const fields: Partial<Record<SaasPartnerField, string>> = {};
  const business = text(input.business_name).trim().replace(/\s+/g, " ");
  if (business.length < 2 || business.length > 120) fields.business_name = "Enter your business name.";

  const website = normalizeHttpUrl(text(input.website));
  if (!website) fields.website = "Enter a valid website, including http or https.";

  const contact = text(input.contact_name).trim().replace(/\s+/g, " ");
  if (contact.length < 2 || contact.length > 120) fields.contact_name = "Enter your name.";

  const email = text(input.email).trim().toLowerCase();
  if (!EMAIL.test(email) || email.length > 320) fields.email = "Enter a valid email address.";

  const phone = normalizePhone(text(input.phone));
  if (!phone) fields.phone = "Enter a valid phone number.";

  const affiliateRaw = text(input.affiliate_link).trim();
  let affiliate: string | null = null;
  if (affiliateRaw) {
    affiliate = normalizeHttpUrl(affiliateRaw);
    if (!affiliate) fields.affiliate_link = "Enter a valid affiliate signup link, or leave it blank.";
  }

  let logo: SaasPartnerLogo | null = null;
  const declared = text(input.logo_content_type);
  if (input.logo_bytes instanceof Uint8Array) {
    const inspected = inspectLogo(input.logo_bytes, declared);
    if (!inspected.ok || !inspected.logo) fields.logo = inspected.error || "Upload a PNG, JPG, WEBP, or SVG logo.";
    else logo = inspected.logo;
  } else if (text(input.logo_base64).trim()) {
    const bytes = decodeBase64(text(input.logo_base64));
    if (!bytes) fields.logo = "Logo must be a PNG, JPG, WEBP, or SVG under 2 MB.";
    else {
      const inspected = inspectLogo(bytes, declared);
      if (!inspected.ok || !inspected.logo) fields.logo = inspected.error || "Upload a PNG, JPG, WEBP, or SVG logo.";
      else logo = inspected.logo;
    }
  }

  const started = Number(input.started_at);
  const elapsed = nowMs - started;
  if (!Number.isFinite(started) || elapsed < 0 || elapsed < SAAS_PARTNER_MIN_FILL_MS) {
    fields.started_at = "Please take a moment to check your details, then submit again.";
  } else if (elapsed > SAAS_PARTNER_MAX_AGE_MS) {
    fields.started_at = "Refresh the page and submit the form again.";
  }

  if (Object.keys(fields).length > 0) return invalid(fields);

  const utm = {} as Record<SaasPartnerUtmKey, string | null>;
  for (const key of UTM_KEYS) utm[key] = clip(text(input[key]), 200);

  return {
    kind: "ok",
    logo,
    row: {
      business_name: business,
      website: website as string,
      contact_name: contact,
      email,
      phone: phone as string,
      affiliate_link: affiliate,
      source: clip(text(input.source), 80) || SAAS_PARTNER_SOURCE,
      utm_source: utm.utm_source,
      utm_medium: utm.utm_medium,
      utm_campaign: utm.utm_campaign,
      utm_content: utm.utm_content,
      utm_term: utm.utm_term,
    },
  };
}

export function saasPartnerWebhookUrl(raw: string | null | undefined): string | null {
  const value = (raw ?? "").trim();
  if (!value) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:") return null;
    return url.toString();
  } catch {
    return null;
  }
}

export function saasPartnerWebhookBody(id: string, row: SaasPartnerRow, hasLogo: boolean, createdAt: string) {
  return {
    event: SAAS_PARTNER_WEBHOOK_EVENT,
    id,
    business_name: row.business_name,
    website: row.website,
    contact_name: row.contact_name,
    email: row.email,
    phone: row.phone,
    affiliate_link: row.affiliate_link || "",
    has_logo: hasLogo,
    source: row.source,
    utm_source: row.utm_source || "",
    utm_medium: row.utm_medium || "",
    utm_campaign: row.utm_campaign || "",
    utm_content: row.utm_content || "",
    utm_term: row.utm_term || "",
    created_at: createdAt,
  };
}

function headerValue(headers: { get(name: string): string | null }, name: string): string {
  return headers.get(name)?.trim() || "";
}

/**
 * Address used for the waitlist rate limit.
 * A platform sets cf-connecting-ip or x-real-ip. Otherwise the last
 * X-Forwarded-For hop is the one a proxy appended. The first hop is caller-controlled.
 */
export function saasPartnerClientIp(headers: { get(name: string): string | null }): string {
  const platform = headerValue(headers, "cf-connecting-ip") || headerValue(headers, "x-real-ip");
  if (platform) return platform;
  const hops = headerValue(headers, "x-forwarded-for")
    .split(",")
    .map((hop) => hop.trim())
    .filter(Boolean);
  return hops.length > 0 ? hops[hops.length - 1] : "unknown";
}

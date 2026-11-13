// Write checks for location-theme and theme-logo.
// Reads stay public. A claimed HighLevel type or role is not a login.
//
// HighLevel saves need the short-lived HMAC grant (THEME_SAVE_SECRET) that
// dynamic-styles puts in the agency script. The grant is scoped to one owner.
// Any plan id on that owner (agency_id, basic, advanced, elite) matches.
// The location is "*" because one script covers every sub-account.
// An expired grant, a grant for another owner, and a location-scoped grant
// for a different location stay rejected.
//
// When the page sends a HighLevel user id, that id is checked with this
// agency's stored HighLevel token. The user must be an agency user or a
// sub-account admin for that location. A user HighLevel rejects stays rejected.
//
// Current install tags often send no user id. The customizer reads the
// logged-in user from the HighLevel page. If that id is still missing, the
// grant is enough when the location belongs to the agency (the agency view
// counts). The grant is inside a public script, so this fallback is weaker
// than a confirmed user: anyone who can load that script can save until the
// grant expires. Another agency's grant does not work.
//
// SaaS Suite app saves skip the grant. They use the signed-in Supabase user,
// who must own the agency or be an accepted admin with branding edit.
//
// THEME_SAVE_SECRET is named here and read from the environment. This code
// does not create the secret.

export const THEME_SAVE_TTL_SECONDS = 2 * 60 * 60;
export const THEME_SAVE_BURST = 30;
export const THEME_SAVE_WINDOW_MS = 10 * 60 * 1000;
// Refresh a cached script before its grant is inside this window, so a reload
// is not handed a grant that will die while the sub-account tab stays open.
export const THEME_GRANT_REFRESH_MARGIN_SECONDS = 15 * 60;

const AGENCY_ID = /^[A-Za-z0-9][A-Za-z0-9_-]{0,80}$/;

const TOKEN_RE = /^[A-Za-z0-9_-]{10,400}\.[A-Za-z0-9_-]{10,200}$/;
const enc = new TextEncoder();

export interface ThemeSaveClaims {
  v: 1;
  a: string;
  loc: string;
  exp: number;
}

export interface HighlevelThemeUser {
  id: string;
  companyId: string;
  email: string | null;
  type: string;
  role: string;
  locationIds: string[];
}

export interface ThemeWriteFacts {
  rateLimited: boolean;
  originAllowed: boolean;
  supabaseEditor: boolean;
  supabaseEmail: string | null;
  supabaseUserId: string | null;
  secretConfigured: boolean;
  tokenOk: boolean;
  ghl: "disconnected" | "down" | "unknown-user" | "ready";
  editor: boolean;
  verifiedUserId: string | null;
  verifiedEmail: string | null;
  // True only when no user id was claimed and this location belongs to the agency.
  grantLocation: boolean;
}

export type ThemeWriteDecision =
  | { ok: true; via: "supabase" | "highlevel"; userId: string | null; email: string | null }
  | { ok: false; status: number; error: string };

function b64url(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromB64url(value: string) {
  const pad = value.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((value.length + 3) % 4);
  return Uint8Array.from(atob(pad), (c) => c.charCodeAt(0));
}

async function hmacKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]);
}

export async function signThemeSaveToken(
  agencyId: string,
  secret: string,
  nowSeconds = Math.floor(Date.now() / 1000),
  locationId = "*",
): Promise<string> {
  const claims: ThemeSaveClaims = {
    v: 1,
    a: agencyId,
    loc: locationId || "*",
    exp: nowSeconds + THEME_SAVE_TTL_SECONDS,
  };
  const body = b64url(enc.encode(JSON.stringify(claims)));
  const sig = new Uint8Array(await crypto.subtle.sign("HMAC", await hmacKey(secret), enc.encode(body)));
  return `${body}.${b64url(sig)}`;
}

export function readThemeGrantClaims(token: unknown): ThemeSaveClaims | null {
  if (typeof token !== "string" || !TOKEN_RE.test(token)) return null;
  try {
    const claims = JSON.parse(new TextDecoder().decode(fromB64url(token.slice(0, token.indexOf("."))))) as ThemeSaveClaims;
    if (claims?.v !== 1 || !AGENCY_ID.test(claims.a) || typeof claims.loc !== "string" || !Number.isFinite(claims.exp)) return null;
    return claims;
  } catch {
    return null;
  }
}

// Same owner, different plan slug. Both ids must be on that owner's row.
// An empty list only allows an exact slug match.
export function themeGrantCoversAgency(claimAgency: string, requestedAgency: string, ownerAgencyIds: readonly string[] = []): boolean {
  if (!AGENCY_ID.test(claimAgency) || !AGENCY_ID.test(requestedAgency)) return false;
  if (claimAgency === requestedAgency) return true;
  const owner = new Set(ownerAgencyIds.filter((id) => AGENCY_ID.test(id)));
  return owner.has(claimAgency) && owner.has(requestedAgency);
}

export function themeOwnerAgencyIds(
  requestedAgencyId: string,
  row: { agency_id?: string | null; agency_id_basic?: string | null; agency_id_advanced?: string | null; agency_id_elite?: string | null } | null | undefined,
): string[] {
  const ids = [requestedAgencyId, row?.agency_id, row?.agency_id_basic, row?.agency_id_advanced, row?.agency_id_elite]
    .map((id) => String(id ?? "").trim())
    .filter((id) => AGENCY_ID.test(id));
  return [...new Set(ids)];
}

export async function verifyThemeSaveToken(
  token: unknown,
  secret: string,
  agencyId: string,
  locationId: string,
  nowSeconds = Math.floor(Date.now() / 1000),
  ownerAgencyIds: readonly string[] = [],
): Promise<boolean> {
  if (!secret || typeof token !== "string" || !TOKEN_RE.test(token)) return false;
  const dot = token.indexOf(".");
  const body = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  try {
    const signature = new Uint8Array(fromB64url(sig));
    const ok = await crypto.subtle.verify("HMAC", await hmacKey(secret), signature, enc.encode(body));
    if (!ok) return false;
    const claims = JSON.parse(new TextDecoder().decode(fromB64url(body))) as ThemeSaveClaims;
    if (claims?.v !== 1 || !Number.isFinite(claims.exp) || claims.exp < nowSeconds) return false;
    if (!themeGrantCoversAgency(String(claims.a || ""), agencyId, ownerAgencyIds)) return false;
    return claims.loc === "*" || claims.loc === locationId;
  } catch {
    return false;
  }
}

export function themeSaveTokenForScript(token: string): string {
  return TOKEN_RE.test(token) ? token : "";
}

export function hostFromDomain(value: unknown): string | null {
  const raw = String(value ?? "").trim().toLowerCase();
  if (!raw) return null;
  try {
    const host = new URL(raw.includes("://") ? raw : `https://${raw}`).hostname;
    return /^[a-z0-9.-]+$/.test(host) ? host : null;
  } catch {
    return null;
  }
}

const PLATFORM_HOST = /(^|\.)(?:gohighlevel\.com|highlevel\.com|msgsndr\.com|leadconnectorhq\.com|saassuite\.ai)$/i;

export function themeSaveOriginAllowed(origin: string | null | undefined, extraHosts: Array<string | null>): boolean {
  if (!origin) return true;
  let host = "";
  try {
    host = new URL(origin).hostname.toLowerCase();
  } catch {
    return false;
  }
  if (host === "localhost" || host === "127.0.0.1") return true;
  if (PLATFORM_HOST.test(host)) return true;
  const known = extraHosts.filter((item): item is string => !!item);
  if (!known.length) return true;
  return known.includes(host);
}

export function themeSaveRateLimited(recentSuccessfulSaves: number): boolean {
  return recentSuccessfulSaves >= THEME_SAVE_BURST;
}

export function supabaseBrandingEditor(input: {
  email: string | null;
  ownerEmail: string | null;
  adminStatus: string | null;
  branding: unknown;
}): boolean {
  const email = String(input.email || "").trim().toLowerCase();
  const owner = String(input.ownerEmail || "").trim().toLowerCase();
  if (!email || !owner) return false;
  if (email === owner) return true;
  if (String(input.adminStatus || "").toLowerCase() !== "accepted") return false;
  const level = input.branding == null || input.branding === "" ? "edit" : String(input.branding).toLowerCase();
  return level === "edit";
}

export function readHighlevelUser(payload: unknown): HighlevelThemeUser | null {
  if (!payload || typeof payload !== "object") return null;
  const raw = payload as Record<string, unknown>;
  const user = raw.user && typeof raw.user === "object" ? raw.user as Record<string, unknown> : raw;
  const id = String(user.id || "").trim();
  if (!id) return null;
  const roles = user.roles && typeof user.roles === "object" ? user.roles as Record<string, unknown> : {};
  const fromRoles = Array.isArray(roles.locationIds) ? roles.locationIds : [];
  const fromUser = Array.isArray(user.locationIds) ? user.locationIds : [];
  const email = String(user.email || "").trim().toLowerCase();
  return {
    id,
    companyId: String(user.companyId || roles.companyId || "").trim(),
    email: email.includes("@") ? email : null,
    type: String(roles.type || user.type || "").trim().toLowerCase(),
    role: String(roles.role || user.role || "").trim().toLowerCase(),
    locationIds: [...fromRoles, ...fromUser].map((item) => String(item || "").trim()).filter(Boolean),
  };
}

export function highlevelEditorCanWrite(
  user: HighlevelThemeUser | null,
  companyId: string,
  locationId: string,
  locationInCompany: boolean,
): boolean {
  if (!user) return false;
  if (user.companyId && companyId && user.companyId !== companyId) return false;
  const editor = user.type === "agency" || user.role === "admin";
  if (!editor) return false;
  if (locationId === "agency") return user.type === "agency";
  if (user.locationIds.includes(locationId)) return true;
  return locationInCompany && (user.type === "agency" || user.role === "admin");
}

export function decideThemeWrite(facts: ThemeWriteFacts): ThemeWriteDecision {
  if (facts.rateLimited) {
    return { ok: false, status: 429, error: "Too many theme saves for this agency. Wait a few minutes and try again." };
  }
  if (!facts.originAllowed) {
    return { ok: false, status: 403, error: "This website is not allowed to save themes for this agency." };
  }
  if (facts.supabaseEditor) {
    return { ok: true, via: "supabase", userId: facts.supabaseUserId, email: facts.supabaseEmail };
  }
  if (!facts.secretConfigured) {
    return { ok: false, status: 503, error: "Shared theme saves are not configured yet." };
  }
  if (!facts.tokenOk) {
    return { ok: false, status: 403, error: "This theme save was not issued for this account. Refresh HighLevel and try again." };
  }
  if (facts.ghl === "disconnected") {
    return { ok: false, status: 403, error: "Connect HighLevel in SaaS Suite to save a shared theme from the CRM. A signed-in agency admin can still save from SaaS Suite." };
  }
  if (facts.ghl === "down") {
    return { ok: false, status: 503, error: "HighLevel could not confirm this user, so the shared theme was not saved." };
  }
  // No user id on the page. The grant plus a location in this agency is enough
  // for the current install tag. A confirmed non-editor does not reach this branch.
  if (!facts.editor && facts.ghl === "unknown-user" && facts.grantLocation) {
    return { ok: true, via: "highlevel", userId: null, email: null };
  }
  if (facts.ghl === "unknown-user" || !facts.editor) {
    return { ok: false, status: 403, error: "Only a confirmed agency user or sub-account admin can save a shared theme." };
  }
  return { ok: true, via: "highlevel", userId: facts.verifiedUserId, email: facts.verifiedEmail };
}

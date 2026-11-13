// Signed hub session pass. Portal customers sign in with email/name only (no
// Supabase auth), so after sign-in the server issues an HMAC-signed pass.
// Every server-side write derives the customer's identity from this pass,
// never from browser-sent emails, names or IDs.

export interface HubClaims {
  a: string;        // agency id
  u: string;        // user_progress.id
  e: string | null; // email
  n: string | null; // name
  iat: number;
  exp: number;
}

const TTL_SECONDS = 60 * 60 * 24 * 30; // 30 days, refreshed silently on each visit

const enc = new TextEncoder();
const b64url = (bytes: Uint8Array) =>
  btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const fromB64url = (s: string) => {
  const pad = s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4);
  return Uint8Array.from(atob(pad), (c) => c.charCodeAt(0));
};

let keyPromise: Promise<CryptoKey> | null = null;
const key = () => {
  if (!keyPromise) {
    const secret = Deno.env.get('HUB_SESSION_SECRET');
    if (!secret) throw new Error('HUB_SESSION_SECRET missing');
    keyPromise = crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);
  }
  return keyPromise;
};

export async function signHubToken(c: { a: string; u: string; e: string | null; n: string | null }): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const claims: HubClaims = { ...c, iat: now, exp: now + TTL_SECONDS };
  const body = b64url(enc.encode(JSON.stringify(claims)));
  const sig = new Uint8Array(await crypto.subtle.sign('HMAC', await key(), enc.encode(body)));
  return `${body}.${b64url(sig)}`;
}

export async function verifyHubToken(token: unknown): Promise<HubClaims | null> {
  if (typeof token !== 'string' || token.length > 4096) return null;
  const [body, sig] = token.split('.');
  if (!body || !sig) return null;
  try {
    const ok = await crypto.subtle.verify('HMAC', await key(), fromB64url(sig), enc.encode(body));
    if (!ok) return null;
    const claims = JSON.parse(new TextDecoder().decode(fromB64url(body))) as HubClaims;
    if (!claims?.a || !claims?.u || claims.exp < Math.floor(Date.now() / 1000)) return null;
    return claims;
  } catch {
    return null;
  }
}

/** Reads the pass from body.hub_token (or the x-hub-token header). */
export async function claimsFromRequest(req: Request, body?: any): Promise<HubClaims | null> {
  return verifyHubToken(body?.hub_token || req.headers.get('x-hub-token'));
}

/** The identifier the existing tables use: email if known, otherwise name. */
export const hubIdentifier = (c: HubClaims) => (c.e || c.n || '').trim();

export const cleanEmail = (v: unknown): string | null => {
  if (typeof v !== 'string') return null;
  const s = v.trim(); // case kept: existing rows are keyed by the email as typed
  return s.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s) ? s : null;
};
export const cleanName = (v: unknown): string | null => {
  if (typeof v !== 'string') return null;
  const s = v.trim().replace(/\s+/g, ' ');
  return s.length >= 1 && s.length <= 120 ? s : null;
};

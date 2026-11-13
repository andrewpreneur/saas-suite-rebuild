import {
  SAAS_PARTNER_BUCKET,
  SAAS_PARTNER_MAX_LOGO_BYTES,
  SAAS_PARTNER_RATE_LIMIT,
  SAAS_PARTNER_RATE_WINDOW_MS,
  SAAS_PARTNER_WEBHOOK_ENV,
  evaluateSaasPartnerSubmission,
  saasPartnerWebhookBody,
  saasPartnerWebhookUrl,
  type SaasPartnerRow,
} from "../_shared/saasPartnerWaitlist.ts";

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

export type SaasPartnerInsert = SaasPartnerRow & {
  id: string;
  logo_path: string | null;
  user_agent: string | null;
  ip_hash: string;
  status: "pending";
};

export type SaasPartnerStore = {
  countRecent(ipHash: string, sinceIso: string): Promise<{ count: number; error?: string }>;
  insert(row: SaasPartnerInsert): Promise<{ id?: string; error?: string; code?: string }>;
  uploadLogo(path: string, bytes: Uint8Array, contentType: string): Promise<{ error?: string }>;
  removeLogo(path: string): Promise<void>;
};

export type SaasPartnerHandlerEnv = {
  nowMs: number;
  webhookUrl: string | null;
  ip: string;
  userAgent: string;
  store: SaasPartnerStore | null;
};

export type SaasPartnerPoster = (url: string, body: string) => Promise<{ ok: boolean }>;

export async function hashIp(ip: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(ip));
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

const LOGO_TOO_LARGE = "Logo must be a PNG, JPG, WEBP, or SVG under 2 MB.";

type ParsedBody =
  | { ok: true; body: Record<string, unknown> }
  | { ok: false; error: string; field: "logo" };

/** Reads a logo only when its declared size is within the 2 MB cap. */
export async function logoBytesWithinLimit(file: {
  size: number;
  arrayBuffer: () => Promise<ArrayBuffer>;
}): Promise<Uint8Array | null> {
  if (file.size > SAAS_PARTNER_MAX_LOGO_BYTES) return null;
  return new Uint8Array(await file.arrayBuffer());
}

function multipartContentLength(req: Request): number | null {
  const type = req.headers.get("content-type") || "";
  if (!type.toLowerCase().includes("multipart/form-data")) return null;
  const raw = req.headers.get("content-length")?.trim() || "";
  if (!/^\d+$/.test(raw)) return null;
  const length = Number(raw);
  return Number.isFinite(length) ? length : null;
}

async function readBody(req: Request): Promise<ParsedBody> {
  const type = req.headers.get("content-type") || "";
  if (type.toLowerCase().includes("multipart/form-data")) {
    const length = multipartContentLength(req);
    if (length !== null && length > SAAS_PARTNER_MAX_LOGO_BYTES) {
      return { ok: false, error: LOGO_TOO_LARGE, field: "logo" };
    }
    const form = await req.formData();
    const body: Record<string, unknown> = {};
    for (const [key, value] of form.entries()) {
      if (typeof value === "string") body[key] = value;
    }
    const logo = form.get("logo");
    if (logo && typeof logo !== "string") {
      const bytes = await logoBytesWithinLimit(logo);
      if (!bytes) return { ok: false, error: LOGO_TOO_LARGE, field: "logo" };
      body.logo_bytes = bytes;
      body.logo_content_type = logo.type || body.logo_content_type;
    }
    return { ok: true, body };
  }
  const parsed = await req.json().catch(() => ({}));
  return {
    ok: true,
    body: parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : {},
  };
}

async function notify(
  webhookUrl: string | null,
  id: string,
  row: SaasPartnerRow,
  hasLogo: boolean,
  createdAt: string,
  postWebhook: SaasPartnerPoster,
) {
  const destination = saasPartnerWebhookUrl(webhookUrl);
  if (!destination) {
    const reason = (webhookUrl ?? "").trim()
      ? `${SAAS_PARTNER_WEBHOOK_ENV} is not https`
      : `${SAAS_PARTNER_WEBHOOK_ENV} not configured`;
    console.warn(`saas partner webhook skipped: ${reason}`);
    return;
  }
  const body = JSON.stringify(saasPartnerWebhookBody(id, row, hasLogo, createdAt));
  try {
    const result = await Promise.race([
      postWebhook(destination, body),
      new Promise<{ ok: boolean }>((resolve) => setTimeout(() => resolve({ ok: false }), 3000)),
    ]);
    if (!result.ok) console.warn("saas partner webhook failed");
  } catch (error) {
    console.warn("saas partner webhook failed", error instanceof Error ? error.name : "error");
  }
}

export async function handleSaasPartnerWaitlist(
  req: Request,
  env: SaasPartnerHandlerEnv,
  postWebhook: SaasPartnerPoster = async () => ({ ok: true }),
): Promise<Response> {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  let parsed: ParsedBody;
  try {
    parsed = await readBody(req);
  } catch {
    return json({ error: "Check the form and try again." }, 400);
  }
  if (!parsed.ok) {
    return json({ error: parsed.error, field: parsed.field, fields: { logo: parsed.error } }, 400);
  }
  const body = parsed.body;

  const decision = evaluateSaasPartnerSubmission(body, env.nowMs);
  if (decision.kind === "honeypot") return json({ ok: true });
  if (decision.kind === "invalid") {
    return json({ error: decision.error, field: decision.field, fields: decision.fields }, decision.status);
  }
  if (!env.store) return json({ error: "We couldn't add you to the waitlist. Please try again." }, 500);

  const ipHash = await hashIp(env.ip || "unknown");
  const since = new Date(env.nowMs - SAAS_PARTNER_RATE_WINDOW_MS).toISOString();
  const recent = await env.store.countRecent(ipHash, since);
  if (recent.error) return json({ error: "We couldn't add you to the waitlist. Please try again." }, 500);
  if (recent.count >= SAAS_PARTNER_RATE_LIMIT) {
    return json({ error: "Too many requests. Please wait and try again." }, 429);
  }

  const id = crypto.randomUUID();
  const logo = decision.logo;
  const logoPath = logo ? `${id}.${logo.ext}` : null;
  if (logo && logoPath) {
    const uploaded = await env.store.uploadLogo(logoPath, logo.bytes, logo.contentType);
    if (uploaded.error) {
      console.warn("saas partner logo upload failed");
      return json({ error: "We couldn't save that logo. Please try again.", field: "logo" }, 500);
    }
  }

  const userAgent = env.userAgent.trim().slice(0, 500) || null;
  const inserted = await env.store.insert({
    id,
    ...decision.row,
    logo_path: logoPath,
    user_agent: userAgent,
    ip_hash: ipHash,
    status: "pending",
  });
  if (inserted.error) {
    if (logoPath) await env.store.removeLogo(logoPath);
    if (inserted.code === "23505") {
      return json(
        {
          error: "This business is already on the waitlist.",
          field: "email",
          fields: { email: "This business is already on the waitlist." },
        },
        409,
      );
    }
    console.warn("saas partner insert failed");
    return json({ error: "We couldn't add you to the waitlist. Please try again." }, 500);
  }

  const createdAt = new Date(env.nowMs).toISOString();
  await notify(env.webhookUrl, inserted.id || id, decision.row, Boolean(logoPath), createdAt, postWebhook);
  return json({ ok: true, id: inserted.id || id });
}

export { SAAS_PARTNER_BUCKET };

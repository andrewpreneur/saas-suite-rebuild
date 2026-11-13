import { applyMessageStatus } from "../_shared/journey-log.ts";
import { normalizeMessageStatus, type MessageStatus } from "../_shared/message-status.ts";

/**
 * Optional inbound status hook for GoHighLevel workflow delivery updates.
 * It stays inert until MESSAGE_STATUS_WEBHOOK_SECRET is set. The caller
 * sends Authorization: Bearer <secret>. A bad or missing secret never
 * changes a send that already happened.
 */

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function firstEmail(value: unknown): string | null {
  if (typeof value === "string" && value.includes("@")) return value;
  if (Array.isArray(value)) {
    const found = value.find((item) => typeof item === "string" && item.includes("@"));
    return typeof found === "string" ? found : null;
  }
  return null;
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ ok: false, error: "method_not_allowed" }, 405);

  const statusSecret = Deno.env.get("MESSAGE_STATUS_WEBHOOK_SECRET")?.trim() ?? "";
  if (!statusSecret) {
    return json({ ok: false, ignored: true, reason: "not_configured" }, 401);
  }

  const bearer = req.headers.get("authorization") ?? "";
  if (!timingSafeEqual(bearer, `Bearer ${statusSecret}`)) {
    return json({ ok: false, error: "unauthorized" }, 401);
  }

  const body = await req.text();
  let payload: Record<string, unknown>;
  try {
    const parsed = JSON.parse(body);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return json({ ok: false, error: "invalid_json" }, 400);
    }
    payload = parsed as Record<string, unknown>;
  } catch {
    return json({ ok: false, error: "invalid_json" }, 400);
  }

  const status: MessageStatus | null = normalizeMessageStatus(payload.status);
  if (!status) return json({ ok: false, error: "unknown_status" }, 400);
  const email = firstEmail(payload.email) ?? firstEmail(payload.user_email);
  const messageId = typeof payload.message_id === "string"
    ? payload.message_id
    : typeof payload.provider_message_id === "string"
      ? payload.provider_message_id
      : null;
  if (!messageId && !email) return json({ ok: false, error: "missing_identity" }, 400);
  const channel = payload.channel === "sms" || payload.channel === "webhook" || payload.channel === "email"
    ? payload.channel
    : "email";
  const result = await applyMessageStatus({
    provider: typeof payload.provider === "string" && payload.provider.trim() ? payload.provider : "ghl",
    providerMessageId: messageId,
    userEmail: email,
    status,
    channel,
    templateKey: typeof payload.template === "string"
      ? payload.template
      : typeof payload.template_key === "string"
        ? payload.template_key
        : null,
    subject: typeof payload.subject === "string" ? payload.subject : null,
    detail: typeof payload.detail === "string" ? payload.detail : null,
  });
  return json({ ok: true, result });
});

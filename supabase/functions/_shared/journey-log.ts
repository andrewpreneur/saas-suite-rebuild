import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { normalizeMessageStatus, type MessageStatus } from "./message-status.ts";
import { metadataIsTest, missingIsTestColumn } from "./test-traffic.ts";

export type MessageChannel = "email" | "sms" | "webhook";

export type CustomerMessageInput = {
  userEmail?: string | null;
  channel: MessageChannel;
  templateKey?: string | null;
  subject?: string | null;
  provider?: string | null;
  providerMessageId?: string | null;
  status: MessageStatus;
  source: string;
  detail?: string | null;
  metadata?: Record<string, unknown> | null;
};

export type CheckoutSessionInput = {
  stripeCheckoutSessionId: string;
  email?: string | null;
  plan?: string | null;
  billingInterval?: "monthly" | "annual" | "one_time" | null;
  flow?:
    | "subscription"
    | "one_feature_kit"
    | "onboarding_call"
    | "course"
    | "addon"
    | "agency_support"
    | "autopay"
    | "copilot"
    | null;
  surface?: string | null;
  page?: string | null;
  button?: string | null;
  amountCents?: number | null;
  currency?: string | null;
  status: "open" | "completed" | "expired" | "abandoned" | "failed";
  metadata?: Record<string, unknown> | null;
  isTest?: boolean;
};

let checkoutIsTestColumn: "unknown" | "no" = "unknown";

function db(): SupabaseClient | null {
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

function text(value: unknown, max = 500): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, max) : null;
}

function compact(row: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(row)) {
    if (value !== undefined && value !== null && value !== "") out[key] = value;
  }
  return out;
}

export type MessageLogResult = { ok: true } | { ok: false; error: string };

/** Write one customer message row. Never throws, so a logging failure cannot fail a send. */
export async function logCustomerMessage(input: CustomerMessageInput): Promise<MessageLogResult> {
  const template = text(input.templateKey, 200) ?? "";
  const email = text(input.userEmail, 320)?.toLowerCase() ?? "";
  try {
    const client = db();
    if (!client) {
      const error = "missing Supabase credentials";
      console.error(`customer_message_events insert skipped template=${template} email=${email}: ${error}`);
      return { ok: false, error };
    }
    const status = normalizeMessageStatus(input.status);
    if (!status) {
      const error = "invalid status";
      console.error(`customer_message_events insert skipped template=${template} email=${email}: ${error}`);
      return { ok: false, error };
    }
    const row = compact({
      user_email: email || null,
      channel: input.channel,
      template_key: template || null,
      subject: text(input.subject, 500),
      provider: text(input.provider, 40),
      provider_message_id: text(input.providerMessageId, 200),
      status,
      source: text(input.source, 80) ?? "unknown",
      detail: text(input.detail, 500),
      metadata: input.metadata && typeof input.metadata === "object" ? input.metadata : {},
    });
    const { error } = await client.from("customer_message_events").insert(row);
    if (error) {
      console.error(
        `customer_message_events insert failed template=${row.template_key ?? template} email=${row.user_email ?? email}: ${error.message}`,
      );
      return { ok: false, error: error.message };
    }
    return { ok: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`customer_message_events insert failed template=${template} email=${email}: ${message}`);
    return { ok: false, error: message };
  }
}

/**
 * Apply a later provider status to the matching send, or insert a row when the
 * original send was not logged. Never throws.
 */
export async function applyMessageStatus(input: {
  provider: string;
  providerMessageId?: string | null;
  userEmail?: string | null;
  status: MessageStatus;
  channel?: MessageChannel;
  templateKey?: string | null;
  subject?: string | null;
  detail?: string | null;
}): Promise<"updated" | "inserted" | "ignored"> {
  try {
    const client = db();
    const status = normalizeMessageStatus(input.status);
    if (!client || !status) return "ignored";
    const provider = text(input.provider, 40);
    const messageId = text(input.providerMessageId, 200);
    const email = text(input.userEmail, 320)?.toLowerCase() ?? null;
    if (!provider || (!messageId && !email)) return "ignored";
    const stamp = new Date().toISOString();
    if (messageId) {
      const { data, error } = await client
        .from("customer_message_events")
        .update({
          status,
          detail: text(input.detail, 500),
          updated_at: stamp,
          status_at: stamp,
        })
        .eq("provider", provider)
        .eq("provider_message_id", messageId)
        .select("id");
      if (error) {
        console.error("customer_message_events status", error.message);
        return "ignored";
      }
      if (data && data.length > 0) return "updated";
    }
    const { error } = await client.from("customer_message_events").insert(compact({
      user_email: email,
      channel: input.channel ?? "email",
      template_key: text(input.templateKey, 200),
      subject: text(input.subject, 500),
      provider,
      provider_message_id: messageId,
      status,
      source: "message-status-webhook",
      detail: text(input.detail, 500),
      status_at: stamp,
    }));
    if (error) {
      console.error("customer_message_events status insert", error.message);
      return "ignored";
    }
    return "inserted";
  } catch (error) {
    console.error("customer_message_events status", error instanceof Error ? error.message : error);
    return "ignored";
  }
}

/** Record or update a Stripe Checkout Session. Never throws, so checkout still returns. */
export async function recordCheckoutSession(input: CheckoutSessionInput): Promise<void> {
  try {
    const client = db();
    const sessionId = text(input.stripeCheckoutSessionId, 200);
    if (!client || !sessionId) return;
    const isTest = input.isTest === true || metadataIsTest(input.metadata ?? null);
    const row = compact({
      stripe_checkout_session_id: sessionId,
      email: text(input.email, 320)?.toLowerCase() ?? null,
      plan: text(input.plan, 80),
      billing_interval: input.billingInterval ?? null,
      flow: input.flow ?? null,
      surface: text(input.surface, 200),
      page: text(input.page, 500),
      button: text(input.button, 80),
      amount_cents: typeof input.amountCents === "number" && Number.isFinite(input.amountCents)
        ? Math.round(input.amountCents)
        : null,
      currency: text(input.currency, 12)?.toLowerCase() ?? null,
      status: input.status,
      metadata: input.metadata && typeof input.metadata === "object" ? input.metadata : null,
      ...(input.status === "completed" ? { completed_at: new Date().toISOString() } : {}),
      updated_at: new Date().toISOString(),
    });
    if (isTest && checkoutIsTestColumn !== "no") row.is_test = true;
    const write = async (payload: Record<string, unknown>) => {
      const { data, error } = await client
        .from("checkout_sessions")
        .update(payload)
        .eq("stripe_checkout_session_id", sessionId)
        .select("stripe_checkout_session_id");
      if (error) return error;
      if (data && data.length > 0) return null;
      const inserted = await client.from("checkout_sessions").insert(payload);
      return inserted.error;
    };
    let error = await write(row);
    if (error && row.is_test === true && missingIsTestColumn(error)) {
      checkoutIsTestColumn = "no";
      const { is_test: _drop, ...rest } = row;
      error = await write(rest);
    }
    if (error) console.error("checkout_sessions", error.message);
  } catch (error) {
    console.error("checkout_sessions", error instanceof Error ? error.message : error);
  }
}

export function billingIntervalForPlan(plan: string): "monthly" | "annual" {
  if (plan === "special" || plan.endsWith("_annual")) return "annual";
  return "monthly";
}

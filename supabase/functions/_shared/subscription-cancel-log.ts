/**
 * Cancel tracking for stripe-subscription-webhook.
 * Billing and access stay in the webhook. This module only records the event
 * and, when this webhook is the sender, posts the existing GoHighLevel cancel hook.
 */

export const SUBSCRIPTION_CANCELED_EVENT = "subscription_canceled";

/** Same LeadConnector hook the immediate-cancel path and expire-payment-grace already use. */
export const GHL_SUBSCRIPTION_CANCEL_WEBHOOK_URL =
  "https://services.leadconnectorhq.com/hooks/T69cI1milcirIORef4Ib/webhook-trigger/8269ec40-aa2b-4068-b3b7-4cc6404d8ff8";

export type CancelKind = "immediate" | "access_kept" | "cancel_at_period_end";

export type SubscriptionCanceledMessage = {
  userEmail: string;
  channel: "webhook";
  templateKey: string;
  provider: string;
  providerMessageId?: string | null;
  status: "sent" | "failed" | "queued" | "suppressed";
  source: string;
  detail?: string | null;
  metadata?: Record<string, unknown> | null;
};

export type CancelRecordResult = {
  webhookFired: boolean;
  logged: boolean;
  duplicate: boolean;
};

/**
 * Paid-period rule, shared by customer.subscription.deleted and by
 * customer.subscription.updated once status is already canceled.
 *
 * A deleted subscription is already gone in Stripe. A future current_period_end
 * still means the customer paid through that instant, so access stays until
 * then and billing_state stays ACTIVE. expire-payment-grace revokes it later.
 * An updated event that is still active or trialing (cancel_at_period_end)
 * does not use this rule; that path only stores the countdown.
 * Unpaid and incomplete_expired do not keep the paid period.
 */
export function keepsPaidAccess(status: string, periodEndMs: number | null, nowMs: number): boolean {
  return status === "canceled" && periodEndMs != null && periodEndMs > nowMs;
}

/**
 * Stable id for one cancel side effect: subscription id, period end (or cancel_at),
 * and kind. Updated and deleted that both keep access share a key. A scheduled
 * countdown does not use the immediate key, so it cannot swallow that GoHighLevel post.
 */
export function cancelDedupeKey(
  subscriptionId: string,
  whenIso: string | null | undefined,
  kind?: string | null,
): string {
  const id = subscriptionId.trim() || "unknown";
  const suffix = kind?.trim() ? `:${kind.trim()}` : "";
  if (!whenIso || !whenIso.trim()) return `${id}:none${suffix}`;
  const ms = Date.parse(whenIso);
  const when = Number.isNaN(ms) ? whenIso.trim() : new Date(ms).toISOString();
  return `${id}:${when}${suffix}`;
}

export function isDuplicateInsertError(error: string): boolean {
  return /duplicate key|23505|unique constraint/i.test(error);
}

/** Stripe should retry a lost claim. A duplicate and a failed GoHighLevel post stay 200. */
export function cancelResponseStatus(recorded: CancelRecordResult): 200 | 500 {
  if (recorded.duplicate || recorded.logged) return 200;
  return 500;
}

/** True when mark_payment_delinquent left an account that was already PAST_DUE unchanged. */
export function delinquencyWasSkipped(details: unknown): boolean {
  if (!details || typeof details !== "object" || Array.isArray(details)) return false;
  return (details as { skipped?: unknown }).skipped === true;
}

/** One audit payload per cancel key. The key is how a Stripe retry finds the existing row. */
export function delinquencyAuditDetails(delinquency: unknown, cancelKey: string): Record<string, unknown> {
  const base = delinquency && typeof delinquency === "object" && !Array.isArray(delinquency)
    ? { ...(delinquency as Record<string, unknown>) }
    : {};
  return { ...base, cancel_key: cancelKey };
}

type CancelMessageMetadata = {
  subscription_id?: unknown;
  access_until?: unknown;
  immediate_claim_key?: unknown;
};

function cancelMessageMetadata(metadata: unknown): CancelMessageMetadata | null {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return null;
  return metadata as CancelMessageMetadata;
}

/** Email fallback when no subscription id was stored. Both paths honor this key. */
export function emailImmediateClaimKey(email: string, whenIso: string | null | undefined): string {
  return cancelDedupeKey(`email:${email.trim().toLowerCase()}`, whenIso, "immediate");
}

/**
 * One immediate key for expire-payment-grace and the Stripe delete.
 * Prefer the key saved on the user row, then the key on a prior
 * subscription_canceled row, then the email fallback. Never returns empty:
 * grace posts with this key instead of leaving the webhook for the other path.
 */
export function resolveImmediateCancelClaimKey(input: {
  storedKey?: string | null;
  priorMessages?: Array<{ metadata?: unknown }> | null;
  cancelAccessUntil?: string | null;
  email: string;
}): string {
  const stored = input.storedKey?.trim();
  if (stored) return stored;
  const fromPrior = immediateClaimKeyFromPrior(input.priorMessages ?? [], input.cancelAccessUntil);
  if (fromPrior) return fromPrior;
  return emailImmediateClaimKey(input.email, input.cancelAccessUntil);
}

/**
 * Keys that mean "this cancel's GoHighLevel post is already claimed".
 * The subscription immediate key, the key stored on the user, and the email
 * fallback for each instant all count, so the two paths cannot both post.
 */
export function immediateClaimKeysToHonor(input: {
  subscriptionKey: string;
  email: string;
  instants: Array<string | null | undefined>;
  storedKey?: string | null;
}): string[] {
  const keys: string[] = [];
  const add = (key: string | null | undefined) => {
    const trimmed = key?.trim();
    if (trimmed && !keys.includes(trimmed)) keys.push(trimmed);
  };
  add(input.subscriptionKey);
  add(input.storedKey);
  for (const instant of input.instants) {
    if (!instant || !instant.trim()) continue;
    add(emailImmediateClaimKey(input.email, instant));
  }
  return keys;
}

type CancelScheduleWriter = {
  from: (table: string) => any;
};

/** Save or clear the paid-through instant and the shared immediate claim key. */
export async function writeCancelSchedule(
  admin: CancelScheduleWriter,
  email: string,
  patch: { cancel_access_until: string | null; cancel_claim_key: string | null; premium_support?: boolean },
): Promise<void> {
  const { error } = await admin.from("saas_suite_users").update(patch).ilike("email", email);
  if (!error) return;
  const message = error.message ?? String(error);
  if (patch.cancel_claim_key !== undefined && /cancel_claim_key/i.test(message)) {
    const { cancel_claim_key: _dropped, ...rest } = patch;
    const retry = await admin.from("saas_suite_users").update(rest).ilike("email", email);
    if (retry.error) {
      console.error(`cancel schedule write failed ${email}: ${retry.error.message}`);
    }
    return;
  }
  console.error(`cancel schedule write failed ${email}: ${message}`);
}

/** Read the shared claim. A missing column keeps the older message lookup working. */
export async function readCancelClaim(
  admin: CancelScheduleWriter,
  email: string,
): Promise<{ claimKey: string | null; accessUntil: string | null }> {
  const { data, error } = await admin
    .from("saas_suite_users")
    .select("cancel_claim_key, cancel_access_until")
    .ilike("email", email)
    .maybeSingle();
  if (error) {
    const message = error.message ?? String(error);
    if (!/cancel_claim_key/i.test(message)) {
      console.error(`cancel claim read failed ${email}: ${message}`);
    }
    const fallback = await admin
      .from("saas_suite_users")
      .select("cancel_access_until")
      .ilike("email", email)
      .maybeSingle();
    return { claimKey: null, accessUntil: fallback.data?.cancel_access_until ?? null };
  }
  const claimKey = typeof data?.cancel_claim_key === "string" && data.cancel_claim_key.trim()
    ? data.cancel_claim_key.trim()
    : null;
  const accessUntil = typeof data?.cancel_access_until === "string" ? data.cancel_access_until : null;
  return { claimKey, accessUntil };
}

/**
 * The immediate key expire-payment-grace and a later period-end delete both claim.
 * Prefer the key stored when access was scheduled. Otherwise rebuild it from the
 * subscription id and the paid-through instant.
 */
export function immediateClaimKeyFromPrior(
  rows: Array<{ metadata?: unknown }>,
  cancelAccessUntil: string | null | undefined,
): string | null {
  const metas = rows
    .map((row) => cancelMessageMetadata(row.metadata))
    .filter((meta): meta is CancelMessageMetadata => meta != null);
  const matching = cancelAccessUntil
    ? metas.filter((meta) => typeof meta.access_until === "string" && sameInstant(meta.access_until, cancelAccessUntil))
    : metas;
  if (matching.length === 0) return null;
  const pool = matching;
  for (const meta of pool) {
    if (typeof meta.immediate_claim_key === "string" && meta.immediate_claim_key.trim()) {
      return meta.immediate_claim_key.trim();
    }
  }
  const when = cancelAccessUntil?.trim() || "";
  for (const meta of pool) {
    const subscriptionId = typeof meta.subscription_id === "string" ? meta.subscription_id.trim() : "";
    const accessUntil = typeof meta.access_until === "string" && meta.access_until.trim()
      ? meta.access_until
      : when;
    if (subscriptionId && accessUntil) return cancelDedupeKey(subscriptionId, accessUntil, "immediate");
  }
  return null;
}

/**
 * Side effects that run before the immediate claim.
 * Premium Support is cleared to false again. mark_payment_delinquent does not
 * change an account that is already PAST_DUE. The audit row is inserted once
 * per cancel key. The cache purge runs on the transition and is skipped once
 * delinquency was already applied, including a Stripe retry.
 */
export async function applyImmediateCancelAttempt(input: {
  cancelKey: string;
  clearPremium: () => Promise<void>;
  markDelinquent: () => Promise<{ error: boolean; details: unknown }>;
  auditExists: () => Promise<boolean>;
  insertAudit: (details: Record<string, unknown>) => Promise<void>;
  purgeCache: () => Promise<unknown>;
  record: () => Promise<CancelRecordResult>;
}): Promise<{ status: 200 | 500; duplicate: boolean; recorded: CancelRecordResult }> {
  await input.clearPremium();
  const marked = await input.markDelinquent();
  if (!marked.error) {
    const exists = await input.auditExists();
    if (!exists) await input.insertAudit(delinquencyAuditDetails(marked.details, input.cancelKey));
  }
  if (!delinquencyWasSkipped(marked.details)) await input.purgeCache();
  const recorded = await input.record();
  if (recorded.duplicate) return { status: 200, duplicate: true, recorded };
  return { status: cancelResponseStatus(recorded), duplicate: false, recorded };
}

type ClaimRpc = {
  rpc: (
    fn: string,
    args: Record<string, unknown>,
  ) => PromiseLike<{ data: unknown; error: { message: string } | null }>;
};

/** Insert through claim_subscription_canceled_message. An empty result is a duplicate. */
export async function insertSubscriptionCanceledClaim(
  admin: ClaimRpc,
  row: SubscriptionCanceledMessage,
): Promise<MessageInsertResult> {
  const { data, error } = await admin.rpc("claim_subscription_canceled_message", {
    p_user_email: row.userEmail,
    p_provider_message_id: row.providerMessageId ?? null,
    p_status: row.status,
    p_source: row.source,
    p_detail: row.detail ?? null,
    p_metadata: row.metadata ?? {},
  });
  if (error) {
    console.error(
      `customer_message_events insert failed template=${row.templateKey} email=${row.userEmail}: ${error.message}`,
    );
    return { ok: false, error: error.message };
  }
  const claimed = Array.isArray(data) ? data.length > 0 : data != null;
  return { ok: true, claimed };
}

/** Read and update the claimed subscription_canceled row. */
export function bindSubscriptionCanceledClaim(admin: { from: (table: string) => any }) {
  return {
    findExisting: async (key: string) => {
      const { data, error } = await admin
        .from("customer_message_events")
        .select("id")
        .eq("template_key", "subscription_canceled")
        .eq("provider_message_id", key)
        .limit(1);
      if (error) {
        console.error(`[STRIPE-SUB-WEBHOOK] subscription_canceled lookup failed ${key}: ${error.message}`);
        return false;
      }
      return (data?.length ?? 0) > 0;
    },
    markStatus: async (key: string, outcome: GhlWebhookOutcome) => {
      const stamp = new Date().toISOString();
      const { data, error: readError } = await admin
        .from("customer_message_events")
        .select("metadata")
        .eq("template_key", "subscription_canceled")
        .eq("provider_message_id", key)
        .limit(1);
      if (readError) {
        console.error(`[STRIPE-SUB-WEBHOOK] subscription_canceled status read failed ${key}: ${readError.message}`);
      }
      const patch: Record<string, unknown> = {
        status: cancelMessageStatus(outcome),
        status_at: stamp,
        updated_at: stamp,
      };
      if (!readError) patch.metadata = withGhlWebhookStatus(data?.[0]?.metadata, outcome);
      const { error } = await admin
        .from("customer_message_events")
        .update(patch)
        .eq("template_key", "subscription_canceled")
        .eq("provider_message_id", key);
      if (error) {
        console.error(`[STRIPE-SUB-WEBHOOK] subscription_canceled status update failed ${key}: ${error.message}`);
      }
    },
  };
}

export type CancelPlan = {
  inCancelBranch: boolean;
  keepsAccess: boolean;
  kind: CancelKind;
  dedupeKey: string;
  accessUntil: string | null;
};

/** Classify one Stripe subscription event. Updated and deleted for the same cancel share dedupeKey. */
export function planSubscriptionCancel(input: {
  eventType: string;
  subscriptionId: string;
  status: string;
  periodEndMs: number | null;
  cancelAtMs?: number | null;
  nowMs: number;
}): CancelPlan {
  const inCancelBranch = input.eventType === "customer.subscription.deleted"
    || ["canceled", "unpaid", "incomplete_expired"].includes(input.status);
  const keepsAccess = keepsPaidAccess(input.status, input.periodEndMs, input.nowMs);
  const whenMs = input.periodEndMs ?? input.cancelAtMs ?? null;
  const accessUntil = keepsAccess && input.periodEndMs != null ? new Date(input.periodEndMs).toISOString() : null;
  const kind: CancelKind = keepsAccess
    ? "access_kept"
    : inCancelBranch
      ? "immediate"
      : "cancel_at_period_end";
  return {
    inCancelBranch,
    keepsAccess,
    kind,
    dedupeKey: cancelDedupeKey(
      input.subscriptionId,
      whenMs == null ? null : new Date(whenMs).toISOString(),
      kind,
    ),
    accessUntil,
  };
}

/** `claimed: false` means the insert conflicted and returned no row. Omitted means a row was written. */
export type MessageInsertResult =
  | { ok: true; claimed?: boolean }
  | { ok: false; error: string };

export type GhlWebhookOutcome = "sent" | "failed" | "skipped";

/** Message status stored on the row. `skipped` is not a customer_message_events status. */
export function cancelMessageStatus(outcome: GhlWebhookOutcome): "sent" | "failed" | "suppressed" {
  return outcome === "skipped" ? "suppressed" : outcome;
}

/** Keep the rest of the metadata and move ghl_webhook off `pending`. */
export function withGhlWebhookStatus(prior: unknown, outcome: GhlWebhookOutcome): Record<string, unknown> {
  const base = prior && typeof prior === "object" && !Array.isArray(prior)
    ? { ...(prior as Record<string, unknown>) }
    : {};
  return { ...base, ghl_webhook: outcome };
}

/**
 * Immediate cancels revoke access in this request, so this webhook notifies GoHighLevel.
 * cancel_at_period_end and "access kept until period end" leave access in place.
 * expire-payment-grace claims the same immediate key when that date passes.
 * If that key was never stored, grace claims the email fallback and this path
 * treats that key as already claimed. Only the first claim posts.
 */
export function ghlCancelWebhookIntended(kind: CancelKind): boolean {
  return kind === "immediate";
}

/** True when a scheduled cancel date is new or moved. Same instant does not write another row. */
export function shouldRecordScheduledCancel(
  previousUntil: string | null | undefined,
  nextUntil: string | null | undefined,
): boolean {
  if (!nextUntil) return false;
  return !sameInstant(previousUntil, nextUntil);
}

export function sameInstant(left: string | null | undefined, right: string | null | undefined): boolean {
  if (!left && !right) return true;
  if (!left || !right) return false;
  const a = Date.parse(left);
  const b = Date.parse(right);
  if (Number.isNaN(a) || Number.isNaN(b)) return left === right;
  return a === b;
}

export function subscriptionOutcomeLine(input: {
  customer?: string | null;
  price?: string | null;
  result: string;
}): string {
  const customer = oneLine(input.customer) || "unknown";
  const price = oneLine(input.price) || "unknown";
  const result = oneLine(input.result) || "unspecified";
  return `[STRIPE-SUB-WEBHOOK] outcome customer=${customer} price=${price} result=${result}`;
}

export function logSubscriptionOutcome(input: {
  customer?: string | null;
  price?: string | null;
  result: string;
}): void {
  console.log(subscriptionOutcomeLine(input));
}

function oneLine(value: string | null | undefined): string {
  if (typeof value !== "string") return "";
  return value.replace(/[\r\n]+/g, " ").trim();
}

function deferredDetail(kind: CancelKind, accessUntil?: string | null): string | null {
  if (kind === "access_kept") {
    return `access kept until ${accessUntil || "period end"}; GoHighLevel cancel webhook runs when that date passes`;
  }
  if (kind === "cancel_at_period_end") {
    return `cancel at period end until ${accessUntil || "period end"}; GoHighLevel cancel webhook runs when access ends`;
  }
  return null;
}

/**
 * Write subscription_canceled and post the GoHighLevel cancel webhook when this
 * path is the one that sends it. Never throws.
 */
export async function recordSubscriptionCanceled(input: {
  email: string;
  priceId?: string | null;
  productId?: string | null;
  subscriptionId?: string | null;
  kind: CancelKind;
  accessUntil?: string | null;
  dedupeKey?: string | null;
  /** Key a later immediate delete will claim. Stored so expire-payment-grace can use it. */
  immediateClaimKey?: string | null;
  /** Body for the GoHighLevel post. The immediate Stripe path sends `{ email }`. */
  webhookBody?: Record<string, unknown>;
  source?: string;
  fetchImpl?: typeof fetch;
  markStatus?: (dedupeKey: string, outcome: GhlWebhookOutcome) => Promise<void>;
  /**
   * Atomic claim. The database function locks the key and inserts only when
   * no matching row exists. `claimed: false` means no row came back.
   */
  insertMessage: (row: SubscriptionCanceledMessage) => Promise<MessageInsertResult>;
  logError?: (message: string) => void;
}): Promise<CancelRecordResult> {
  const logError = input.logError ?? ((message: string) => console.error(message));
  const email = input.email.trim().toLowerCase();
  const fire = ghlCancelWebhookIntended(input.kind);
  const key = input.dedupeKey?.trim() || null;
  const duplicate = (): CancelRecordResult => ({ webhookFired: false, logged: false, duplicate: true });
  try {
    const inserted = await input.insertMessage({
      userEmail: email,
      channel: "webhook",
      templateKey: SUBSCRIPTION_CANCELED_EVENT,
      provider: "ghl",
      providerMessageId: key,
      status: fire ? "queued" : "suppressed",
      source: input.source ?? "stripe-subscription-webhook",
      detail: deferredDetail(input.kind, input.accessUntil),
      metadata: {
        kind: input.kind,
        price_id: input.priceId || null,
        product_id: input.productId || null,
        subscription_id: input.subscriptionId || null,
        access_until: input.accessUntil || null,
        cancel_key: key,
        immediate_claim_key: input.immediateClaimKey?.trim() || (fire ? key : null),
        // Non-immediate rows stay "deferred". That is the final status:
        // expire-payment-grace posts when access ends, using immediate_claim_key.
        // This path does not write "skipped".
        ghl_webhook: fire ? "pending" : "deferred",
      },
    });
    if (!inserted.ok && isDuplicateInsertError(inserted.error)) return duplicate();
    if (!inserted.ok) {
      logError(
        `[STRIPE-SUB-WEBHOOK] ERROR customer_message_events insert failed template=${SUBSCRIPTION_CANCELED_EVENT} email=${email} key=${key || "none"}: ${inserted.error}`,
      );
      return { webhookFired: false, logged: false, duplicate: false };
    }
    if (inserted.claimed === false) return duplicate();

    // The row is ours. A paired event gets no row back and does not post.
    if (!fire) return { webhookFired: false, logged: true, duplicate: false };

    let webhookOk = false;
    try {
      const fetchImpl = input.fetchImpl ?? fetch;
      const response = await fetchImpl(GHL_SUBSCRIPTION_CANCEL_WEBHOOK_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input.webhookBody ?? { email }),
      });
      webhookOk = response.ok;
      if (!response.ok) {
        logError(`[STRIPE-SUB-WEBHOOK] cancel notification failed ${response.status}`);
      }
    } catch (error) {
      webhookOk = false;
      const message = error instanceof Error ? error.message : String(error);
      logError(`[STRIPE-SUB-WEBHOOK] cancel notification failed ${message}`);
    }
    if (key && input.markStatus) {
      try {
        await input.markStatus(key, webhookOk ? "sent" : "failed");
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        logError(`[STRIPE-SUB-WEBHOOK] subscription_canceled status update failed ${key}: ${message}`);
      }
    }
    return { webhookFired: webhookOk, logged: true, duplicate: false };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logError(
      `[STRIPE-SUB-WEBHOOK] ERROR customer_message_events insert failed template=${SUBSCRIPTION_CANCELED_EVENT} email=${email} key=${key || "none"}: ${message}`,
    );
    return { webhookFired: false, logged: false, duplicate: false };
  }
}

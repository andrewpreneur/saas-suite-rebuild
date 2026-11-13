/**
 * Retry schedule for a kit Meta Purchase that the webhook could not deliver.
 * Pure: the edge function and the tests share these rules.
 *
 * The webhook returns 200 after a Meta failure, so Stripe will not redeliver.
 * A sweep retries the same order id (and therefore the same Meta event_id)
 * a few times, then stops.
 */

/** Failed sweep sends after the original webhook attempt. The third failure stops. */
export const KIT_META_RETRY_MAX_ATTEMPTS = 3;

const BACKOFF_MS = [2 * 60 * 1000, 10 * 60 * 1000];

export function kitMetaRetryOrderId(actionKey: string): string | null {
  if (!actionKey.startsWith("meta:")) return null;
  const id = actionKey.slice("meta:".length);
  if (/^cs_(live|test)_[A-Za-z0-9]+$/.test(id)) return id;
  if (/^pi_[A-Za-z0-9]+$/.test(id)) return id;
  return null;
}

export function kitMetaRetryDue(row: {
  actionKey: string;
  completed: boolean;
  attempts: number;
  leaseUntilMs: number;
}, nowMs: number): boolean {
  if (!kitMetaRetryOrderId(row.actionKey)) return false;
  if (row.completed) return false;
  if (row.attempts >= KIT_META_RETRY_MAX_ATTEMPTS) return false;
  if (!Number.isFinite(row.leaseUntilMs) || row.leaseUntilMs > nowMs) return false;
  return true;
}

/** After a failed send: wait 2 minutes, then 10, then give up for a year. */
export function kitMetaRetryPlan(attempts: number, nowMs: number): {
  attempts: number;
  retryAtMs: number;
  exhausted: boolean;
} {
  const next = attempts + 1;
  if (next >= KIT_META_RETRY_MAX_ATTEMPTS) {
    return { attempts: next, retryAtMs: nowMs + 365 * 24 * 60 * 60 * 1000, exhausted: true };
  }
  const wait = BACKOFF_MS[next - 1] ?? BACKOFF_MS[BACKOFF_MS.length - 1];
  return { attempts: next, retryAtMs: nowMs + wait, exhausted: false };
}

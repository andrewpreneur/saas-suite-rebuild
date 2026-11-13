/**
 * Lease for one GoHighLevel email. Same rules as claim_one_feature_kit_action:
 * the first caller holds the row for five minutes, a completed row is a duplicate,
 * and a live lease is an overlap. A timeout keeps the lease. A definite non-2xx
 * releases it. A 2xx completes it. A missing template URL releases it so a later
 * attempt can send once the link exists.
 *
 * The SQL in 20261023130000_ghl_email_claims.sql is the production claim.
 * memoryGhlEmailClaims mirrors that function for tests.
 */

export const GHL_EMAIL_LEASE_MS = 5 * 60 * 1000;

export type GhlClaimState = "claimed" | "duplicate" | "overlap" | "error";

export type GhlEmailClaimClient = {
  claim: (key: string) => Promise<GhlClaimState>;
  release: (key: string) => Promise<void>;
  complete: (key: string) => Promise<void>;
};

export type GhlSendResult = "sent" | "failed" | "uncertain" | "skipped" | "missing_url";

export type GhlClaimedSendResult = GhlSendResult | "duplicate" | "overlap";

type LeaseRow = { completed: boolean; leaseUntil: number };

/** In-memory claim with the same outcomes as claim_ghl_email. */
export function memoryGhlEmailClaims(options?: {
  now?: () => number;
  leaseMs?: number;
}): GhlEmailClaimClient & { rows: Map<string, LeaseRow> } {
  const rows = new Map<string, LeaseRow>();
  const now = options?.now ?? (() => Date.now());
  const leaseMs = options?.leaseMs ?? GHL_EMAIL_LEASE_MS;
  return {
    rows,
    async claim(key) {
      const current = now();
      const row = rows.get(key);
      if (!row) {
        rows.set(key, { completed: false, leaseUntil: current + leaseMs });
        return "claimed";
      }
      if (row.completed) return "duplicate";
      if (row.leaseUntil > current) return "overlap";
      row.leaseUntil = current + leaseMs;
      return "claimed";
    },
    async release(key) {
      const row = rows.get(key);
      if (!row || row.completed) return;
      row.leaseUntil = 0;
    },
    async complete(key) {
      const row = rows.get(key);
      if (!row) {
        rows.set(key, { completed: true, leaseUntil: now() });
        return;
      }
      row.completed = true;
    },
  };
}

type ClaimDb = {
  rpc: (fn: string, args: { p_key: string }) => PromiseLike<{ data: unknown; error: { message?: string } | null }>;
  from: (table: string) => {
    select: (columns: string) => {
      eq: (column: string, value: string) => {
        maybeSingle: () => PromiseLike<{ data: { completed?: boolean } | null; error: { message?: string } | null }>;
      };
    };
    update: (values: { completed?: boolean; lease_until?: string }) => {
      eq: (column: string, value: string) => PromiseLike<{ error: { message?: string } | null }>;
    };
  };
};

/** Service-role client. claim_ghl_email inserts or extends ghl_email_claims. */
export function ghlEmailClaims(db: ClaimDb): GhlEmailClaimClient {
  return {
    async claim(key) {
      const { data, error } = await db.rpc("claim_ghl_email", { p_key: key });
      if (error) return "error";
      if (data === true) return "claimed";
      const prior = await db.from("ghl_email_claims").select("completed").eq("claim_key", key).maybeSingle();
      if (prior.error) return "error";
      return prior.data?.completed === true ? "duplicate" : "overlap";
    },
    async release(key) {
      await db.from("ghl_email_claims").update({ lease_until: new Date(0).toISOString() }).eq("claim_key", key);
    },
    async complete(key) {
      const { error } = await db.from("ghl_email_claims").update({ completed: true }).eq("claim_key", key);
      if (error) throw new Error(error.message || "ghl email claim completion failed");
    },
  };
}

/**
 * One send under a lease. Duplicate and overlap do not call send.
 * sent completes. uncertain (timeout or no HTTP status) holds the lease.
 * failed, skipped, and missing_url release it.
 */
export async function runClaimedGhlSend(input: {
  key: string;
  claims: GhlEmailClaimClient;
  send: () => Promise<GhlSendResult>;
}): Promise<GhlClaimedSendResult> {
  let state: GhlClaimState;
  try {
    state = await input.claims.claim(input.key);
  } catch {
    state = "error";
  }
  if (state === "error") return "failed";
  if (state === "duplicate") return "duplicate";
  if (state === "overlap") return "overlap";
  let result: GhlSendResult;
  try {
    result = await input.send();
  } catch {
    result = "uncertain";
  }
  if (result === "sent") {
    try {
      await input.claims.complete(input.key);
    } catch {
      /* The POST already happened. Leave the lease so an overlap cannot post again. */
    }
    return "sent";
  }
  if (result === "uncertain") return "uncertain";
  try {
    await input.claims.release(input.key);
  } catch {
    /* The lease expires and a later attempt can send. */
  }
  return result;
}

/** Stable key. support_rep_login adds the code id so a new code can send. */
export function ghlEmailDedupeKey(eventName: string, subjectId: string, extraId?: string | null): string | null {
  const event = eventName.trim();
  const subject = subjectId.trim();
  if (!event || !subject) return null;
  if (event === "support_rep_login") {
    const code = (extraId ?? "").trim();
    if (!code) return null;
    return `support_rep_login:${subject}:${code}`.slice(0, 200);
  }
  if (event === "checkout_started") return `checkout_started:${subject}`.slice(0, 200);
  return `${event}:${subject}`.slice(0, 200);
}

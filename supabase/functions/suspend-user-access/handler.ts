import {
  decideSuspendAccess,
  resolveSessionEmail,
} from "../_shared/suspendAccessGuard.ts";

export const CANCELLATION_WEBHOOK_URL =
  "https://services.leadconnectorhq.com/hooks/T69cI1milcirIORef4Ib/webhook-trigger/8269ec40-aa2b-4068-b3b7-4cc6404d8ff8";

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

export type SuspendUserRow = {
  approval: string | null;
  billing_state?: string | null;
  cancel_access_until: unknown;
};

export type SuspendAccessDeps = {
  nowMs: number;
  /** Non-empty WEBHOOK_SECRET. Empty or missing means the existing check stays off. */
  webhookSecret: string | null;
  findUser: (email: string) => Promise<{ row: SuspendUserRow | null; error?: string }>;
  suspendUser: (email: string) => Promise<{ suspended: boolean; error?: string }>;
  postCancellation: (email: string) => Promise<void>;
  /**
   * Auth getUser for the bearer token. Null is not a platform admin.
   * The JSON body is not a session.
   */
  getUser: (token: string) => Promise<{ user: { email?: string | null } | null; error: boolean }>;
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function webhookSecretRejected(secret: string | null, provided: unknown): boolean {
  return typeof secret === "string" && secret.length > 0 && provided !== secret;
}

export async function handleSuspendUserAccess(req: Request, deps: SuspendAccessDeps): Promise<Response> {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body: unknown = await req.json();
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return json({ error: "Invalid user_email parameter" }, 400);
    }
    const record = body as Record<string, unknown>;
    const userEmail = record.user_email;
    const webhookSecret = record.webhook_secret;

    if (webhookSecretRejected(deps.webhookSecret, webhookSecret)) {
      console.error("Invalid webhook secret");
      return json({ error: "Unauthorized" }, 401);
    }

    if (!userEmail || typeof userEmail !== "string") {
      console.error("Invalid user_email:", userEmail);
      return json({ error: "Invalid user_email parameter" }, 400);
    }

    const found = await deps.findUser(userEmail);
    if (found.error) {
      console.error("Error fetching user:", found.error);
      return json({ error: found.error }, 500);
    }
    if (!found.row) {
      console.warn("User not found:", userEmail);
      return json({ success: false, message: "User not found" }, 404);
    }

    const approval = found.row.approval;
    const guarded = decideSuspendAccess({
      approval,
      cancelAccessUntil: found.row.cancel_access_until,
      nowMs: deps.nowMs,
      force: false,
      sessionEmail: null,
    });
    let decision = guarded;
    if (guarded.action === "skip_paid_through" && record.force === true) {
      const sessionEmail = await resolveSessionEmail(req, deps.getUser);
      decision = decideSuspendAccess({
        approval,
        cancelAccessUntil: found.row.cancel_access_until,
        nowMs: deps.nowMs,
        force: record.force,
        sessionEmail,
      });
    }

    if (decision.action === "already_suspended") {
      console.log("User already suspended, skipping:", userEmail, "current approval:", approval);
      return json({ success: true, message: "User already suspended, no action taken", skipped: true }, 200);
    }

    if (decision.action === "skip_paid_through") {
      console.log("Paid-through cancel window still open, skipping suspend:", userEmail, decision.cancelAccessUntil);
      return json({
        success: true,
        skipped: true,
        reason: "cancel_access_until_active",
        cancel_access_until: decision.cancelAccessUntil,
      }, 200);
    }

    console.log("Suspending access for user:", userEmail, "current approval:", approval);

    const suspended = await deps.suspendUser(userEmail);
    if (suspended.error) {
      console.error("Error suspending user access:", suspended.error);
      return json({ error: suspended.error }, 500);
    }
    if (!suspended.suspended) {
      console.warn("User not found:", userEmail);
      return json({ success: false, message: "User not found" }, 404);
    }

    console.log("Successfully explicitly suspended access for:", userEmail);
    try {
      await deps.postCancellation(userEmail);
    } catch (webhookError) {
      console.error("Error sending webhook notification:", webhookError);
    }

    return json({ success: true, message: "User access suspended successfully" }, 200);
  } catch (error) {
    console.error("Error in suspend-user-access function:", error);
    return json(
      { error: error instanceof Error ? error.message : "An unexpected error occurred" },
      500,
    );
  }
}

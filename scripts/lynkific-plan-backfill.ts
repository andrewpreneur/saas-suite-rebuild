// Manual backfill of current SaaSSuite plans into Lynkific.
// Dry-run is the default. Nothing is posted until you pass --send.
//
//   SUPABASE_SERVICE_ROLE_KEY=... bun scripts/lynkific-plan-backfill.ts
//   SUPABASE_SERVICE_ROLE_KEY=... bun scripts/lynkific-plan-backfill.ts --send
//
// One user (dry-run unless --send):
//   SUPABASE_SERVICE_ROLE_KEY=... bun scripts/lynkific-plan-backfill.ts --user 123

const FUNCTION_URL =
  process.env.LYNKIFIC_PLAN_SYNC_URL ??
  "https://backend-disconnected.invalid/functions/v1/lynkific-plan-sync";

const send = process.argv.includes("--send");
const userFlag = process.argv.indexOf("--user");
const userArg = userFlag >= 0 ? process.argv[userFlag + 1] : undefined;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

if (!key) {
  console.error("Set SUPABASE_SERVICE_ROLE_KEY to the service role key.");
  process.exit(1);
}

type BackfillBody = {
  ok?: boolean;
  dry_run?: boolean;
  scanned?: number;
  eligible?: number;
  sent?: number;
  failed?: number;
  skipped?: number | string;
  next_after_id?: number | null;
  done?: boolean;
  preview?: unknown;
  error?: string;
};

async function call(body: unknown): Promise<{ status: number; json: BackfillBody }> {
  const res = await fetch(FUNCTION_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  try {
    return { status: res.status, json: JSON.parse(text) as BackfillBody };
  } catch {
    return { status: res.status, json: { ok: false, error: text.slice(0, 300) } };
  }
}

if (userArg != null) {
  const id = Number(userArg);
  if (!Number.isSafeInteger(id) || id <= 0) {
    console.error("--user expects a numeric saas_suite_users id");
    process.exit(1);
  }
  const { status, json } = await call({ saassuite_user_id: id, dry_run: !send });
  console.log(status, JSON.stringify(json, null, 2));
  process.exit(status >= 200 && status < 300 && json.ok !== false ? 0 : 1);
}

const totals = { eligible: 0, sent: 0, failed: 0, skipped: 0, scanned: 0 };
let afterId = 0;
let first = true;

while (true) {
  const { status, json } = await call({
    mode: "backfill",
    dry_run: !send,
    after_id: afterId,
    batch_size: 15,
  });
  const { preview, ...rest } = json;
  console.log(JSON.stringify({ status, after_id: afterId, ...rest }));
  if (first && preview) console.log("preview", JSON.stringify(preview, null, 2));
  first = false;

  if (json.skipped === "webhook_url_unset") {
    console.error("LYNKIFIC_PLAN_WEBHOOK_URL is not set on the function. Nothing was sent.");
    process.exit(1);
  }
  if (json.error && json.scanned == null) {
    console.error(json.error);
    process.exit(1);
  }

  totals.scanned += json.scanned ?? 0;
  totals.eligible += json.eligible ?? 0;
  totals.sent += json.sent ?? 0;
  totals.failed += json.failed ?? 0;
  totals.skipped += typeof json.skipped === "number" ? json.skipped : 0;

  if (json.done || json.next_after_id == null) break;
  afterId = json.next_after_id;
  await new Promise((resolve) => setTimeout(resolve, 500));
}

console.log("done", { dry_run: !send, ...totals });
if (totals.failed) process.exit(1);

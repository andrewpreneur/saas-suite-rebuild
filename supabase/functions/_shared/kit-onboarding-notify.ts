/**
 * One Feature Kit thank-you onboarding notifications.
 * Pure helpers: no Deno, no network. The edge function applies them.
 *
 * Customer email is not sent here. GoHighLevel receives a flat JSON POST.
 * An unset GHL_KIT_ONBOARDING_WEBHOOK_URL uses the onboarding workflow hook.
 * An explicit blank value skips.
 */
import { ghlFreeText, ghlGreetingName, ghlHttpsUrl, ghlStripText } from "./ghl-email-text.ts";
import { kitGhlDefiniteFailure } from "./kit-lynkific.ts";
import { KIT_CATALOG, type KitLineId } from "./kit-catalog.ts";

/** Public submits older than this are rejected. Admin replay is not. */
export const ONBOARDING_NOTIFY_MAX_AGE_MS = 15 * 60 * 1000;

/** Clock skew. A row timestamp slightly ahead of the function is still recent. */
export const ONBOARDING_NOTIFY_FUTURE_SKEW_MS = 2 * 60 * 1000;

export const KIT_ONBOARDING_WEBHOOK_TIMEOUT_MS = 3000;

/** GoHighLevel inbound hook used when GHL_KIT_ONBOARDING_WEBHOOK_URL is unset. Workflow "One Feature Kit – Onboarding Submitted". */
export const KIT_ONBOARDING_WEBHOOK_FALLBACK =
  "https://services.leadconnectorhq.com/hooks/T69cI1milcirIORef4Ib/webhook-trigger/f49219c1-8d37-4f92-a4d0-079761a743df";

export const KIT_ONBOARDING_EVENT = "saassuite.kit_onboarding";

export const KIT_ONBOARDING_ADMIN_ORIGIN = "https://saassuite.ai";

export function onboardingNotifyActionKey(rowId: string): string {
  return `onboarding-notify:${rowId}`;
}

export type OnboardingRow = {
  id: string;
  created_at: string;
  checkout_id: string | null;
  first_name: string | null;
  email: string | null;
  phone: string | null;
  order_lines: unknown;
  answers: unknown;
  source: string | null;
};

export type KitPurchaseForOnboarding = {
  email: string;
  checkout_session_id: string | null;
  line_id: string;
  amount_cents: number;
  created_at: string;
};

export type OnboardingOrderLine = {
  id: string;
  label: string;
  amountCents: number;
  kind: "one_time";
};

export type OnboardingOrderPatch = {
  checkout_id?: string;
  order_lines?: OnboardingOrderLine[];
};

export type ChannelResult = "sent" | "skipped" | "failed" | "uncertain";

export type NotifyClaimState = "claimed" | "duplicate" | "busy";

export type OnboardingNotifyPlan = {
  sendSlack: boolean;
  sendGhl: boolean;
  finish: boolean;
  status: "duplicate" | "busy" | "send" | "complete";
};

export function kitLineLabel(lineId: string): string {
  if (lineId in KIT_CATALOG) return KIT_CATALOG[lineId as KitLineId].label;
  return lineId;
}

export function formatOnboardingUsd(cents: number): string {
  const safe = Number.isFinite(cents) ? cents : 0;
  return `$${(safe / 100).toFixed(2)}`;
}

/** Same split the kit purchase webhooks use: first word, then the rest. */
export function splitOnboardingName(name: string): { first_name: string; last_name: string } {
  const clean = name.trim().replace(/\s+/g, " ");
  if (!clean) return { first_name: "", last_name: "" };
  const [first, ...rest] = clean.split(" ");
  return { first_name: first ?? "", last_name: rest.join(" ") };
}

export function checkoutIdMissing(value: unknown): boolean {
  return typeof value !== "string" || value.trim() === "";
}

export function normalizeOrderLines(value: unknown): OnboardingOrderLine[] {
  if (!Array.isArray(value)) return [];
  const lines: OnboardingOrderLine[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object") continue;
    const row = item as Record<string, unknown>;
    const id = typeof row.id === "string" ? row.id.trim() : typeof row.line_id === "string" ? row.line_id.trim() : "";
    if (!id) continue;
    const amount = typeof row.amountCents === "number"
      ? row.amountCents
      : typeof row.amount_cents === "number"
        ? row.amount_cents
        : 0;
    const label = typeof row.label === "string" && row.label.trim() ? row.label.trim() : kitLineLabel(id);
    lines.push({ id, label, amountCents: Number.isFinite(amount) ? amount : 0, kind: "one_time" });
  }
  return lines;
}

export function orderLinesMissing(value: unknown): boolean {
  return normalizeOrderLines(value).length === 0;
}

/**
 * Fill checkout_id and order_lines from kit_purchases only where the row is blank.
 * A saved checkout id or a non-empty line list is left as the buyer sent it.
 * The checkout id prefers the latest purchase whose line is the kit.
 */
export function enrichOnboardingOrder(
  row: { email?: string | null; checkout_id: string | null; order_lines: unknown },
  purchases: readonly KitPurchaseForOnboarding[],
): { checkoutId: string | null; lines: OnboardingOrderLine[]; patch: OnboardingOrderPatch } {
  const email = (row.email ?? "").trim().toLowerCase();
  const mine = purchases.filter((purchase) => {
    return purchase.email.trim().toLowerCase() === email && purchase.line_id.trim() !== "";
  });
  const chronological = [...mine].sort((a, b) => a.created_at.localeCompare(b.created_at) || a.line_id.localeCompare(b.line_id));
  const purchasedLines = chronological.map((purchase) => ({
    id: purchase.line_id,
    label: kitLineLabel(purchase.line_id),
    amountCents: Number.isFinite(purchase.amount_cents) ? purchase.amount_cents : 0,
    kind: "one_time" as const,
  }));
  const withCheckout = [...mine]
    .filter((purchase) => (purchase.checkout_session_id ?? "").trim() !== "")
    .sort((a, b) => b.created_at.localeCompare(a.created_at) || a.line_id.localeCompare(b.line_id));
  const kitCheckout = withCheckout.find((purchase) => purchase.line_id === "kit");
  const nextCheckout = (kitCheckout ?? withCheckout[0])?.checkout_session_id?.trim() || null;

  const patch: OnboardingOrderPatch = {};
  if (checkoutIdMissing(row.checkout_id) && nextCheckout) patch.checkout_id = nextCheckout;
  if (orderLinesMissing(row.order_lines) && purchasedLines.length > 0) patch.order_lines = purchasedLines;

  const checkoutId = patch.checkout_id ?? (checkoutIdMissing(row.checkout_id) ? null : String(row.checkout_id).trim());
  const lines = patch.order_lines ?? normalizeOrderLines(row.order_lines);
  return { checkoutId, lines, patch };
}

export function onboardingAnswers(value: unknown): Record<string, string> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const out: Record<string, string> = {};
  for (const [key, raw] of Object.entries(value as Record<string, unknown>)) {
    if (typeof raw === "string") out[key] = raw.trim();
    else if (typeof raw === "number" || typeof raw === "boolean") out[key] = String(raw);
  }
  return out;
}

const ANSWER_FIELDS: { key: string; match: string }[] = [
  { key: "first_name", match: "first name" },
  { key: "email", match: "email you bought with" },
  { key: "phone", match: "phone" },
  { key: "ghl_status", match: "gohighlevel account" },
  { key: "buyer_type", match: "describes you best" },
  { key: "business_name", match: "business brand name" },
  { key: "website", match: "website or domain" },
  { key: "launch_timing", match: "when do you want to launch" },
  { key: "biggest_question", match: "biggest question" },
  { key: "logo_url", match: "logo" },
  { key: "brand_colours", match: "brand colour" },
  { key: "ghl_agency_name", match: "ghl agency" },
  { key: "custom_domain", match: "custom domain" },
  { key: "domain_registrar", match: "domain registered" },
  { key: "team_member_confirmed", match: "team member" },
  { key: "setup_notes", match: "anything else" },
  { key: "marketing_consent", match: "onboarding emails" },
];

function normLabel(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

export function assignOnboardingAnswers(answers: Record<string, string>): {
  mapped: Record<string, string>;
  extra: Record<string, string>;
} {
  const mapped: Record<string, string> = {};
  const used = new Set<string>();
  const extra: Record<string, string> = {};
  for (const [label, value] of Object.entries(answers)) {
    const key = normLabel(label);
    let best: { field: string; score: number } | null = null;
    for (const field of ANSWER_FIELDS) {
      if (used.has(field.key)) continue;
      const match = normLabel(field.match);
      if (key === match || key.includes(match)) {
        if (!best || match.length > best.score) best = { field: field.key, score: match.length };
      }
    }
    if (best) {
      mapped[best.field] = value;
      used.add(best.field);
      continue;
    }
    extra[label] = value;
  }
  return { mapped, extra };
}

export function kitOnboardingAdminUrl(email: string): string {
  return `${KIT_ONBOARDING_ADMIN_ORIGIN}/admin/kit-customers?customer=${encodeURIComponent(email.trim().toLowerCase())}`;
}

function slugKey(label: string): string {
  const slug = label.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 60);
  return slug || "field";
}

function lineSummary(lines: readonly OnboardingOrderLine[]): string {
  return lines.map((line) => `${line.label} (${formatOnboardingUsd(line.amountCents)})`).join("; ");
}

export type KitOnboardingNotice = {
  email: string;
  patch: OnboardingOrderPatch;
  slack: Record<string, unknown>;
  webhook: Record<string, string | number>;
  message: { fallback: string; text: string; blocks: KitSlackBlock[] };
};

export type KitSlackBlock = {
  type: string;
  text?: { type: string; text: string };
};

/**
 * Slack body and the flat GoHighLevel payload for one saved row.
 * Order fields are the row after blank checkout_id / order_lines are filled.
 */
export function buildKitOnboardingNotice(
  row: OnboardingRow,
  purchases: readonly KitPurchaseForOnboarding[],
): KitOnboardingNotice {
  const enriched = enrichOnboardingOrder(row, purchases);
  const assigned = assignOnboardingAnswers(onboardingAnswers(row.answers));
  const enteredName = (row.first_name ?? "").trim() || assigned.mapped.first_name || "";
  const split = splitOnboardingName(enteredName);
  const email = (row.email ?? "").trim().toLowerCase();
  const phone = (row.phone ?? "").trim() || assigned.mapped.phone || "";
  const business = assigned.mapped.business_name || "";
  const launchTiming = assigned.mapped.launch_timing || "";
  const ghlStatus = assigned.mapped.ghl_status || "";
  const totalCents = enriched.lines.reduce((sum, line) => sum + line.amountCents, 0);
  const adminUrl = email ? kitOnboardingAdminUrl(email) : `${KIT_ONBOARDING_ADMIN_ORIGIN}/admin/kit-customers`;
  const slack = {
    name: enteredName,
    email,
    phone,
    business,
    launch_timing: launchTiming,
    ghl_status: ghlStatus,
    total: formatOnboardingUsd(totalCents),
    lines: enriched.lines.map((line) => line.label),
    checkout_id: enriched.checkoutId ?? "",
    admin_url: adminUrl,
  };
  const webhook = kitOnboardingWebhookPayload({
    row,
    email,
    enteredName,
    firstName: split.first_name,
    lastName: assigned.mapped.last_name || split.last_name,
    phone,
    mapped: assigned.mapped,
    extra: assigned.extra,
    checkoutId: enriched.checkoutId,
    lines: enriched.lines,
    totalCents,
    adminUrl,
  });
  const message = kitOnboardingSlackMessage(slack);
  return { email, patch: enriched.patch, slack, webhook, message };
}

export function kitOnboardingSlackMessage(d: Record<string, unknown>): { fallback: string; text: string; blocks: KitSlackBlock[] } {
  const show = (value: unknown) => {
    const text = typeof value === "string" ? value.trim() : "";
    return text || "—";
  };
  const name = show(d.name) === "—" ? show(d.email) : show(d.name);
  const email = typeof d.email === "string" ? d.email.trim() : "";
  const lines = Array.isArray(d.lines) ? d.lines.map((line) => String(line).trim()).filter(Boolean).join(", ") : "";
  const text = [
    `*${name}*${email ? ` (${email})` : ""}`,
    `*Phone:* ${show(d.phone)}`,
    `*Business:* ${show(d.business)}`,
    `*Launch:* ${show(d.launch_timing)}`,
    `*GoHighLevel:* ${show(d.ghl_status)}`,
    `*Total:* ${show(d.total)}`,
    `*Items:* ${lines || "—"}`,
    `*Checkout:* ${show(d.checkout_id)}`,
    `*Admin:* ${show(d.admin_url)}`,
  ].join("\n");
  const business = typeof d.business === "string" ? d.business.trim() : "";
  const fallback = `One Feature Kit onboarding: ${name}${business ? ` · ${business}` : ""}`;
  return {
    fallback,
    text,
    blocks: [
      { type: "header", text: { type: "plain_text", text: "One Feature Kit onboarding" } },
      { type: "section", text: { type: "mrkdwn", text } },
    ],
  };
}

function kitOnboardingWebhookPayload(input: {
  row: OnboardingRow;
  email: string;
  enteredName: string;
  firstName: string;
  lastName: string;
  phone: string;
  mapped: Record<string, string>;
  extra: Record<string, string>;
  checkoutId: string | null;
  lines: readonly OnboardingOrderLine[];
  totalCents: number;
  adminUrl: string;
}): Record<string, string | number> {
  const mapped = input.mapped;
  const names = ghlGreetingName({
    firstName: input.firstName,
    lastName: input.lastName,
    fullName: input.enteredName,
    email: input.email,
  });
  const text = (value: string) => ghlFreeText(value);
  const payload: Record<string, string | number> = {
    event: KIT_ONBOARDING_EVENT,
    onboarding_id: input.row.id,
    email: input.email,
    first_name: names.first_name,
    last_name: names.last_name,
    phone: ghlStripText(input.phone),
    full_name: names.full_name,
    business_name: text(mapped.business_name || ""),
    launch_timing: text(mapped.launch_timing || ""),
    ghl_status: text(mapped.ghl_status || ""),
    buyer_type: text(mapped.buyer_type || ""),
    website: text(mapped.website || ""),
    biggest_question: text(mapped.biggest_question || ""),
    logo_url: ghlHttpsUrl(input.mapped.logo_url) ?? "",
    brand_colours: text(mapped.brand_colours || ""),
    ghl_agency_name: text(mapped.ghl_agency_name || ""),
    custom_domain: text(mapped.custom_domain || ""),
    domain_registrar: text(mapped.domain_registrar || ""),
    team_member_confirmed: text(mapped.team_member_confirmed || ""),
    setup_notes: text(mapped.setup_notes || ""),
    marketing_consent: text(mapped.marketing_consent || ""),
    checkout_id: input.checkoutId ?? "",
    order_total: formatOnboardingUsd(input.totalCents),
    order_total_cents: input.totalCents,
    order_line_ids: input.lines.map((line) => line.id).join(","),
    order_lines: ghlFreeText(lineSummary(input.lines), 500),
    admin_url: input.adminUrl,
    source: (input.row.source ?? "").trim(),
    created_at: input.row.created_at,
  };
  const taken = new Set(Object.keys(payload));
  for (const label of Object.keys(input.extra).sort((a, b) => a.localeCompare(b))) {
    const value = input.extra[label];
    if (!value) continue;
    let base = slugKey(label);
    if (taken.has(base)) base = `answer_${base}`;
    let key = base;
    let n = 2;
    while (taken.has(key)) {
      key = `${base}_${n}`;
      n += 1;
    }
    taken.add(key);
    payload[key] = ghlFreeText(value, 200);
  }
  return payload;
}

/**
 * Unset uses the GoHighLevel onboarding workflow. An explicit empty or blank value skips the POST.
 */
export function kitOnboardingWebhookUrl(envValue: string | undefined): string | null {
  if (envValue === undefined) return KIT_ONBOARDING_WEBHOOK_FALLBACK;
  const target = envValue.trim();
  return target ? target : null;
}

export type KitOnboardingPost = (
  url: string,
  body: string,
  signal: AbortSignal,
) => Promise<{ ok: boolean; status?: number | null }>;

export async function deliverKitOnboardingWebhook(
  url: string | null | undefined,
  body: string,
  post: KitOnboardingPost,
  timeoutMs = KIT_ONBOARDING_WEBHOOK_TIMEOUT_MS,
): Promise<ChannelResult> {
  const target = url?.trim() ?? "";
  if (!target) return "skipped";
  if (!/^https:\/\//i.test(target)) return "failed";
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const result = await Promise.race([
      post(target, body, controller.signal).then(
        (value) => {
          if (value?.ok === true) return "sent" as const;
          return kitGhlDefiniteFailure(value) ? "failed" as const : "uncertain" as const;
        },
        () => "uncertain" as const,
      ),
      new Promise<"uncertain">((resolve) => {
        timer = setTimeout(() => {
          controller.abort();
          resolve("uncertain");
        }, timeoutMs);
      }),
    ]);
    return result;
  } catch {
    return "uncertain";
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export function onboardingSourceOk(source: string | null | undefined): boolean {
  const value = (source ?? "").trim().toLowerCase();
  return value === "" || value.includes("one-feature") || value.includes("kit");
}

/**
 * Anonymous submits must be recent and the body email must match the row.
 * A user session must be that same email. replay bypasses the age check only
 * for a platform admin or the internal Slack token.
 */
export function onboardingNotifyAccess(input: {
  rowEmail: string | null;
  bodyEmail: string;
  createdAt: string;
  now: number;
  replay: boolean;
  sessionEmail: string | null;
  platformAdmin: boolean;
  internal: boolean;
}): { ok: true } | { ok: false; status: 403 | 404; error: string } {
  const rowEmail = (input.rowEmail ?? "").trim().toLowerCase();
  const bodyEmail = input.bodyEmail.trim().toLowerCase();
  if (!rowEmail.includes("@") || rowEmail !== bodyEmail) {
    return { ok: false, status: 404, error: "Onboarding row was not found" };
  }
  if (input.replay && !input.internal && !input.platformAdmin) {
    return { ok: false, status: 403, error: "Replaying an onboarding notification requires an admin" };
  }
  if (!input.replay && input.sessionEmail) {
    const sessionEmail = input.sessionEmail.trim().toLowerCase();
    if (sessionEmail !== rowEmail) {
      return { ok: false, status: 403, error: "Session does not match this onboarding row" };
    }
  }
  if (!input.replay) {
    const created = Date.parse(input.createdAt);
    if (!Number.isFinite(created)) {
      return { ok: false, status: 403, error: "Onboarding row is not recent" };
    }
    const age = input.now - created;
    if (age < -ONBOARDING_NOTIFY_FUTURE_SKEW_MS || age > ONBOARDING_NOTIFY_MAX_AGE_MS) {
      return { ok: false, status: 403, error: "Onboarding row is not recent" };
    }
  }
  return { ok: true };
}

export function onboardingNotifyPlan(input: {
  claim: NotifyClaimState;
  prior: Partial<Record<"slack" | "ghl", ChannelResult>>;
}): OnboardingNotifyPlan {
  if (input.claim === "duplicate") {
    return { sendSlack: false, sendGhl: false, finish: false, status: "duplicate" };
  }
  if (input.claim === "busy") {
    return { sendSlack: false, sendGhl: false, finish: false, status: "busy" };
  }
  const slackDone = input.prior.slack === "sent" || input.prior.slack === "skipped";
  const ghlDone = input.prior.ghl === "sent" || input.prior.ghl === "skipped";
  if (slackDone && ghlDone) {
    return { sendSlack: false, sendGhl: false, finish: true, status: "complete" };
  }
  return { sendSlack: !slackDone, sendGhl: !ghlDone, finish: false, status: "send" };
}

export function onboardingNotifyFinished(results: { slack: ChannelResult; ghl: ChannelResult }): boolean {
  const done = (value: ChannelResult) => value === "sent" || value === "skipped";
  return done(results.slack) && done(results.ghl);
}

/** Prefer a successful log over an older failure for the same channel. */
export function priorOnboardingOutcomes(
  rows: readonly { provider: string | null; status: string | null }[],
): Partial<Record<"slack" | "ghl", ChannelResult>> {
  const prior: Partial<Record<"slack" | "ghl", ChannelResult>> = {};
  for (const row of rows) {
    const channel = row.provider === "slack" ? "slack" : row.provider === "gohighlevel" ? "ghl" : null;
    if (!channel) continue;
    const status: ChannelResult | null = row.status === "sent"
      ? "sent"
      : row.status === "suppressed"
        ? "skipped"
        : row.status === "failed"
          ? "failed"
          : null;
    if (!status) continue;
    const current = prior[channel];
    if (current === "sent" || current === "skipped") continue;
    prior[channel] = status;
  }
  return prior;
}

export async function runClaimedOnboardingNotify(input: {
  plan: OnboardingNotifyPlan;
  prior: Partial<Record<"slack" | "ghl", ChannelResult>>;
  sendSlack: () => Promise<ChannelResult>;
  sendGhl: () => Promise<ChannelResult>;
  log: (channel: "slack" | "ghl", result: ChannelResult) => Promise<void>;
  complete: () => Promise<void>;
  release: () => Promise<void>;
}): Promise<{ ok: boolean; slack: ChannelResult; ghl: ChannelResult; duplicate?: boolean }> {
  if (input.plan.status === "duplicate") {
    return { ok: true, slack: "skipped", ghl: "skipped", duplicate: true };
  }
  if (input.plan.status === "busy") {
    return { ok: false, slack: "skipped", ghl: "skipped" };
  }
  const keep = (value: ChannelResult | undefined): ChannelResult => (
    value === "sent" || value === "skipped" || value === "uncertain" ? value : "failed"
  );
  let slack = keep(input.prior.slack);
  let ghl = keep(input.prior.ghl);
  const record = async (channel: "slack" | "ghl", result: ChannelResult) => {
    try {
      await input.log(channel, result);
    } catch {
      // A log failure must not send the channel again on the next claim.
    }
  };
  if (input.plan.sendSlack) {
    slack = await input.sendSlack();
    await record("slack", slack);
  }
  if (input.plan.sendGhl) {
    ghl = await input.sendGhl();
    await record("ghl", ghl);
  }
  const results = { slack, ghl };
  try {
    if (onboardingNotifyFinished(results) || input.plan.finish) {
      await input.complete();
      return { ok: true, ...results };
    }
  } catch {
    await input.release().catch(() => undefined);
    return { ok: false, ...results };
  }
  const held = results.slack === "uncertain" || results.ghl === "uncertain";
  if (held) return { ok: false, ...results };
  await input.release();
  return { ok: false, ...results };
}

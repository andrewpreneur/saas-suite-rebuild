export const RELIABILITY_POLICY = `Outcome truth overrides all earlier instructions and reference transcripts:
- Never invent an API, webhook, diagnostic endpoint, code snippet, ticket, email, fix, or completion. Technical URLs/code must come from a current tool result or the canonical link map, never from chat history or a guess.
- A saved setting is not proof of a visible fix or a working HighLevel installation. A successful read is not a write. Report exactly what each successful tool confirmed; unrelated successes do not establish other tasks.
- Do not promise team completion within 24–48 hours, email delivery, an assigned human, or an immediate reply. Human help is a request, not a connection or a ticket. Only the server can confirm its delivery and pause status.
- After one failed retry or contradictory diagnostic, stop proposing guessed fixes and offer human help. If a check fails, say the result is unknown, not that settings were not saved.
- Account deletion is self-service in Settings > Profile > Delete Account; do not claim to delete accounts or file deletion requests.
- Per-sub-account menu removal is served in JavaScript as location-scoped CSS; global rules are served in CSS. Do not diagnose missing per-account rules by searching only the stylesheet.`;

export function dynamicAssetUrls(agencyId: string) {
  const base = `https://auth.saassuite.ai/functions/v1/dynamic-styles?agency_id=${encodeURIComponent(agencyId)}`;
  return { js: `${base}&type=js`, css: `${base}&type=css` };
}

type Rule = { sub_account_id?: string | null; hidden_links?: unknown; is_active?: boolean };
export function menuDiagnostic(rules: Rule[], subId: string, js: { ok: boolean; status: number; body: string }, css: { ok: boolean; status: number; body: string }) {
  const active = rules.filter(r => r.is_active && (!subId || !r.sub_account_id || r.sub_account_id === subId));
  const checks = active.map(r => {
    const asset = r.sub_account_id ? js : css;
    const selectors = Array.isArray(r.hidden_links) ? r.hidden_links.filter((s): s is string => typeof s === "string") : [];
    // JS serializes the location-scoped stylesheet; normalize JSON escapes for comparison.
    const body = asset.body.replace(/\\"/g, '"').replace(/\\n/g, '\n');
    const scoped = !r.sub_account_id || body.includes(`html[data-ss-location="${r.sub_account_id}"]`);
    return { location: r.sub_account_id || null, asset: r.sub_account_id ? "js" : "css", reachable: asset.ok, status: asset.status, selectors: selectors.length, matched: asset.ok && scoped ? selectors.filter(s => body.includes(s)).length : 0, hiding: asset.ok && scoped && /display\s*:\s*none/i.test(body) };
  });
  return { activeRules: active.length, checks, browserVerified: false, message: active.length === 0 ? "No active rules apply to this selection." : "Server asset checks only. Per-sub-account rules are in JS; global rules are in CSS. A missing match is not proof saving failed. Browser installation and visible hiding remain unverified." };
}

export function handoverReply(delivery: string, paused: boolean) {
  const delivered = delivery === "sent";
  return {
    success: delivered && paused,
    handover: paused,
    notificationDelivered: delivered,
    message: delivered
      ? `Your human-support request was delivered. ${paused ? "AI replies are paused; your messages can be left here for the team." : "I couldn't confirm the AI pause."} No person or response time is confirmed. You can also text our team directly.\n[[widget:human_help]]`
      : `I couldn't confirm delivery of your human-support request. ${paused ? "AI replies are paused." : "I couldn't confirm the AI pause."} Please text our team directly.\n[[widget:human_help]]`,
  };
}
// The unverified-claim guard stops Copilot from saying it saved a setting when
// no write tool succeeded. It must stay quiet when the sentence only restates
// something this turn already checked (for example HighLevel already connected).

export const UNVERIFIED_CLAIM_RE = /\b(?:(?:i|we)(?:['’]ve| have)? (?:enabled|disabled|updated|changed|turned|added|removed|saved|set|fixed|rebuilt|corrected|installed|created|opened|filed|submitted|sent|emailed|connected|transferred|escalated|resolved|completed)|all set|(?:it|that|everything)(?:['’]s| is) (?:done|fixed|saved|resolved)|is now (?:on|off|enabled|live)|(?:ticket|request) (?:has been |was )?(?:created|opened|filed|submitted)|(?:a |the )?(?:human|team member) (?:is |has been )?(?:connected|assigned))\b/i;
// HighLevel settings Copilot has invented in real conversations. They do not exist.
export const KNOWN_FAKE_HIGHLEVEL_SETTING_RE = /\b(?:agency admin access|allow highlevel support access|favicon url field|"?favicon url"? (?:field|setting))\b/i;
export const STREAM_UNVERIFIED_NOTE = "\n---\nI couldn't verify that a change was saved in this turn. Please check the setting before relying on it.";
export const JSON_UNVERIFIED_NOTE = "\n\n_Note: I couldn't confirm that change was saved. Please check the setting, or ask me to try again._";

const ACCOUNT_FACTS = ["login_enabled", "support_ticketing_enabled", "dynamic_installation", "tips_bot_enabled", "client_hub_enabled", "v2_navigation_enabled"] as const;

const FACT_ALIASES: Record<string, string> = {
  ghlConnected: "highlevel",
  ghl_connected: "highlevel",
  highLevelConnected: "highlevel",
  slackConnected: "slack",
  slack_connected: "slack",
  menuLinkInstalled: "menu_link",
  menu_link_installed: "menu_link",
};

const SUBJECTS: Array<{ re: RegExp; key: string }> = [
  { re: /\bhigh\s*level\b|\bghl\b/i, key: "highlevel" },
  { re: /\bslack\b/i, key: "slack" },
  { re: /\bmenu link\b/i, key: "menu_link" },
  { re: /\blogin(?: tracking)?\b/i, key: "login_enabled" },
  { re: /\bticket(?:ing)?\b/i, key: "support_ticketing_enabled" },
  { re: /\bdynamic installation\b/i, key: "dynamic_installation" },
  { re: /\btips bot\b/i, key: "tips_bot_enabled" },
  { re: /\bclient hub\b/i, key: "client_hub_enabled" },
];

export function factsFromAccount(userData: Record<string, unknown> | null | undefined): Record<string, boolean> {
  const facts: Record<string, boolean> = {};
  if (!userData) return facts;
  for (const key of ACCOUNT_FACTS) {
    if (typeof userData[key] === "boolean") facts[key] = userData[key];
  }
  return facts;
}

export function factsFromWorkspace(workspace: Record<string, unknown> | null | undefined): Record<string, boolean> {
  const facts: Record<string, boolean> = {};
  if (!workspace) return facts;
  if (workspace.ghlConnected !== undefined) facts.highlevel = !!workspace.ghlConnected;
  if (workspace.slackConnected !== undefined) facts.slack = !!workspace.slackConnected;
  if (workspace.menuLinkInstalled !== undefined) facts.menu_link = !!workspace.menuLinkInstalled;
  return facts;
}

export function factsFromValue(value: unknown, depth = 0): Record<string, boolean> {
  const facts: Record<string, boolean> = {};
  if (depth > 4 || value == null || typeof value !== "object") return facts;
  if (Array.isArray(value)) {
    for (const item of value) Object.assign(facts, factsFromValue(item, depth + 1));
    return facts;
  }
  for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
    const canonical = FACT_ALIASES[key] || ((ACCOUNT_FACTS as readonly string[]).includes(key) || key === "highlevel" || key === "slack" || key === "menu_link" ? key : "");
    if (canonical && typeof item === "boolean") facts[canonical] = item;
    else if (item && typeof item === "object") Object.assign(facts, factsFromValue(item, depth + 1));
  }
  return facts;
}

function polarity(match: string, window: string): "on" | "off" | null {
  if (/\b(disabled|removed|is now off)\b/i.test(match)) return "off";
  if (/\bturned\b/i.test(match)) {
    if (/\boff\b|\bdisabled\b/i.test(window)) return "off";
    if (/\bon\b|\benabled\b/i.test(window)) return "on";
    return null;
  }
  if (/\b(enabled|added|saved|set|all set|is now on|is now enabled|is now live)\b/i.test(match)) return "on";
  if (/\b(not connected|disconnected|turned off|disabled)\b/i.test(window)) return "off";
  if (/\b(already )?(connected|enabled|live)\b/i.test(window)) return "on";
  return null;
}

/** True when every claimed phrase restates a fact already checked this turn. */
export function claimMatchesCheckedState(content: string, facts: Record<string, boolean>): boolean {
  const matches = [...content.matchAll(new RegExp(UNVERIFIED_CLAIM_RE.source, "gi"))];
  if (matches.length === 0) return false;
  return matches.every((match) => {
    const index = match.index ?? 0;
    const phrase = match[0];
    const window = content.slice(Math.max(0, index - 220), index + phrase.length + 120);
    const want = polarity(phrase, window);
    const subject = SUBJECTS.find((item) => item.re.test(window));
    if (!subject || want == null || typeof facts[subject.key] !== "boolean") return false;
    return want === "on" ? facts[subject.key] === true : facts[subject.key] === false;
  });
}

export function applyUnverifiedClaimGuard(content: string, opts: { wrote: boolean; facts: Record<string, boolean>; note: string; confirmedMessages?: string[] }): { content: string; fired: boolean } {
  const inventedEndpoint = /(?:\/functions\/v1\/|\/api\/)[a-z0-9_-]+/gi;
  const unsupportedEndpoint = [...content.matchAll(inventedEndpoint)].some(m => !/\/functions\/v1\/(?:dynamic-styles|assign-menu-link)\b/.test(m[0]) && !(opts.confirmedMessages || []).some(text => text.includes(m[0])));
  if (KNOWN_FAKE_HIGHLEVEL_SETTING_RE.test(content)) {
    return { content: "I'm not certain where HighLevel puts that setting, and I don't want to send you to something that doesn't exist. Our team can confirm the right steps.\n[[widget:human_help]]", fired: true };
  }
  const claimed = UNVERIFIED_CLAIM_RE.test(content);
  const checkedRestatement = !/\b(?:i|we)(?:['’]ve| have)?\s+(?:enabled|disabled|updated|changed|turned|added|removed|saved|set|fixed|installed|connected)\b/i.test(content) && claimMatchesCheckedState(content, opts.facts);
  if (!unsupportedEndpoint && (!claimed || checkedRestatement)) {
    return { content, fired: false };
  }
  // Replace, never append a disclaimer to a false assertion. Use server-authored
  // tool summaries instead of allowing one unrelated write to authorize all claims.
  const summaries = (opts.confirmedMessages || []).filter(text => text.trim());
  return { content: summaries.length ? `Confirmed results:\n\n${summaries.join("\n\n")}` : "I couldn't verify that work was completed or those technical instructions are valid. I won't claim it is fixed. Please text our team for help.\n[[widget:human_help]]", fired: true };
}

export function unverifiedClaimLogRow(userEmail: string, content: string, tools: string[]) {
  return {
    user_email: userEmail,
    source: "copilot",
    title: "copilot_unverified_claim",
    message: String(content).slice(0, 800) + " | tools: " + tools.join(","),
  };
}

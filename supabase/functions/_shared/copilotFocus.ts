export const COPILOT_TOPICS = {
  menulinkremoval: "menu link removal",
  brandingtool: "the branding tool",
  logintracking: "login tracking",
  clienthub: "the Client Hub",
  community: "the community",
  support: "support",
  installation: "installation",
  understanding: "how SaaSSuite works",
} as const;

export type CopilotFocus = keyof typeof COPILOT_TOPICS;
export function validCopilotFocus(value: unknown): CopilotFocus | null {
  return typeof value === "string" && Object.prototype.hasOwnProperty.call(COPILOT_TOPICS, value) ? value as CopilotFocus : null;
}
export function focusFromPath(path: string): CopilotFocus | null {
  return validCopilotFocus(path.split("?")[0].replace(/\/+$/, "").match(/^(?:\/app)?\/copilot\/([^/]+)$/)?.[1]);
}
export function shouldContinueSetup(ghl: boolean, slack: boolean, menu: boolean): boolean {
  return ghl && (slack || menu);
}
export function copilotFocusPolicy(value: unknown): string {
  const focus = validCopilotFocus(value);
  if (!focus) return "";
  const understanding = focus === "understanding"
    ? "Give a concise general explanation of SaaSSuite. Anyone who signs up for or upgrades any HighLevel account through our link gets SaaSSuite ADVANCED free. Do not say a commission covers the plan. Then ask what they want to explore."
    : "Explain the feature briefly and guide setup one meaningful step at a time using supported tools/widgets. Do not add a second Skip for now choice when the message already includes a connect or skip button.";
  return `The owner's entry link indicates interest in ${COPILOT_TOPICS[focus]}. This is interest, NOT permission to change anything. After the welcome and completed or explicitly skipped connection/installation steps, BEFORE asking business identity or customizing anything, confirm: 'You want to learn about ${COPILOT_TOPICS[focus]}, right?' with [[choices: Yes, let's do that | No, I want something else]]. Ask this once, using stored conversation history to recognize their answer. If yes, focus on that topic, read actual account settings and use existing plan/tool gates and upgrades. If they change direction, follow their actual answer instead. Do not force the generic priority question or unrelated welcome customization. ${understanding}`;
}
/** True when a HighLevel custom menu link already points at this agency's Client Hub. */
export function hubMenuLinkInstalled(menus: Array<{ url?: string | null }> | null | undefined, agencyId: string | null | undefined): boolean {
  const id = String(agencyId || "").trim().toLowerCase();
  if (!id || !Array.isArray(menus)) return false;
  return menus.some((m) => {
    const url = String(m?.url || "").toLowerCase();
    if (!url) return false;
    return url.includes(`/${encodeURIComponent(id)}`) && /(yoursoftwareonboarding|saassuite)/.test(url);
  });
}

/** Name step: only a listed option (or text after "Other") is a name; anything else is a normal message. */
export function isNameAnswer(text: string, options: readonly string[], phase: "name" | "name_other"): boolean {
  if (phase === "name_other") return text.trim().length > 0 && text.trim().length <= 40;
  return options.some((o) => o.toLowerCase() === text.trim().toLowerCase());
}

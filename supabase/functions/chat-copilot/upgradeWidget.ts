export const UPGRADE_WIDGET = "[[widget:upgrade]]";

export function threadHasUpgradeWidget(messages: Array<{ role?: string; content?: unknown }> | null | undefined): boolean {
  return (messages || []).some((message) => message?.role === "assistant" && String(message.content ?? "").includes(UPGRADE_WIDGET));
}

/** One upgrade button per thread. A reply keeps the first token only when none came before it. */
export function limitUpgradeWidgets(content: string, alreadyShown: boolean): string {
  if (!content.includes(UPGRADE_WIDGET)) return content;
  if (alreadyShown) {
    return content.replaceAll(UPGRADE_WIDGET, "").replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
  }
  let seen = false;
  return content.replaceAll(UPGRADE_WIDGET, () => {
    if (seen) return "";
    seen = true;
    return UPGRADE_WIDGET;
  }).replace(/\n{3,}/g, "\n\n");
}

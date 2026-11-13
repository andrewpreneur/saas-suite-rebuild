// Some requests look like CSS tweaks but CSS cannot do them. Copilot used to save
// that code and say "Done!", which left dead code in the customer's stylesheet.
// Refuse these before writing so the model has to tell the user the truth.

const IMPOSSIBLE: Array<{ re: RegExp; reason: string }> = [
  {
    re: /favicon|link\s*\[\s*rel|apple-touch-icon|\bhref\s*:/i,
    reason:
      "CSS cannot change the browser-tab icon (favicon) or any link/href. Browsers ignore it. The favicon comes from HighLevel's own white-label branding, not SaaSSuite CSS.",
  },
  {
    re: /<\s*(?:script|title|meta|link)\b|\btitle\s*\{|document\.title/i,
    reason: "CSS cannot change the page title, meta tags or scripts.",
  },
];

/** Returns a reason when the CSS cannot work, otherwise null. */
export function impossibleCssReason(css: string, note = ""): string | null {
  const text = `${css}\n${note}`;
  for (const item of IMPOSSIBLE) if (item.re.test(text)) return item.reason;
  return null;
}

export function impossibleCssMessage(reason: string): string {
  return `NOT DONE. Nothing was saved. ${reason} Tell the user plainly that this is not possible with SaaSSuite custom CSS. Do not suggest another CSS variant, and do not name a HighLevel setting unless a tool result confirmed it exists. Offer human_handover if they still want help.`;
}

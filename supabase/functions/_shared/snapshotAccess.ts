// Paid Menu Link Removal snapshot. Server-only: never import this from client code.
// Free (STARTER) and logged-out sessions must not receive the URL in a prompt, tool result, or reply.

export const SNAPSHOT_SHARE_ID = "9aTIob1kR5WoGoRtNzin";
export const STANDARD_SNAPSHOT_URL = `https://affiliates.gohighlevel.com/?fp_ref=howtousehighlevel&share=${SNAPSHOT_SHARE_ID}`;

const ENTITLED_PLANS = new Set(["BASIC", "ADVANCED", "PREMIUM", "ENHANCED"]);

export type SnapshotAccount = {
  plan?: string | null;
  snapshot_access?: boolean | null;
  premium_support?: boolean | null;
} | null | undefined;

/** Plan, the snapshot_access flag, Premium Support, or a verified kit purchase. */
export function snapshotEntitled(user: SnapshotAccount, options?: { kitPurchased?: boolean }): boolean {
  if (options?.kitPurchased) return true;
  if (!user) return false;
  if (user.snapshot_access === true) return true;
  if (user.premium_support === true) return true;
  return ENTITLED_PLANS.has(String(user.plan || "").trim().toUpperCase());
}

export function redactSnapshotSecrets(text: string, entitled: boolean): string {
  if (entitled || !text) return text;
  return String(text)
    .replace(/https?:\/\/affiliates\.gohighlevel\.com\/\S*/gi, "")
    .replace(new RegExp(SNAPSHOT_SHARE_ID, "gi"), "");
}

/** Hold back a short tail so a share id split across stream chunks is removed before it is sent. */
export function createSnapshotRedactor(entitled: boolean) {
  if (entitled) return { push: (delta: string) => delta, flush: () => "" };
  let hold = "";
  const tail = STANDARD_SNAPSHOT_URL.length;
  return {
    push(delta: string) {
      hold += delta;
      if (hold.length <= tail) return "";
      const safe = hold.slice(0, hold.length - tail);
      hold = hold.slice(safe.length);
      return redactSnapshotSecrets(safe, false);
    },
    flush() {
      const out = redactSnapshotSecrets(hold, false);
      hold = "";
      return out;
    },
  };
}

export function redactChatMessages<T extends { content?: unknown }>(messages: T[], entitled: boolean): T[] {
  if (entitled) return messages;
  return messages.map((message) => {
    if (typeof message.content === "string") {
      return { ...message, content: redactSnapshotSecrets(message.content, false) };
    }
    if (Array.isArray(message.content)) {
      return {
        ...message,
        content: message.content.map((part) => {
          if (part && typeof part === "object" && (part as { type?: string }).type === "text" && typeof (part as { text?: string }).text === "string") {
            return { ...part, text: redactSnapshotSecrets((part as { text: string }).text, false) };
          }
          return part;
        }),
      };
    }
    return message;
  });
}

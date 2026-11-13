// Customers who asked to stay in the chat must not be promised an email update.
// The hub front end still generates the sentence; the database trigger rewrites
// it on insert, and the in-repo AI prompt uses the same check.

const IN_CHAT_PREF_RE = /keep it in this chat|in-chat only|in this chat only|in-chat-only|chat only/i;
const EMAIL_UPDATE_RE = /you(?:'|’)ll get an email update|you will get an email update|you(?:'|’)ll receive an email update/gi;

export function messageText(content: unknown): string {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content.map((part) => (typeof part === "string" ? part : String(part?.text || ""))).join(" ");
  }
  return "";
}

export function messagesPreferInChat(messages: Array<{ role?: string; content?: unknown }> | null | undefined): boolean {
  return (messages || []).some((message) => message?.role === "user" && IN_CHAT_PREF_RE.test(messageText(message.content)));
}

export function rewriteEmailUpdatePromise(content: string, inChatOnly: boolean): string {
  if (!inChatOnly || !content) return content;
  return content.replace(EMAIL_UPDATE_RE, "you'll get the update in this chat");
}

export function noLiveHumanReply(inChatOnly: boolean): string {
  const channel = inChatOnly
    ? "follow up in this chat, usually within 24 hours"
    : "follow up by email, usually within 24 hours";
  return `Live chat with a team member isn't available here, but I can open a support ticket for you and our team will ${channel}. Want me to do that? Or tell me what's going on and I'll do my best to solve it with you right now.`;
}

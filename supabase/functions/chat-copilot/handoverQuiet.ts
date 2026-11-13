/** How long a human reply keeps the Help composer on the team, matching the AI pause. */
export const HANDOVER_QUIET_MS = 24 * 60 * 60 * 1000;

export const ADMIN_REPLY_TOOL = "admin_reply";

/** Canned line returned by chat-copilot while copilot_ai_paused is set. Not a model reply. */
export const QUIET_HANDOVER_PREFIX = "A member of the SaaSSuite team is handling this conversation";

export type QuietMessage = {
  role: string;
  actions?: Array<{ tool?: string } | null> | null;
  timestamp?: Date | string | number | null;
};

export function messageIsTeamReply(message: QuietMessage): boolean {
  return (
    message.role === "assistant" &&
    Array.isArray(message.actions) &&
    message.actions.some((action) => action?.tool === ADMIN_REPLY_TOOL)
  );
}

/** Explicit ask to bring the copilot back. Same rule the chat-copilot pause check uses. */
export function isAiResumeRequest(text: string): boolean {
  return isExplicitAiResumeRequest(text);
}

export function latestTeamReplyAt(messages: QuietMessage[]): number | null {
  let latest: number | null = null;
  for (const message of messages) {
    if (!messageIsTeamReply(message) || message.timestamp == null) continue;
    const at = new Date(message.timestamp).getTime();
    if (!Number.isFinite(at)) continue;
    if (latest == null || at > latest) latest = at;
  }
  return latest;
}

export function teamReplyWithinQuietWindow(messages: QuietMessage[], now = Date.now()): boolean {
  const at = latestTeamReplyAt(messages);
  return at != null && now - at < HANDOVER_QUIET_MS && now - at > -60_000;
}

/**
 * Human owns the thread: the Help button already says a person has the chat,
 * or a teammate posted inside the quiet window and the customer has not asked
 * for the AI back since that post.
 */
export function humanThreadIsQuiet(input: {
  isHandedOver: boolean;
  hasRecentTeamReply: boolean;
  resumedAt: number | null;
  latestTeamReplyAt: number | null;
}): boolean {
  if (input.isHandedOver) return true;
  if (
    input.resumedAt != null &&
    !(input.latestTeamReplyAt != null && input.latestTeamReplyAt > input.resumedAt)
  ) {
    return false;
  }
  return input.hasRecentTeamReply;
}

/**
 * The handoff line tells the customer to say this. Kept narrower than the
 * server pause check so "enable the assistant" still goes to the teammate.
 */
export function isExplicitAiResumeRequest(text: string): boolean {
  const t = String(text || "").toLowerCase();
  return (
    /\bturn (the )?(ai )?copilot back on\b/.test(t) ||
    /\bturn (the )?ai( copilot)? back on\b/.test(t) ||
    /\bbring (the )?(ai|copilot|co-pilot) back\b/.test(t)
  );
}

/** Ordinary replies stay with the team. "Turn the AI copilot back on" still reaches the model. */
export function replyShouldStayWithHuman(input: {
  isHandedOver: boolean;
  hasRecentTeamReply: boolean;
  resumedAt: number | null;
  latestTeamReplyAt: number | null;
  text: string;
}): boolean {
  if (isExplicitAiResumeRequest(input.text)) return false;
  return humanThreadIsQuiet(input);
}

/** Status line only while waiting for the first teammate message. Never replaces the composer. */
export function showHandoverWaitingNote(input: {
  isHandedOver: boolean;
  hasTeamReply: boolean;
}): boolean {
  return input.isHandedOver && !input.hasTeamReply;
}

export function isQuietHandoverAck(
  data:
    | {
        handover?: boolean;
        quiet?: boolean;
        content?: unknown;
        actions?: unknown[] | null;
      }
    | null
    | undefined,
): boolean {
  if (!data) return false;
  if (data.quiet === true) return true;
  if (data.handover !== true) return false;
  if (Array.isArray(data.actions) && data.actions.length > 0) return false;
  return typeof data.content === "string" && data.content.startsWith(QUIET_HANDOVER_PREFIX);
}

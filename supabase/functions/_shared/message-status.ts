/** Statuses a customer message can be in. Provider webhooks map onto this list. */
export const MESSAGE_STATUSES = [
  "queued",
  "sent",
  "delivered",
  "opened",
  "clicked",
  "bounced",
  "failed",
  "complained",
  "suppressed",
] as const;

export type MessageStatus = (typeof MESSAGE_STATUSES)[number];

const STATUS_SET = new Set<string>(MESSAGE_STATUSES);

export function normalizeMessageStatus(value: unknown): MessageStatus | null {
  if (typeof value !== "string") return null;
  const status = value.trim().toLowerCase();
  return STATUS_SET.has(status) ? (status as MessageStatus) : null;
}

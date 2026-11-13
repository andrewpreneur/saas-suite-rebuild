export const AGENCY_MANUAL_SOURCE = "agency_manual";

export const mayCreateChatTicket = (agency: unknown, chat: unknown, ticket: unknown) =>
  agency === true && chat === true && ticket === true;

/** Tickets opened from the queue do not have a conversation to be allowed to see. */
export const mayCreateManualTicket = (agency: unknown, ticket: unknown) =>
  agency === true && ticket === true;

export function manualTicketRequest(source: unknown) {
  return source === AGENCY_MANUAL_SOURCE;
}

/** Chat tickets keep the conversation id. A queue ticket uses that id, or the customer email. */
export function resolvedChatIdentifier(input: {
  source?: string | null;
  userIdentifier?: string | null;
  customerEmail: string;
}) {
  const typed = (input.userIdentifier || "").trim();
  if (manualTicketRequest(input.source)) return typed || input.customerEmail.trim().toLowerCase();
  return typed;
}

export function ticketInsertFields(input: {
  manual: boolean;
  requestText: string;
  transcript: string;
  identifier: string;
  attachmentUrls: string[];
  assignedEmail: string;
  assignedAt: string;
}) {
  const request_text = input.transcript
    ? `${input.requestText}\n\n--- Chat history ---\n${input.transcript}`
    : input.requestText;
  return {
    source_chat_identifier: input.identifier,
    request_text,
    attachment_url: input.attachmentUrls[0] || null,
    attachment_urls: input.attachmentUrls,
    assigned_to: input.assignedEmail,
    assigned_by: input.assignedEmail,
    assigned_at: input.assignedAt,
    ...(input.manual ? { source: AGENCY_MANUAL_SOURCE } : {}),
  };
}

export function ticketConfirmationText(
  ticket: {
    customer_name: string;
    ticket_number: number;
    issue_category: string;
    request_text: string;
    attachment_urls?: string[] | null;
  },
  manual: boolean,
) {
  const urls = ticket.attachment_urls || [];
  const opened = manual
    ? `We've created support ticket #${ticket.ticket_number}.`
    : `We've created support ticket #${ticket.ticket_number} from your chat.`;
  return `Hi ${ticket.customer_name},\n\n${opened}\nCategory: ${ticket.issue_category}\n\n${ticket.request_text}\n\n${urls.length ? "Attachments:\n" + urls.join("\n") + "\n\n" : ""}Your support team will follow up with you.\n\nThe Support Team`;
}

export function manualTicketUpdateMessage(ticket: {
  customer_name: string;
  ticket_number: number;
  issue_category: string;
}) {
  return `Hi ${ticket.customer_name},\n\nWe've opened support ticket #${ticket.ticket_number} (${ticket.issue_category}) so our team can follow up. We'll update you here as soon as we have progress.\n\nTo view the full response, log in to your portal, open Support, and scroll down to Tickets.\n\nThe Support Team`;
}

export function chatTranscript(messages: {content: string; role: string; created_at: string}[]) {
  return [...messages].sort((a, b) => a.created_at.localeCompare(b.created_at))
    .map(m => `[${m.created_at}] ${m.role === "user" ? "Customer" : m.role === "assistant" ? "AI" : "Support team"}:\n${m.content}`).join("\n\n");
}
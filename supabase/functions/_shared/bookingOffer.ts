export const AGENCY_BOOKING_URL = "https://saassuite.ai/book";

const BOOKING_ASK = /\b(book(?:\s+a|\s+an|\s+the)?(?:\s+call|\s+time|\s+meeting|\s+demo)?|booking|schedule(?:\s+a|\s+an)?(?:\s+call|\s+time|\s+meeting|\s+demo)?|talk to (?:someone|a person|a human|you|us|the team)|speak (?:to|with) (?:someone|a person|a human|you|us|the team)|call (?:me|us)|hop on a call|get on a call|appointment)\b/i;

export function userWantsBooking(text: string): boolean {
  return BOOKING_ASK.test(String(text || ""));
}

/** Put the booking link in the first reply that asks for a person, a call, or a booking. */
export function ensureBookingOffer(content: string, latestUserText: string, options?: { widget?: boolean }): string {
  if (!userWantsBooking(latestUserText)) return content;
  let out = String(content || "").trim();
  if (!out.includes(AGENCY_BOOKING_URL)) {
    out = `${out}\n\nYou can book a time here: ${AGENCY_BOOKING_URL}`.trim();
  }
  if (options?.widget && !out.includes("[[widget:book_call]]")) {
    out += "\n[[widget:book_call]]";
  }
  return out;
}

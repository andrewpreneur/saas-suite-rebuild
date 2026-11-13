interface Msg { content: string; role: string; created_at: string; sender_type?: string }

const stripUrls = (t: string) => t.replace(/https?:\/\/\S+/g, "[attachment]").replace(/\s+/g, " ").trim();

/** Quick, readable summary of the chat: the customer's first ask plus the recent exchange. */
export function summarizeChat(messages: Msg[], who: string): string {
  const userMsgs = messages.filter((m) => m.role === "user");
  const first = userMsgs[0] ? stripUrls(userMsgs[0].content).slice(0, 300) : "";
  const recent = messages.slice(-6).map((m) => {
    const label = m.role === "user" ? who : m.role === "assistant" ? "AI" : "Team";
    return `- ${label}: ${stripUrls(m.content).slice(0, 200)}`;
  });
  return [
    `Opened from a support chat with ${who} (${messages.length} messages).`,
    first ? `\nCustomer's request: ${first}` : "",
    recent.length ? `\nRecent conversation:\n${recent.join("\n")}` : "",
  ].join("");
}

/** Queue tickets start blank. Chat tickets keep the conversation summary. */
export function initialTicketDescription(manual: boolean, messages: Msg[], who: string) {
  return manual ? "" : summarizeChat(messages, who);
}

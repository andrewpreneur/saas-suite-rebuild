/** Columns that exist on public.ai_chat_failures. Do not add fields. */
export type AiChatFailureInsert = {
  agency_id: string | null;
  created_at: string;
  detail: string | null;
  stage: string;
  status: number | null;
  user_identifier: string | null;
};

export const AI_FAILURE_MESSAGE_LIMIT = 4000;

export function lastUserMessageText(messages: unknown): string {
  if (!Array.isArray(messages)) return "";
  for (let i = messages.length - 1; i >= 0; i--) {
    const message = messages[i] as { role?: string; content?: unknown } | null;
    if (!message || message.role !== "user") continue;
    if (typeof message.content === "string") return message.content.slice(0, AI_FAILURE_MESSAGE_LIMIT);
    if (Array.isArray(message.content)) {
      const text = message.content.map((part) => {
        if (typeof part === "string") return part;
        if (part && typeof part === "object" && typeof (part as { text?: unknown }).text === "string") {
          return (part as { text: string }).text;
        }
        return "";
      }).join("");
      return text.slice(0, AI_FAILURE_MESSAGE_LIMIT);
    }
  }
  return "";
}

/** Email or subject from a JWT payload. The signature is not checked; this is a log hint only. */
export function unverifiedJwtHint(authorization: string | null): { email: string | null; sub: string | null } {
  try {
    const token = (authorization || "").replace(/^Bearer\s+/i, "").trim();
    const part = token.split(".")[1];
    if (!part) return { email: null, sub: null };
    const padded = part.replace(/-/g, "+").replace(/_/g, "/");
    const json = JSON.parse(atob(padded.padEnd(Math.ceil(padded.length / 4) * 4, "=")));
    return {
      email: typeof json?.email === "string" ? json.email.slice(0, 320) : null,
      sub: typeof json?.sub === "string" ? json.sub.slice(0, 320) : null,
    };
  } catch {
    return { email: null, sub: null };
  }
}

export function failurePage(value: unknown): string {
  if (typeof value !== "string") return "";
  const path = value.split(/[?#]/)[0].trim();
  if (!path.startsWith("/") && !/^https?:\/\//i.test(path)) return "";
  return path.slice(0, 300);
}

function detailFrom(parts: string[]): string | null {
  const text = parts.filter(Boolean).join("\n").slice(0, 4500);
  return text || null;
}

export function authFailureRow(input: {
  status: number;
  userEmail?: string | null;
  authorization?: string | null;
  page?: string | null;
  message?: string | null;
  agencyId?: string | null;
  now?: string;
}): AiChatFailureInsert {
  const hint = unverifiedJwtHint(input.authorization || null);
  const user = (input.userEmail || hint.email || hint.sub || "").trim().slice(0, 320) || null;
  const message = (input.message || "").slice(0, AI_FAILURE_MESSAGE_LIMIT);
  const page = failurePage(input.page);
  return {
    agency_id: input.agencyId?.trim().slice(0, 80) || null,
    user_identifier: user,
    stage: input.status === 403 ? "auth_forbidden" : "auth_rejected",
    status: input.status,
    detail: detailFrom([
      page ? `path: ${page}` : "",
      hint.email ? `jwt_email: ${hint.email}` : "",
      hint.sub ? `jwt_sub: ${hint.sub}` : "",
      message ? `message: ${message}` : "",
    ]),
    created_at: input.now || new Date().toISOString(),
  };
}

export function insertFailureRow(input: {
  stage: "user_message_insert" | "assistant_message_insert";
  user?: string | null;
  content?: string | null;
  error?: string | null;
  agencyId?: string | null;
  now?: string;
}): AiChatFailureInsert {
  const content = (input.content || "").slice(0, AI_FAILURE_MESSAGE_LIMIT);
  return {
    agency_id: input.agencyId?.trim().slice(0, 80) || null,
    user_identifier: (input.user || "").trim().slice(0, 320) || null,
    stage: input.stage,
    status: null,
    detail: detailFrom([
      input.error ? `error: ${input.error.slice(0, 500)}` : "",
      content ? `message: ${content}` : "",
    ]),
    created_at: input.now || new Date().toISOString(),
  };
}

/** Best-effort write. A logging failure is printed and never thrown. */
export async function recordAiChatFailure(
  insert: (row: AiChatFailureInsert) => PromiseLike<{ error: { message?: string } | null }>,
  row: AiChatFailureInsert,
) {
  try {
    const { error } = await insert(row);
    if (error) console.error("ai_chat_failures:", error.message || error);
  } catch (error) {
    console.error("ai_chat_failures:", error);
  }
}

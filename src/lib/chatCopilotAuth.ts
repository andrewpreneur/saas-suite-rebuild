/** User-facing copy when Help chat has no usable login session. */
export const SESSION_EXPIRED_MESSAGE = "Your session expired, please sign in again";

/** Shown when chat-copilot still returns 401 after one session refresh. */
export const SESSION_REFRESH_PROMPT = "Your session expired, please refresh";

export const CHAT_COPILOT_URL = "https://backend-disconnected.invalid/functions/v1/chat-copilot";

/** Refresh this many seconds before expiry so the request still carries a live user JWT. */
export const CHAT_SESSION_REFRESH_LEEWAY_SECONDS = 60;

export class ChatSessionExpiredError extends Error {
  readonly status = 401;

  constructor() {
    super(SESSION_EXPIRED_MESSAGE);
    this.name = "ChatSessionExpiredError";
  }
}

export type ChatAccessSession = {
  access_token?: string | null;
  expires_at?: number | null;
};

export type ChatAuth = {
  getSession: () => PromiseLike<{
    data: { session: ChatAccessSession | null };
  }>;
  refreshSession: () => PromiseLike<{
    data: { session: ChatAccessSession | null };
  }>;
};

export type ChatFailure = {
  toast: string;
  assistant?: string;
};

export function sessionExpiresSoon(
  session: ChatAccessSession,
  nowSeconds: number,
  leewaySeconds = CHAT_SESSION_REFRESH_LEEWAY_SECONDS,
): boolean {
  return typeof session.expires_at === "number" && session.expires_at <= nowSeconds + leewaySeconds;
}

export async function getChatAccessToken(
  auth: ChatAuth,
  nowSeconds = Math.floor(Date.now() / 1000),
): Promise<string> {
  const { data } = await auth.getSession();
  const session = data.session;
  const current = session?.access_token;
  if (!current) throw new ChatSessionExpiredError();
  if (!sessionExpiresSoon(session, nowSeconds)) return current;

  try {
    const refreshed = await auth.refreshSession();
    const next = refreshed.data.session?.access_token;
    if (!next) throw new ChatSessionExpiredError();
    return next;
  } catch (error) {
    if (error instanceof ChatSessionExpiredError) throw error;
    throw new ChatSessionExpiredError();
  }
}

function postChat(
  fetchImpl: (url: string, init: RequestInit) => Promise<Response>,
  token: string,
  body: unknown,
): Promise<Response> {
  return fetchImpl(CHAT_COPILOT_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });
}

export async function fetchChatCopilot(
  body: unknown,
  options: {
    auth: ChatAuth;
    fetchImpl?: (url: string, init: RequestInit) => Promise<Response>;
    nowSeconds?: number;
  },
): Promise<Response> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const token = await getChatAccessToken(options.auth, options.nowSeconds);
  const response = await postChat(fetchImpl, token, body);
  if (response.status !== 401) return response;
  try {
    const refreshed = await options.auth.refreshSession();
    const next = refreshed.data.session?.access_token;
    if (!next) return response;
    return await postChat(fetchImpl, next, body);
  } catch {
    return response;
  }
}

export function functionErrorStatus(error: unknown): number | undefined {
  if (!error || typeof error !== "object") return undefined;
  const status = (error as { context?: { status?: unknown } }).context?.status;
  return typeof status === "number" ? status : undefined;
}

type InvokeResult = { data: unknown; error: unknown };

/** One refresh-and-retry for supabase.functions.invoke("chat-copilot"). */
export async function invokeChatCopilot(
  invoke: (body: unknown) => PromiseLike<InvokeResult>,
  refreshSession: ChatAuth["refreshSession"],
  body: unknown,
): Promise<InvokeResult> {
  let result = await invoke(body);
  if (functionErrorStatus(result.error) !== 401) return result;
  try {
    const refreshed = await refreshSession();
    if (!refreshed.data.session?.access_token) return result;
    result = await invoke(body);
  } catch {
    /* keep the refused response */
  }
  return result;
}

export function formatChatFailureDetail(status: number, errorMessage?: string | null): string {
  const message = (errorMessage || "").replace(/\s+/g, " ").trim().slice(0, 500);
  return message ? `HTTP ${status}: ${message}` : `HTTP ${status}`;
}

export async function readResponseErrorMessage(response: Response): Promise<string> {
  try {
    const text = await response.clone().text();
    if (!text) return "";
    try {
      const parsed = JSON.parse(text) as { error?: unknown; message?: unknown };
      if (typeof parsed?.error === "string") return parsed.error;
      if (typeof parsed?.message === "string") return parsed.message;
    } catch {
      /* plain text body */
    }
    return text.slice(0, 500);
  } catch {
    return "";
  }
}

export async function readFunctionErrorMessage(error: unknown): Promise<string> {
  const context = (error as { context?: Response; message?: string } | null)?.context;
  try {
    if (context && typeof context.clone === "function") {
      const text = await context.clone().text();
      if (text) {
        try {
          const parsed = JSON.parse(text) as { error?: unknown; message?: unknown };
          if (typeof parsed?.error === "string") return parsed.error;
          if (typeof parsed?.message === "string") return parsed.message;
        } catch {
          return text.slice(0, 500);
        }
      }
    }
  } catch {
    /* body already consumed */
  }
  const message = (error as { message?: unknown } | null)?.message;
  return typeof message === "string" ? message : "";
}

/**
 * Maps a chat-copilot HTTP status to the existing Help toasts.
 * 429 and 402 stay on the send path only. 401 means the session still failed after a refresh.
 * A 2xx response returns null so the caller can read the JSON body.
 */
export function classifyChatFailure(
  status: number,
  scope: "deliver" | "human",
): ChatFailure | null {
  if (status >= 200 && status < 300) return null;
  if (status === 401) {
    return {
      toast: SESSION_REFRESH_PROMPT,
      ...(scope === "deliver" ? { assistant: SESSION_REFRESH_PROMPT } : {}),
    };
  }
  if (scope === "deliver" && status === 429) {
    return { toast: "Rate limit exceeded. Please try again in a moment." };
  }
  if (scope === "deliver" && status === 402) {
    return { toast: "AI credits exhausted. Please add more credits." };
  }
  if (scope === "human") {
    return { toast: "Could not reach the team. Please try again." };
  }
  return {
    toast: "Failed to send message. Please try again.",
    assistant: "I'm sorry, I encountered an error. Please try again.",
  };
}

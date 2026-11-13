import { describe, expect, test } from "bun:test";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  CHAT_COPILOT_URL,
  CHAT_SESSION_REFRESH_LEEWAY_SECONDS,
  ChatSessionExpiredError,
  SESSION_EXPIRED_MESSAGE,
  SESSION_REFRESH_PROMPT,
  classifyChatFailure,
  fetchChatCopilot,
  formatChatFailureDetail,
  functionErrorStatus,
  invokeChatCopilot,
  type ChatAuth,
} from "../src/lib/chatCopilotAuth";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const ANON_JWT_MARKER =
  "eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNqcWVlYnllcXR6enFtbXd2ZmdhIiwicm9sZSI6ImFub24i";
const NOW = 1_700_000_000;

function authWith(
  session: { access_token?: string | null; expires_at?: number | null } | null,
  refreshed: { access_token?: string | null } | null = null,
): ChatAuth & { refreshCalls: number } {
  let refreshCalls = 0;
  return {
    get refreshCalls() {
      return refreshCalls;
    },
    getSession: async () => ({ data: { session } }),
    refreshSession: async () => {
      refreshCalls += 1;
      return { data: { session: refreshed } };
    },
  };
}

function captureFetch() {
  const calls: Array<{ url: string; init: RequestInit }> = [];
  const fetchImpl = async (url: string, init: RequestInit) => {
    calls.push({ url, init });
    return new Response(JSON.stringify({ content: "ok" }), { status: 200 });
  };
  return { calls, fetchImpl };
}

describe("chat copilot session token", () => {
  test("sends the session access token and not the anon key", async () => {
    const auth = authWith({ access_token: "user-access-token", expires_at: NOW + 3600 });
    const { calls, fetchImpl } = captureFetch();
    const body = { messages: [{ role: "user", content: "hello" }], userEmail: "a@example.com" };
    await fetchChatCopilot(body, { auth, fetchImpl, nowSeconds: NOW });
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe(CHAT_COPILOT_URL);
    expect(calls[0].init.method).toBe("POST");
    expect(calls[0].init.headers).toEqual({
      "Content-Type": "application/json",
      Authorization: "Bearer user-access-token",
    });
    expect(JSON.stringify(calls[0].init.headers)).not.toContain(ANON_JWT_MARKER);
    expect(calls[0].init.body).toBe(JSON.stringify(body));
    expect(auth.refreshCalls).toBe(0);
  });

  test("refreshes a token that is expired or inside the leeway window", async () => {
    const soon = authWith(
      { access_token: "stale", expires_at: NOW + CHAT_SESSION_REFRESH_LEEWAY_SECONDS },
      { access_token: "refreshed" },
    );
    const { calls, fetchImpl } = captureFetch();
    await fetchChatCopilot({ requestHuman: true }, { auth: soon, fetchImpl, nowSeconds: NOW });
    expect(soon.refreshCalls).toBe(1);
    expect((calls[0].init.headers as Record<string, string>).Authorization).toBe(
      "Bearer refreshed",
    );

    const expired = authWith({ access_token: "old", expires_at: NOW - 5 }, { access_token: "new" });
    await fetchChatCopilot({}, { auth: expired, fetchImpl, nowSeconds: NOW });
    expect(expired.refreshCalls).toBe(1);
  });

  test("keeps a token that expires after the leeway window", async () => {
    const auth = authWith({
      access_token: "still-good",
      expires_at: NOW + CHAT_SESSION_REFRESH_LEEWAY_SECONDS + 1,
    });
    const { calls, fetchImpl } = captureFetch();
    await fetchChatCopilot({}, { auth, fetchImpl, nowSeconds: NOW });
    expect(auth.refreshCalls).toBe(0);
    expect((calls[0].init.headers as Record<string, string>).Authorization).toBe(
      "Bearer still-good",
    );
  });

  test("missing session or a failed refresh asks the customer to sign in again", async () => {
    const { calls, fetchImpl } = captureFetch();
    await expect(
      fetchChatCopilot({}, { auth: authWith(null), fetchImpl, nowSeconds: NOW }),
    ).rejects.toThrow(ChatSessionExpiredError);
    await expect(
      fetchChatCopilot(
        {},
        {
          auth: authWith({ access_token: "old", expires_at: NOW - 1 }, null),
          fetchImpl,
          nowSeconds: NOW,
        },
      ),
    ).rejects.toMatchObject({ message: SESSION_EXPIRED_MESSAGE, status: 401 });
    expect(calls).toHaveLength(0);
  });

  test("a refresh that throws is treated as a signed-out session", async () => {
    const auth: ChatAuth = {
      getSession: async () => ({ data: { session: { access_token: "old", expires_at: NOW - 1 } } }),
      refreshSession: async () => {
        throw new Error("network");
      },
    };
    await expect(
      fetchChatCopilot({}, { auth, fetchImpl: async () => new Response(null), nowSeconds: NOW }),
    ).rejects.toBeInstanceOf(ChatSessionExpiredError);
  });
});

describe("chat copilot failure copy", () => {
  test("keeps rate limit and credit handling on send", () => {
    expect(classifyChatFailure(429, "deliver")).toEqual({
      toast: "Rate limit exceeded. Please try again in a moment.",
    });
    expect(classifyChatFailure(402, "deliver")).toEqual({
      toast: "AI credits exhausted. Please add more credits.",
    });
    expect(classifyChatFailure(429, "human")?.toast).toBe(
      "Could not reach the team. Please try again.",
    );
  });

  test("401 and other send failures stay distinct", () => {
    expect(classifyChatFailure(401, "deliver")).toEqual({
      toast: SESSION_REFRESH_PROMPT,
      assistant: SESSION_REFRESH_PROMPT,
    });
    expect(classifyChatFailure(401, "human")).toEqual({ toast: SESSION_REFRESH_PROMPT });
    expect(classifyChatFailure(500, "deliver")).toEqual({
      toast: "Failed to send message. Please try again.",
      assistant: "I'm sorry, I encountered an error. Please try again.",
    });
    expect(classifyChatFailure(200, "deliver")).toBeNull();
    expect(SESSION_EXPIRED_MESSAGE).toBe("Your session expired, please sign in again");
    expect(SESSION_REFRESH_PROMPT).toBe("Your session expired, please refresh");
    expect(formatChatFailureDetail(401, "Please sign in again.")).toBe("HTTP 401: Please sign in again.");
    expect(formatChatFailureDetail(500, "")).toBe("HTTP 500");
  });
});

describe("chat copilot 401 retry", () => {
  test("refreshes and retries once when the server returns 401", async () => {
    const auth = authWith(
      { access_token: "stale-but-unexpired", expires_at: NOW + 3600 },
      { access_token: "fresh" },
    );
    const calls: string[] = [];
    const fetchImpl = async (_url: string, init: RequestInit) => {
      const token = (init.headers as Record<string, string>).Authorization;
      calls.push(token);
      if (calls.length === 1) return new Response(JSON.stringify({ error: "Please sign in again." }), { status: 401 });
      return new Response(JSON.stringify({ content: "ok" }), { status: 200 });
    };
    const response = await fetchChatCopilot({ messages: [] }, { auth, fetchImpl, nowSeconds: NOW });
    expect(auth.refreshCalls).toBe(1);
    expect(calls).toEqual(["Bearer stale-but-unexpired", "Bearer fresh"]);
    expect(response.status).toBe(200);
  });

  test("returns the second 401 and does not retry again", async () => {
    const auth = authWith(
      { access_token: "old", expires_at: NOW + 3600 },
      { access_token: "still-old" },
    );
    let calls = 0;
    const fetchImpl = async () => {
      calls += 1;
      return new Response(JSON.stringify({ error: "Invalid session" }), { status: 401 });
    };
    const response = await fetchChatCopilot({}, { auth, fetchImpl, nowSeconds: NOW });
    expect(response.status).toBe(401);
    expect(calls).toBe(2);
    expect(auth.refreshCalls).toBe(1);
  });

  test("a refresh that throws keeps the original 401", async () => {
    const auth: ChatAuth = {
      getSession: async () => ({ data: { session: { access_token: "old", expires_at: NOW + 3600 } } }),
      refreshSession: async () => {
        throw new Error("network");
      },
    };
    let calls = 0;
    const response = await fetchChatCopilot({}, {
      auth,
      fetchImpl: async () => {
        calls += 1;
        return new Response(JSON.stringify({ error: "Invalid session" }), { status: 401 });
      },
      nowSeconds: NOW,
    });
    expect(response.status).toBe(401);
    expect(calls).toBe(1);
  });

  test("invoke retries once after refreshSession", async () => {
    const bodies: unknown[] = [];
    let calls = 0;
    const result = await invokeChatCopilot(
      async (body) => {
        bodies.push(body);
        calls += 1;
        if (calls === 1) return { data: null, error: { message: "401", context: { status: 401 } } };
        return { data: { content: "ok" }, error: null };
      },
      async () => ({ data: { session: { access_token: "fresh" } } }),
      { messages: [{ role: "user", content: "hello" }] },
    );
    expect(calls).toBe(2);
    expect(bodies).toHaveLength(2);
    expect(result.error).toBeNull();
    expect(functionErrorStatus({ context: { status: 403 } })).toBe(403);
    expect(functionErrorStatus(null)).toBeUndefined();
  });
});

describe("hardcoded anon bearer scan", () => {
  test("Help chat uses the session helper on both calls and src has no other anon JWT", () => {
    const hook = readFileSync(join(ROOT, "src/hooks/useChatCoPilot.ts"), "utf8");
    expect(hook).not.toContain(ANON_JWT_MARKER);
    expect(hook.match(/fetchChatCopilot\(/g)?.length).toBe(2);
    expect(hook).toContain('classifyChatFailure(response.status, "deliver")');
    expect(hook).toContain('classifyChatFailure(response.status, "human")');
    expect(hook).toContain("ChatSessionExpiredError");
    expect(hook).toContain("formatChatFailureDetail");
    expect(hook).toContain('return "kept"');

    const hits: string[] = [];
    const walk = (dir: string) => {
      for (const name of readdirSync(dir)) {
        const path = join(dir, name);
        if (statSync(path).isDirectory()) {
          if (name === "node_modules" || name === "dist") continue;
          walk(path);
          continue;
        }
        if (!/\.(ts|tsx)$/.test(name)) continue;
        if (path.endsWith(join("src", "integrations", "supabase", "client.ts"))) continue;
        if (readFileSync(path, "utf8").includes(ANON_JWT_MARKER))
          hits.push(path.slice(ROOT.length));
      }
    };
    walk(join(ROOT, "src"));
    expect(hits).toEqual([]);
  });
});

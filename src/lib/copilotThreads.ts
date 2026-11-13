import { focusFromPath } from "@/lib/copilotFocus";

export const CONTINUED_CHAT_TITLE = "Continue in Copilot";
export const SNAPSHOT_CHAT_TITLE =
  "Show me the Menu Link Removal snapshot and check my current plan eligibility first.";
export const FIRST_TIME_CHAT_TITLE = "First-time setup";

export type CopilotThreadRef = {
  id: string;
  title: string | null;
  kind: string;
  updated_at: string;
};

export type CopilotRoute =
  | { onCopilotPath: false; kind: "away" }
  | { onCopilotPath: true; kind: "home" }
  | { onCopilotPath: true; kind: "first-time" }
  | { onCopilotPath: true; kind: "focus"; focus: string }
  | { onCopilotPath: true; kind: "thread"; threadId: string };

/** Titles created by opening Copilot or tapping a shortcut, not by typing a new question. */
export function isQuickActionTitle(title: string | null | undefined): boolean {
  const text = (title || "").trim();
  if (!text) return false;
  return (
    text === CONTINUED_CHAT_TITLE ||
    text === SNAPSHOT_CHAT_TITLE ||
    text === FIRST_TIME_CHAT_TITLE ||
    text.startsWith("Learn ")
  );
}

export function parseCopilotRoute(pathname: string): CopilotRoute {
  const path = (pathname.split("?")[0] || "/").replace(/\/+$/, "") || "/";
  if (path === "/app/copilot") return { onCopilotPath: true, kind: "home" };
  if (path === "/app/copilot/first-time") return { onCopilotPath: true, kind: "first-time" };
  const focus = focusFromPath(path);
  if (focus) return { onCopilotPath: true, kind: "focus", focus };
  const match = path.match(/^\/app\/copilot\/([^/]+)$/);
  if (match) return { onCopilotPath: true, kind: "thread", threadId: decodeURIComponent(match[1]) };
  return { onCopilotPath: false, kind: "away" };
}

function newestFirst<T extends CopilotThreadRef>(threads: T[]): T[] {
  return [...threads].sort((a, b) => (a.updated_at < b.updated_at ? 1 : a.updated_at > b.updated_at ? -1 : 0));
}

/** Reuse the latest thread a shortcut already created instead of inserting another copy. */
export function findReusableThread<T extends CopilotThreadRef>(
  threads: T[],
  title: string,
  kind?: string,
): T | null {
  const want = title.trim();
  return (
    newestFirst(threads).find(
      (thread) => (thread.title || "").trim() === want && (!kind || thread.kind === kind),
    ) ?? null
  );
}

/** Newest saved chat. Opening Copilot resumes this thread. */
export function mostRecentThread<T extends CopilotThreadRef>(threads: T[]): T | null {
  return newestFirst(threads)[0] ?? null;
}

/**
 * Saved chat to show when Copilot opens without a thread in the URL.
 * Blank composer: explicit New chat, a sourced launcher handoff, or no chats yet.
 */
export function threadToResume<T extends CopilotThreadRef>(input: {
  threads: T[];
  explicitNewChat: boolean;
  routeKind: CopilotRoute["kind"];
  hasSourceHandoff: boolean;
}): T | null {
  if (input.explicitNewChat || input.hasSourceHandoff) return null;
  if (input.routeKind === "thread" || input.routeKind === "first-time" || input.routeKind === "focus") return null;
  return mostRecentThread(input.threads);
}

/** History shows one row per shortcut title. Typed chats are left as they are. */
export function dedupeQuickActionThreads<T extends CopilotThreadRef>(threads: T[]): T[] {
  const seen = new Set<string>();
  const kept: T[] = [];
  for (const thread of newestFirst(threads)) {
    const title = (thread.title || "").trim();
    if (isQuickActionTitle(title)) {
      const key = `${thread.kind}:${title}`;
      if (seen.has(key)) continue;
      seen.add(key);
    }
    kept.push(thread);
  }
  return kept;
}

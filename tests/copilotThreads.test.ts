import { describe, expect, test } from "bun:test";
import {
  CONTINUED_CHAT_TITLE,
  SNAPSHOT_CHAT_TITLE,
  dedupeQuickActionThreads,
  findReusableThread,
  mostRecentThread,
  parseCopilotRoute,
  threadToResume,
} from "../src/lib/copilotThreads";

const learn = (id: string, updated_at: string) => ({
  id,
  title: "Learn menu link removal",
  kind: "first_time",
  updated_at,
});

describe("copilot threads", () => {
  test("deep links stay on the copilot path and a thread id is not a feature focus", () => {
    expect(parseCopilotRoute("/app/copilot")).toEqual({ onCopilotPath: true, kind: "home" });
    expect(parseCopilotRoute("/app/copilot/first-time")).toEqual({ onCopilotPath: true, kind: "first-time" });
    expect(parseCopilotRoute("/app/copilot/menulinkremoval").kind).toBe("focus");
    expect(parseCopilotRoute("/app/copilot/brandingtool")).toEqual({
      onCopilotPath: true,
      kind: "focus",
      focus: "brandingtool",
    });
    expect(parseCopilotRoute("/app/copilot/abc-123")).toEqual({
      onCopilotPath: true,
      kind: "thread",
      threadId: "abc-123",
    });
    expect(parseCopilotRoute("/app/settings").onCopilotPath).toBe(false);
  });

  test("shortcut clicks reuse the newest matching thread", () => {
    const threads = [learn("old", "2026-01-01"), learn("new", "2026-02-01")];
    expect(findReusableThread(threads, "Learn menu link removal", "first_time")?.id).toBe("new");
    expect(findReusableThread(threads, CONTINUED_CHAT_TITLE)).toBeNull();
  });

  test("history keeps one row for each repeated shortcut and every typed chat", () => {
    const threads = [
      learn("a", "2026-01-01"),
      learn("b", "2026-03-01"),
      learn("c", "2026-02-01"),
      { id: "s1", title: SNAPSHOT_CHAT_TITLE, kind: "chat", updated_at: "2026-01-02" },
      { id: "s2", title: SNAPSHOT_CHAT_TITLE, kind: "chat", updated_at: "2026-04-01" },
      { id: "c1", title: CONTINUED_CHAT_TITLE, kind: "chat", updated_at: "2026-01-03" },
      { id: "c2", title: CONTINUED_CHAT_TITLE, kind: "chat", updated_at: "2026-01-04" },
      { id: "typed", title: "How do I brand the login page?", kind: "chat", updated_at: "2026-01-05" },
      { id: "typed-2", title: "How do I brand the login page?", kind: "chat", updated_at: "2026-01-06" },
    ];
    const titles = dedupeQuickActionThreads(threads).map((thread) => thread.id);
    expect(titles).toEqual(["s2", "b", "typed-2", "typed", "c2"]);
  });

  test("opening Copilot resumes the newest chat unless the user asked for a new one", () => {
    const threads = [
      learn("old", "2026-01-01"),
      { id: "typed", title: "Hide the Funnels link", kind: "chat", updated_at: "2026-10-21T18:04:00.000Z" },
      learn("new", "2026-02-01"),
    ];
    expect(mostRecentThread(threads)?.id).toBe("typed");
    expect(mostRecentThread([])).toBeNull();
    expect(threadToResume({ threads, explicitNewChat: false, routeKind: "away", hasSourceHandoff: false })?.id).toBe("typed");
    expect(threadToResume({ threads, explicitNewChat: false, routeKind: "home", hasSourceHandoff: false })?.id).toBe("typed");
    expect(threadToResume({ threads, explicitNewChat: true, routeKind: "away", hasSourceHandoff: false })).toBeNull();
    expect(threadToResume({ threads, explicitNewChat: false, routeKind: "away", hasSourceHandoff: true })).toBeNull();
    expect(threadToResume({ threads, explicitNewChat: false, routeKind: "thread", hasSourceHandoff: false })).toBeNull();
    expect(threadToResume({ threads, explicitNewChat: false, routeKind: "first-time", hasSourceHandoff: false })).toBeNull();
    expect(threadToResume({ threads, explicitNewChat: false, routeKind: "focus", hasSourceHandoff: false })).toBeNull();
  });
});

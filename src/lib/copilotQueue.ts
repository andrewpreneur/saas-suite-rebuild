export type QueuedSend = { id: string; content: string };

/** Keep a message the visitor sent while history was still loading. */
export function mergeLoadedMessages<T extends { id: string }>(loaded: T[], local: T[]): T[] {
  const seen = new Set(loaded.map((message) => message.id));
  const pending = local.filter((message) => message.id !== "initial" && !seen.has(message.id));
  return [...loaded, ...pending];
}

/** Hold sends until the thread can accept them, then release the whole queue. */
export function queueOutgoing<T>(queue: T[], item: T, ready: boolean): { queue: T[]; sendNow: T[] } {
  if (!ready) return { queue: [...queue, item], sendNow: [] };
  return { queue: [], sendNow: [...queue, item] };
}

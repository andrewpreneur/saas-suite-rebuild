import { describe, expect, it } from "bun:test";
import { CHUNK_RELOAD_KEY, isChunkLoadError, shouldReloadForChunkError } from "../src/lib/chunkReload";

function memoryStorage() {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, value); },
  };
}

describe("chunk reload", () => {
  it("recognizes a stale dynamic import", () => {
    expect(isChunkLoadError(new TypeError("Failed to fetch dynamically imported module: https://saassuite.ai/assets/AffiliateReferralsPanel-abc.js"))).toBe(true);
    expect(isChunkLoadError(new Error("ChunkLoadError: Loading chunk 4 failed"))).toBe(true);
    expect(isChunkLoadError(new Error("affiliate-referrals returned 500"))).toBe(false);
  });

  it("reloads once, then waits 30 seconds", () => {
    const storage = memoryStorage();
    const now = Date.parse("2026-10-22T20:00:00.000Z");
    expect(shouldReloadForChunkError(now, storage)).toBe(true);
    expect(storage.getItem(CHUNK_RELOAD_KEY)).toBe(String(now));
    expect(shouldReloadForChunkError(now + 1_000, storage)).toBe(false);
    expect(shouldReloadForChunkError(now + 30_000, storage)).toBe(false);
    expect(shouldReloadForChunkError(now + 30_001, storage)).toBe(true);
  });
});

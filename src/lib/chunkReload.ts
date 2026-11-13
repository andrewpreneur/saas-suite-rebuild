/** One sessionStorage key shared by lazy routes and the window listeners. */
export const CHUNK_RELOAD_KEY = "ss_chunk_reloaded_at";

const CHUNK_RE =
  /dynamically imported module|Importing a module script failed|ChunkLoadError|Loading chunk|Failed to fetch dynamically|Unable to preload CSS/i;

export function isChunkLoadError(err: unknown): boolean {
  const msg = err instanceof Error ? `${err.name} ${err.message}` : String(err ?? "");
  return CHUNK_RE.test(msg);
}

/** True once per 30 seconds. A second failure in that window must not reload again. */
export function shouldReloadForChunkError(now = Date.now(), storage: Pick<Storage, "getItem" | "setItem"> = sessionStorage): boolean {
  const last = Number(storage.getItem(CHUNK_RELOAD_KEY) || 0);
  if (now - last <= 30_000) return false;
  storage.setItem(CHUNK_RELOAD_KEY, String(now));
  return true;
}

export function reloadForChunkError(now = Date.now()): boolean {
  if (typeof window === "undefined") return false;
  if (!shouldReloadForChunkError(now)) return false;
  window.location.reload();
  return true;
}

/** Recover a tab that still points at chunks deleted by a publish. */
export function installChunkReload(): void {
  if (typeof window === "undefined") return;
  const flag = "__ssChunkReloadInstalled";
  const host = window as Window & { __ssChunkReloadInstalled?: boolean };
  if (host[flag]) return;
  host[flag] = true;

  window.addEventListener("vite:preloadError", (event) => {
    if (reloadForChunkError()) event.preventDefault();
  });
  window.addEventListener("unhandledrejection", (event) => {
    if (!isChunkLoadError(event.reason)) return;
    if (reloadForChunkError()) event.preventDefault();
  });
}

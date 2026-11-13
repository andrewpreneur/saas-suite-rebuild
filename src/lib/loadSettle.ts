export const LOAD_TIMEOUT_MS = 12_000;
export const LOAD_TIMEOUT_MESSAGE = "This is taking longer than expected.";

/** Reject when a request never settles, so a spinner can become an error with retry. */
export function loadErrorText(error: unknown, fallback = "Couldn't load this."): string {
  if (error instanceof Error && error.message.trim()) return error.message;
  return fallback;
}

/** Fires when a loader never settles. Call the returned function when the loader finishes. */
export function armLoadDeadline(onExpire: () => void, ms = LOAD_TIMEOUT_MS): () => void {
  const timer = setTimeout(onExpire, ms);
  return () => clearTimeout(timer);
}

export function withDeadline<T>(work: PromiseLike<T>, ms = LOAD_TIMEOUT_MS): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(LOAD_TIMEOUT_MESSAGE)), ms);
    Promise.resolve(work).then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error instanceof Error ? error : new Error("Couldn't load this."));
      },
    );
  });
}

/**
 * HighLevel features stay on a spinner when `loading` starts true and the
 * account has no agency id, because the snapshot request never runs.
 * Once the lookup has an answer — including "no agency" — loading is over.
 */
export function ghlStillLoading(input: {
  email: string | null;
  agencyLookupDone: boolean;
  agencyId: string | null;
  snapshotSettled: boolean;
}): boolean {
  if (!input.email && !input.agencyId) return false;
  if (!input.agencyLookupDone) return true;
  if (!input.agencyId) return false;
  return !input.snapshotSettled;
}

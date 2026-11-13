const SUCCESS_PAGE = () => import("@/pages/OneFeatureTrainingSuccess");

/** Start the success-page chunk before a click, so the route does not suspend on an empty fallback. */
export function preloadTrainingSuccess(): Promise<unknown> {
  return SUCCESS_PAGE();
}

type OpenOptions = {
  load?: () => Promise<unknown>;
  assign?: (url: string) => void;
  timeoutMs?: number;
  schedule?: (fn: () => void, ms: number) => number;
  cancel?: (id: number) => void;
};

/**
 * Client navigation to the lazy success route replaces the whole app with an
 * empty Suspense fallback (cookie banner only) until that chunk arrives.
 * Stay on the current page until the chunk is ready. If it is not ready
 * quickly, do a full navigation — the same thing a reload does.
 */
export function openTrainingSuccess(
  target: string,
  navigate: (path: string) => void,
  options?: OpenOptions,
): void {
  const load = options?.load ?? preloadTrainingSuccess;
  const assign = options?.assign ?? ((url: string) => window.location.assign(url));
  const schedule = options?.schedule ?? ((fn: () => void, ms: number) => window.setTimeout(fn, ms));
  const cancel = options?.cancel ?? ((id: number) => window.clearTimeout(id));
  const timeoutMs = options?.timeoutMs ?? 2500;
  let done = false;
  let timer = 0;
  const finish = (hard: boolean) => {
    if (done) return;
    done = true;
    if (timer) cancel(timer);
    if (hard) assign(target);
    else navigate(target);
  };
  timer = schedule(() => finish(true), timeoutMs);
  load().then(
    () => finish(false),
    () => finish(true),
  );
}

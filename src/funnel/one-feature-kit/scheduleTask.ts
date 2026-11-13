/**
 * Run `task` on the first real gesture, or about 10s after now via
 * requestIdleCallback. A scroll that never activates the document (Lighthouse
 * scrolls from script) does not count. touch, wheel, pointer, and keys do.
 */
export function scheduleInteractOrIdle(task: () => void, delayMs = 10_000): () => void {
  let done = false;
  const opts: AddEventListenerOptions = { passive: true, capture: true };
  const names = ["pointerdown", "keydown", "touchstart", "wheel"] as const;

  const fire = () => {
    if (done) return;
    done = true;
    cleanup();
    task();
  };

  const onScroll = () => {
    const y = window.scrollY || document.documentElement.scrollTop || 0;
    if (y < 8) return;
    const activation = navigator.userActivation;
    if (activation && !activation.hasBeenActive && !activation.isActive) return;
    fire();
  };

  for (const name of names) window.addEventListener(name, fire, opts);
  window.addEventListener("scroll", onScroll, opts);

  const timer = window.setTimeout(() => {
    if (done) return;
    if (typeof window.requestIdleCallback === "function") {
      window.requestIdleCallback(() => fire(), { timeout: 2000 });
    } else {
      fire();
    }
  }, delayMs);

  function cleanup() {
    for (const name of names) window.removeEventListener(name, fire, opts);
    window.removeEventListener("scroll", onScroll, opts);
    window.clearTimeout(timer);
  }

  return cleanup;
}

/** Let the browser paint before the next chunk evaluates. */
export function yieldToMain(): Promise<void> {
  const scheduler = (globalThis as { scheduler?: { yield?: () => Promise<void> } }).scheduler;
  if (typeof scheduler?.yield === "function") return scheduler.yield();
  return new Promise((resolve) => {
    window.setTimeout(resolve, 0);
  });
}

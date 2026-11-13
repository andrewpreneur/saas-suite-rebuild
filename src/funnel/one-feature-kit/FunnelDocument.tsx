import { startTransition, useEffect, useState } from "react";
import { SALES_ABOVE_HTML, SALES_FOLDS, loadFunnelHtml, type FunnelPageId } from "./markup";

/** HTML already painted by the prerender. Reading it keeps hydrateRoot matched without shipping the section chunk. */
export function readPrerenderedSlot(id: string): string | null {
  if (typeof document === "undefined") return null;
  if (document.documentElement.dataset.ssHydrate !== "1") return null;
  const node = document.querySelector(`[data-ofk-slot="${id}"]`);
  if (!(node instanceof HTMLElement)) return null;
  const html = node.innerHTML;
  if (!html.trim()) return null;
  return html;
}

function normalizePath(pathname: string) {
  return (pathname || "/").replace(/\/+$/, "") || "/";
}

/**
 * The step wire prepends the LIVE bar and appends the sticky CTA before the
 * prerender snapshot. Those nodes sit inside the React root, so the first
 * client render has to emit the same elements or hydrateRoot throws #418.
 * Sales delays that wire, and its snapshot has neither node.
 */
export function readBakedFunnelChrome(): { live: string | null; sticky: string | null } {
  if (typeof document === "undefined") return { live: null, sticky: null };
  if (document.documentElement.dataset.ssHydrate !== "1") return { live: null, sticky: null };
  const root = document.getElementById("root");
  const inner = (selector: string) => {
    const node = root?.querySelector(selector);
    return node instanceof HTMLElement ? node.innerHTML : null;
  };
  return { live: inner(".ofk-live"), sticky: inner(".ofk-sticky-cta") };
}

export function useEntryFunnelChrome(pathname: string, pageId: FunnelPageId | undefined) {
  const [baked] = useState(readBakedFunnelChrome);
  const [entryPath] = useState(() => normalizePath(pathname));
  const onEntry = normalizePath(pathname) === entryPath && pageId !== "thankyou";
  return {
    liveHtml: onEntry ? baked.live : null,
    stickyHtml: onEntry ? baked.sticky : null,
  };
}

function FoldSlot({ id, load }: { id: string; load: () => Promise<string> }) {
  const [html, setHtml] = useState<string | null>(() => readPrerenderedSlot(id));

  useEffect(() => {
    if (html != null) return;
    let cancel = false;
    // Empty only during the prerender pass or a client-side step change.
    // The snapshot then includes the section, so a real visit does not download it.
    const timer = window.setTimeout(() => {
      void load().then((next) => {
        if (!cancel) startTransition(() => setHtml(next));
      });
    }, 0);
    return () => {
      cancel = true;
      window.clearTimeout(timer);
    };
  }, [html, id, load]);

  return <div data-ofk-slot={id} dangerouslySetInnerHTML={html != null ? { __html: html } : undefined} />;
}

export function SalesDocument() {
  const [heroHtml] = useState(() => readPrerenderedSlot("hero") ?? SALES_ABOVE_HTML);
  return (
    <>
      <div data-ofk-slot="hero" dangerouslySetInnerHTML={{ __html: heroHtml }} />
      {SALES_FOLDS.map((fold) => (
        <FoldSlot key={fold.id} id={fold.id} load={fold.load} />
      ))}
    </>
  );
}

export function OtherFunnelPage({ pageId }: { pageId: Exclude<FunnelPageId, "sales"> }) {
  const [html, setHtml] = useState<string | null>(() => readPrerenderedSlot(pageId));

  useEffect(() => {
    if (html != null) return;
    let cancel = false;
    const timer = window.setTimeout(() => {
      void loadFunnelHtml(pageId).then((next) => {
        if (!cancel) startTransition(() => setHtml(next));
      });
    }, 0);
    return () => {
      cancel = true;
      window.clearTimeout(timer);
    };
  }, [html, pageId]);

  return <div data-ofk-slot={pageId} dangerouslySetInnerHTML={html != null ? { __html: html } : undefined} />;
}

import { useEffect } from "react";

/**
 * index.html carries fallback head tags (marked `data-static-seo`) for non-JS
 * social crawlers. Once a route renders, only those explicitly marked static
 * nodes may be removed. React/Helmet own every other head node, including
 * transient duplicates during route changes; detaching them breaks unmount.
 */
export function collapseHeadDuplicates() {
  document.head.querySelectorAll("[data-static-seo]").forEach((el) => {
    el.remove();
  });
}

export function useStripStaticSeo(...deps: unknown[]) {
  useEffect(() => {
    collapseHeadDuplicates();
    const observer = new MutationObserver(collapseHeadDuplicates);
    observer.observe(document.head, { childList: true, subtree: true });
    return () => observer.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}

import { createRoot, hydrateRoot } from "react-dom/client";
import { useLayoutEffect, type ReactNode } from "react";
import { isPaintFirstPath, renderedPastFallback } from "./paintFirst";

function pathKey(pathname: string) {
  return (pathname || "/").replace(/\/+$/, "") || "/";
}

/**
 * The prerendered document already painted the hero. Hydrate it when the
 * baked canonical path is this URL so createRoot does not wipe the H1.
 * The stale-prerender guard clears #root when the paths differ.
 */
export function prerenderMatchesLocation(): boolean {
  const root = document.getElementById("root");
  if (!root || root.childElementCount === 0) return false;
  const canonical = document.querySelector('link[rel="canonical"]');
  if (!canonical) return false;
  try {
    const baked = pathKey(new URL((canonical as HTMLLinkElement).href, location.origin).pathname);
    return baked === pathKey(location.pathname);
  } catch {
    return false;
  }
}

const LOADING = '[aria-label="Loading"]';

function snapshot(container: ParentNode) {
  const heading = container.querySelector("h1");
  return {
    loading: !!container.querySelector(LOADING),
    heading: heading?.textContent || "",
    textLength: (container.textContent || "").replace(/\s+/g, " ").trim().length,
  };
}

/**
 * Paint-first landers client-render. createRoot on #root would replace the
 * prerendered hero with the empty Suspense fallback until the page chunk
 * arrives, which is a blank page on a slow phone. Render beside the prerender
 * and swap only once the real route (or its error) has committed.
 */
function RevealPrerender({ prerender, children }: { prerender: HTMLElement; children: ReactNode }) {
  useLayoutEffect(() => {
    const host = document.getElementById("ss-boot");
    if (!host) return;
    let done = false;
    const show = () => {
      if (done || !renderedPastFallback(snapshot(host))) return;
      done = true;
      prerender.replaceWith(host);
      host.id = "root";
      host.removeAttribute("hidden");
      host.removeAttribute("aria-hidden");
      observer.disconnect();
    };
    const observer = new MutationObserver(show);
    observer.observe(host, { childList: true, subtree: true, characterData: true });
    show();
    return () => observer.disconnect();
  }, [prerender]);
  return children;
}

function bootBesidePrerender(prerender: HTMLElement, node: ReactNode) {
  const host = document.createElement("div");
  host.id = "ss-boot";
  host.hidden = true;
  host.setAttribute("aria-hidden", "true");
  document.body.appendChild(host);
  createRoot(host).render(<RevealPrerender prerender={prerender}>{node}</RevealPrerender>);
}

export function bootRoot(node: ReactNode) {
  const el = document.getElementById("root");
  if (!el) return;
  // Only documents marked at prerender time. The main app shell still client-renders:
  // its routes sit under one Suspense boundary, and hydrateRoot rejects that HTML.
  const marked = document.documentElement.dataset.ssHydrate === "1";
  if (marked && prerenderMatchesLocation()) {
    hydrateRoot(el, node);
    return;
  }
  if (isPaintFirstPath(location.pathname) && prerenderMatchesLocation()) {
    bootBesidePrerender(el, node);
    return;
  }
  // Homepage HTML is the fallback for routes without their own prerender.
  // React 19 createRoot deletes those nodes and throws removeChild when the
  // canonical path is a different page. Clear them before mounting.
  if (!prerenderMatchesLocation()) {
    el.replaceChildren();
    document.head.querySelectorAll("[data-static-seo]").forEach((node) => node.remove());
  }
  createRoot(el).render(node);
}

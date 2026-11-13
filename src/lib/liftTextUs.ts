export type Box = { top: number; right: number; bottom: number; left: number };

const OBSTACLES = ".ofk-sticky-cta, .ofk-checkout-sticky, [aria-label='Cookie notice']";

function overlapsX(link: Box, rect: Box) {
  return link.right > rect.left + 1 && link.left < rect.right - 1;
}

/**
 * How far to move a link that sits under a bottom bar or banner.
 * A buy bar with a cookie banner stacked above it is cleared in passes,
 * so the link is not parked on the banner after it clears the bar.
 */
export function liftShiftPx(link: Box, obstacles: Box[], gap = 8): number {
  let shift = 0;
  for (let pass = 0; pass <= obstacles.length; pass += 1) {
    const moved = { ...link, top: link.top - shift, bottom: link.bottom - shift };
    let top = Number.POSITIVE_INFINITY;
    for (const rect of obstacles) {
      const overlapsY = moved.bottom > rect.top + 1 && moved.top < rect.bottom - 1;
      if (!overlapsX(link, rect) || !overlapsY) continue;
      top = Math.min(top, rect.top);
    }
    if (!Number.isFinite(top)) return shift;
    const next = Math.max(0, Math.ceil(link.bottom - top + gap));
    if (next <= shift) return shift;
    shift = next;
  }
  return shift;
}

/** Space to reserve so the link can rest above bars pinned to the viewport bottom. */
export function bottomClearancePx(link: Box, obstacles: Box[], viewportHeight: number, gap = 8): number {
  let top = Number.POSITIVE_INFINITY;
  for (const rect of obstacles) {
    if (!overlapsX(link, rect)) continue;
    if (rect.bottom < viewportHeight - 2) continue;
    top = Math.min(top, rect.top);
  }
  if (!Number.isFinite(top)) return 0;
  return Math.max(0, Math.ceil(viewportHeight - top + gap));
}

function parsePx(value: string | null | undefined): number {
  if (!value) return 0;
  const n = Number.parseFloat(value);
  return Number.isFinite(n) ? n : 0;
}

/** Inline footer padding this script added on top of the padding it found. */
export function addedPaddingPx(current: string, original: string): number {
  return Math.max(0, parsePx(current) - parsePx(original));
}

/**
 * True when the viewport is at the document end, ignoring footer padding this
 * script added. Counting that padding makes the end check flip as soon as we
 * write it, and the next pass deletes it.
 */
export function documentEndReached(
  scrollY: number,
  viewportHeight: number,
  scrollHeight: number,
  ownPadding: number,
): boolean {
  const contentHeight = scrollHeight - Math.max(0, ownPadding);
  return scrollY + viewportHeight >= contentHeight - 4;
}

function boxesOf(selector: string): Box[] {
  return [...document.querySelectorAll<HTMLElement>(selector)].flatMap((el) => {
    if (el.hidden) return [];
    const style = getComputedStyle(el);
    if (style.display === "none" || style.visibility === "hidden" || style.position !== "fixed") return [];
    const rect = el.getBoundingClientRect();
    if (rect.width < 8 || rect.height < 8) return [];
    return [rect];
  });
}

function unshifted(rect: DOMRect, transform: string): Box {
  const match = /translateY\((-?\d+(?:\.\d+)?)px\)/.exec(transform);
  const y = match ? Number(match[1]) : 0;
  return { top: rect.top - y, bottom: rect.bottom - y, left: rect.left, right: rect.right };
}

function reservedFooterPadding(links: HTMLAnchorElement[]): number {
  const seen = new Set<HTMLElement>();
  let total = 0;
  for (const link of links) {
    const footer = link.closest("footer");
    if (!(footer instanceof HTMLElement) || seen.has(footer)) continue;
    seen.add(footer);
    if (!footer.hasAttribute("data-ss-pad")) continue;
    total += addedPaddingPx(footer.style.paddingBottom, footer.dataset.ssPad || "");
  }
  return total;
}

function placeLinks() {
  const obstacles = boxesOf(OBSTACLES);
  const links = [...document.querySelectorAll<HTMLAnchorElement>('a[href^="sms:"]')];
  const viewportHeight = window.innerHeight || document.documentElement.clientHeight;
  const ownPadding = reservedFooterPadding(links);
  const atEnd = documentEndReached(
    window.scrollY,
    viewportHeight,
    document.documentElement.scrollHeight,
    ownPadding,
  );
  const footerClearance = new Map<HTMLElement, number>();
  for (const link of links) {
    if (link.style.minHeight !== "44px") link.style.minHeight = "44px";
    if (link.style.minWidth !== "44px") link.style.minWidth = "44px";
    const rect = unshifted(link.getBoundingClientRect(), link.style.transform);
    const shift = liftShiftPx(rect, obstacles);
    const nextTransform = shift > 0 ? `translateY(-${shift}px)` : "";
    if (link.style.transform !== nextTransform) link.style.transform = nextTransform;
    if (shift > 0) {
      if (link.style.position !== "relative") link.style.position = "relative";
      if (link.style.zIndex !== "130") link.style.zIndex = "130";
    } else if (link.style.zIndex === "130") {
      link.style.zIndex = "";
      link.style.position = "";
    }
    const clearance = atEnd ? bottomClearancePx(rect, obstacles, viewportHeight) : 0;
    const nextMargin = clearance ? `${clearance}px` : "";
    if (link.style.scrollMarginBottom !== nextMargin) link.style.scrollMarginBottom = nextMargin;
    const footer = link.closest("footer");
    if (!(footer instanceof HTMLElement)) continue;
    const prev = footerClearance.get(footer);
    footerClearance.set(footer, prev == null ? clearance : Math.max(prev, clearance));
  }
  for (const [footer, clearance] of footerClearance) {
    if (!footer.hasAttribute("data-ss-pad")) footer.dataset.ssPad = footer.style.paddingBottom || "";
    const nextPad = clearance > 0 ? `${clearance}px` : footer.dataset.ssPad || "";
    if (footer.style.paddingBottom !== nextPad) footer.style.paddingBottom = nextPad;
  }
}

const WATCH: MutationObserverInit = {
  subtree: true,
  childList: true,
  attributes: true,
  attributeFilter: ["class", "hidden", "style", "aria-label"],
};

/** Keep every Text Us link above the sticky buy bar and the cookie banner. */
export function startTextUsLift() {
  if (typeof document === "undefined") return;
  const host = window as Window & { __ssTextUsLift?: boolean };
  if (host.__ssTextUsLift) return;
  host.__ssTextUsLift = true;
  let placing = false;
  let again = false;
  let observer: MutationObserver | null = null;
  const watch = () => observer?.observe(document.documentElement, WATCH);
  const run = () => {
    if (placing) {
      again = true;
      return;
    }
    let passes = 0;
    do {
      again = false;
      passes += 1;
      placing = true;
      observer?.disconnect();
      try {
        placeLinks();
      } finally {
        placing = false;
        watch();
      }
    } while (again && passes < 3);
  };
  observer = new MutationObserver(run);
  run();
  window.addEventListener("scroll", run, { passive: true, capture: true });
  window.addEventListener("resize", run);
}

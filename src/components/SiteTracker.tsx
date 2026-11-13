import { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import { useUser } from "@/contexts/UserContext";
import { isAppPage, sendSiteEvent, trackFunnelPageview } from "@/components/siteFunnelPageview";

export { trackFunnelPageview };

type Payload = Record<string, unknown>;

const send = sendSiteEvent;

/** Fire a custom engagement event from anywhere in the app. */
export const trackSiteEvent = (
  eventType: string,
  label?: string,
  extra?: Payload,
) => {
  const path = window.location.pathname;
  send({ path, event_type: eventType, label, page_title: document.title, is_app_page: isAppPage(path), ...extra });
};

/** Build a stable but short selector path for a clicked element. */
function getElementSelector(el: HTMLElement): string {
  const parts: string[] = [];
  let cur: HTMLElement | null = el;
  while (cur && cur !== document.body && parts.length < 5) {
    const tag = cur.tagName.toLowerCase();
    const id = cur.id ? `#${cur.id}` : "";
    const classes = Array.from(cur.classList)
      .filter((c) => !c.startsWith("hover") && !c.startsWith("focus"))
      .slice(0, 2)
      .join(".");
    parts.push(`${tag}${id}${classes ? "." + classes : ""}`);
    cur = cur.parentElement;
  }
  return parts.reverse().join(" > ");
}

const SiteTracker = () => {
  const location = useLocation();
  const { email, plan } = useUser();
  const enteredAtRef = useRef<number>(Date.now());
  const lastPathRef = useRef<string>("");
  const maxScrollRef = useRef<number>(0);
  const videoProgressRef = useRef<Set<number>>(new Set());
  const lastHoverRef = useRef<{ x: number; y: number; t: number } | null>(null);
  const hoverThrottleRef = useRef<number | null>(null);

  const identity = { user_email: email || undefined, plan_type: plan || undefined };

  // Pageview + time-on-page for the previous page
  useEffect(() => {
    const path = location.pathname;
    const prevPath = lastPathRef.current;

    if (prevPath) {
      send({
        path: prevPath,
        event_type: "exit",
        duration_ms: Date.now() - enteredAtRef.current,
        value: maxScrollRef.current,
        label: "time_on_page",
        is_app_page: isAppPage(prevPath),
        ...identity,
      });
    }

    lastPathRef.current = path;
    enteredAtRef.current = Date.now();
    maxScrollRef.current = 0;
    videoProgressRef.current = new Set();

    const params = new URLSearchParams(location.search);
    send({
      path,
      event_type: "pageview",
      page_title: document.title,
      referrer: document.referrer || null,
      is_app_page: isAppPage(path),
      // Only override the stored attribution when this URL actually carries UTMs
      utm_source: params.get("utm_source") ?? undefined,
      utm_medium: params.get("utm_medium") ?? undefined,
      utm_campaign: params.get("utm_campaign") ?? undefined,
      utm_content: params.get("utm_content") ?? undefined,
      utm_term: params.get("utm_term") ?? undefined,
      fbclid: params.get("fbclid") ?? undefined,
      gclid: params.get("gclid") ?? undefined,
      ...identity,
    });
  }, [location.pathname, location.search, email, plan]);

  // Scroll depth milestones
  useEffect(() => {
    const fired = new Set<number>();
    const onScroll = () => {
      const height = document.documentElement.scrollHeight - window.innerHeight;
      if (height <= 0) return;
      const pct = Math.min(100, Math.round((window.scrollY / height) * 100));
      maxScrollRef.current = Math.max(maxScrollRef.current, pct);
      for (const milestone of [25, 50, 75, 100]) {
        if (pct >= milestone && !fired.has(milestone)) {
          fired.add(milestone);
          trackSiteEvent("scroll_depth", `${milestone}%`, { value: milestone, ...identity });
        }
      }
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [location.pathname, email, plan]);

  // Click tracking with coordinates + element selector
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      const el = (e.target as HTMLElement | null)?.closest(
        "a,button,[role='button'],input,textarea,select,video,[data-track-click]",
      ) as HTMLElement | null;
      const label =
        el?.getAttribute("aria-label") ||
        el?.textContent?.trim().slice(0, 80) ||
        el?.getAttribute("href") ||
        "unlabeled";
      const path = window.location.pathname;
      send({
        path,
        event_type: "click",
        label,
        page_title: document.title,
        is_app_page: isAppPage(path),
        metadata: {
          href: el?.getAttribute("href") ?? null,
          selector: el ? getElementSelector(el) : null,
          click_coordinates: { x: e.clientX, y: e.clientY },
          viewport: { width: window.innerWidth, height: window.innerHeight },
        },
        ...identity,
      });
    };
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, [email, plan]);

  // Video retention tracking for the landing page hero video
  useEffect(() => {
    const attachTracking = (video: HTMLVideoElement | null) => {
      if (!video || (video as any).__ssTracked) return;
      (video as any).__ssTracked = true;
      const videoId = video.id || video.getAttribute("data-track-video") || "hero-video";

      const milestones = new Set<number>();
      const sendVideo = (eventType: string, extra?: Payload) => {
        const path = window.location.pathname;
        send({
          path,
          event_type: eventType,
          label: videoId,
          page_title: document.title,
          is_app_page: isAppPage(path),
          metadata: {
            video_id: videoId,
            current_time: Math.round(video.currentTime * 100) / 100,
            duration: Math.round((video.duration || 0) * 100) / 100,
            percent: video.duration ? Math.round((video.currentTime / video.duration) * 100) : 0,
            ...extra,
          },
          ...identity,
        });
      };

      video.addEventListener("play", () => sendVideo("video_play"));
      video.addEventListener("pause", () => sendVideo("video_pause"));
      video.addEventListener("ended", () => sendVideo("video_complete"));
      video.addEventListener("seeked", () => sendVideo("video_seek"));
      video.addEventListener("timeupdate", () => {
        if (!video.duration || video.duration <= 0) return;
        const pct = Math.round((video.currentTime / video.duration) * 100);
        for (const milestone of [25, 50, 75, 95]) {
          if (pct >= milestone && !milestones.has(milestone)) {
            milestones.add(milestone);
            sendVideo("video_progress", { milestone });
          }
        }
      });
    };

    const attachHeroVideoTracking = () => {
      document
        .querySelectorAll<HTMLVideoElement>("#hero-video,[data-track-video]")
        .forEach((v) => attachTracking(v));
    };

    attachHeroVideoTracking();
    // Re-attach if the landing page hero video is rendered after navigation
    const observer = new MutationObserver(() => attachHeroVideoTracking());
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [location.pathname, email, plan]);

  // Element visibility / time-on-section tracking
  useEffect(() => {
    const visibleStart = new Map<string, number>();
    const fired = new Set<string>();

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const id = entry.target.getAttribute("data-analytics-section") || entry.target.id;
          if (!id) return;
          if (entry.isIntersecting) {
            visibleStart.set(id, Date.now());
            if (!fired.has(id)) {
              fired.add(id);
              const path = window.location.pathname;
              send({
                path,
                event_type: "element_visible",
                label: id,
                page_title: document.title,
                is_app_page: isAppPage(path),
                metadata: { section: id, viewport_ratio: Math.round(entry.intersectionRatio * 100) / 100 },
                ...identity,
              });
            }
          } else if (visibleStart.has(id)) {
            const duration = Date.now() - visibleStart.get(id)!;
            visibleStart.delete(id);
            if (duration > 500) {
              const path = window.location.pathname;
              send({
                path,
                event_type: "exit",
                label: `section_time:${id}`,
                duration_ms: duration,
                is_app_page: isAppPage(path),
                metadata: { section: id },
                ...identity,
              });
            }
          }
        });
      },
      { threshold: [0.25, 0.5, 0.75, 1.0] },
    );

    const targets = document.querySelectorAll("[data-analytics-section], section[id], #hero, #features, #pricing, #signup-section, #affiliate-section");
    targets.forEach((t) => observer.observe(t));

    return () => observer.disconnect();
  }, [location.pathname, email, plan]);

  // Hover intent sampling (throttled) for heatmap/time-on-area analysis
  useEffect(() => {
    const sample = (e: MouseEvent) => {
      const now = Date.now();
      const last = lastHoverRef.current;
      if (last && Math.hypot(e.clientX - last.x, e.clientY - last.y) < 20 && now - last.t < 1000) return;
      lastHoverRef.current = { x: e.clientX, y: e.clientY, t: now };

      if (hoverThrottleRef.current) return;
      hoverThrottleRef.current = window.setTimeout(() => {
        hoverThrottleRef.current = null;
      }, 500);

      const path = window.location.pathname;
      send({
        path,
        event_type: "hover_intent",
        label: "mouse-sample",
        page_title: document.title,
        is_app_page: isAppPage(path),
        metadata: {
          coordinates: { x: e.clientX, y: e.clientY },
          viewport: { width: window.innerWidth, height: window.innerHeight },
        },
        ...identity,
      });
    };

    window.addEventListener("mousemove", sample, { passive: true });
    return () => window.removeEventListener("mousemove", sample);
  }, [location.pathname, email, plan]);

  // Native video players (non-hero)
  useEffect(() => {
    const onPlay = (e: Event) => {
      const target = e.target as HTMLElement;
      if (target?.tagName !== "VIDEO") return;
      if ((target as HTMLVideoElement).id === "hero-video") return;
      trackSiteEvent("video_play", (target as HTMLVideoElement).currentSrc || "video");
    };
    document.addEventListener("play", onPlay, true);
    return () => document.removeEventListener("play", onPlay, true);
  }, [email, plan]);

  // Final exit event
  useEffect(() => {
    const onLeave = () => {
      const path = lastPathRef.current;
      if (!path) return;
      send({
        path,
        event_type: "exit",
        duration_ms: Date.now() - enteredAtRef.current,
        value: maxScrollRef.current,
        label: "time_on_page",
        is_app_page: isAppPage(path),
        ...identity,
      });
    };
    window.addEventListener("pagehide", onLeave);
    return () => window.removeEventListener("pagehide", onLeave);
  }, [email, plan]);

  return null;
};

export default SiteTracker;

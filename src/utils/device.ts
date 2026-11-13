export type DeviceType = "mobile" | "tablet" | "desktop";

/** Coarse device classification used for funnel analysis and install-guide handoff. */
export function getDeviceType(): DeviceType {
  if (typeof window === "undefined") return "desktop";
  const ua = navigator.userAgent || "";
  const width = window.innerWidth || 1024;
  const isTablet = /iPad|Tablet|PlayBook|Silk/i.test(ua) || (/Android/i.test(ua) && !/Mobile/i.test(ua));
  if (isTablet) return "tablet";
  const isMobile = /iPhone|iPod|Android.*Mobile|Windows Phone|webOS|BlackBerry/i.test(ua);
  if (isMobile || width < 768) return "mobile";
  return "desktop";
}

export function isMobileDevice(): boolean {
  return getDeviceType() === "mobile";
}

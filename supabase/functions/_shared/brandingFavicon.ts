export function safeFaviconUrl(value: string): string {
  try { const url = new URL(value); return url.protocol === "https:" && !url.username && !url.password ? url.href : ""; } catch { return ""; }
}
export function faviconMarker(url: string): string {
  const safe = safeFaviconUrl(url);
  if (url && !safe) throw new Error("Favicon must use an HTTPS image URL");
  return safe ? `/* SS-FAVICON:${JSON.stringify(safe).replace(/</g, "\\u003c").replace(/\*/g, "\\u002a")} */` : "";
}
export function readFavicon(css: string): string {
  try { return safeFaviconUrl(JSON.parse(css.match(/\/\* SS-FAVICON:(.+?) \*\//)?.[1] || '""')); } catch { return ""; }
}
export function buildFaviconJS(css: string): string {
  const url = readFavicon(css);
  if (!url) return "";
  return `(function(){var faviconURL=${JSON.stringify(url).replace(/</g, "\\u003c")}; function apply(){var links=document.querySelectorAll("link[rel*='icon']:not([rel='apple-touch-icon'])");if(!links.length){var link=document.createElement('link');link.rel='shortcut icon';document.head.appendChild(link);links=[link];}Array.prototype.forEach.call(links,function(link){link.removeAttribute('type');link.href=faviconURL;});}apply();})();`;
}
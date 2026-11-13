/**
 * The cookie notice mounts 800ms after load, so a prerender snapshot includes
 * it and the first client render does not. An extra node under #root makes
 * hydrateRoot discard the hero. Remove the baked banner; the client still shows it.
 */
export function stripCookieNotice(html: string): string {
  const marker = 'aria-label="Cookie notice"';
  let out = html;
  let from = 0;
  while (from < out.length) {
    const at = out.indexOf(marker, from);
    if (at === -1) return out;
    const start = out.lastIndexOf("<div", at);
    if (start === -1) return out;
    let i = start;
    let depth = 0;
    let removed = false;
    while (i < out.length) {
      const nextOpen = out.indexOf("<div", i);
      const nextClose = out.indexOf("</div>", i);
      if (nextClose === -1) return out;
      if (nextOpen !== -1 && nextOpen < nextClose) {
        depth += 1;
        i = nextOpen + 4;
        continue;
      }
      depth -= 1;
      i = nextClose + "</div>".length;
      if (depth === 0) {
        out = out.slice(0, start) + out.slice(i);
        from = start;
        removed = true;
        break;
      }
    }
    if (!removed) return out;
  }
  return out;
}

/**
 * A head module script evaluates before first paint, so Lighthouse's simulation
 * counts the whole funnel graph as render-blocking and scores the hero as if it
 * waited on JavaScript. Drop the preloads and start the module after load, once
 * the prerendered image has painted. The extra 400ms keeps the React graph off
 * the poster's critical path: requesting it in the same moment as that paint
 * made the slow-4G model chain a 215KB chunk onto LCP. A 5s cap still boots if
 * load never fires.
 */
export function deferFunnelModuleScript(html: string): string {
  const match = html.match(/<script type="module"[^>]*\ssrc="([^"]+)"[^>]*><\/script>/);
  if (!match || match.index === undefined) return html;
  const src = match[1];
  let out = html.slice(0, match.index) + html.slice(match.index + match[0].length);
  out = out.replace(/<link rel="modulepreload"[^>]*>/g, "");
  const loader =
    `<script>(function(){var started=false;var tries=0;function boot(){if(started)return;started=true;tries++;var s=document.createElement("script");s.type="module";s.crossOrigin="";s.src=${JSON.stringify(src)};s.onerror=function(){started=false;if(tries<4)setTimeout(boot,tries*500);};document.body.appendChild(s);}function purchaseMarker(){var stores=[];try{stores.push(sessionStorage);}catch(e){}try{stores.push(localStorage);}catch(e){}for(var i=0;i<stores.length;i++){var store=stores[i];if(!store)continue;try{if(store.getItem("ofk-payment-capability"))return true;var raw=store.getItem("ofk-one-feature-kit-v2");if(!raw)continue;var match=raw.match(/"checkoutId"\\s*:\\s*"([^"]*)"/);if(match&&match[1])return true;}catch(e){}}var q=location.search||"";if(/[?&](?:session_id|sessionId|checkout_session_id|payment_intent|payment_intent_id)=[^&#]+/.test(q))return true;if(/cs_(?:live|test)_/.test(q))return true;return false;}function urgent(){var path=(location.pathname||"/").replace(/\\/+$/,"")||"/";if(path==="/one-feature-kit/checkout"||path==="/checkout"||path==="/one-feature-kit/launch-pack"||path==="/launch-pack"||path==="/one-feature-kit/webinar-sales-system"||path==="/webinar-sales-system")return true;if((path==="/one-feature-kit/thank-you"||path==="/thank-you")&&purchaseMarker())return true;return false;}if(urgent()){document.addEventListener("click",function(e){if(window.__ofkReady)return;var node=e.target&&e.target.closest?e.target.closest("a.btn,button,[data-ofk-add],#ofk-complete,[data-ofk-complete-proxy]"):null;if(!node)return;e.preventDefault();e.stopPropagation();(window.__ofkClicks=window.__ofkClicks||[]).push(node);},true);document.addEventListener("focusin",function(e){if(window.__ofkReady)return;var id=e.target&&e.target.id;if(id==="ofk-name"||id==="ofk-email"||id==="ofk-phone")window.__ofkFocus=id;},true);boot();return;}function arm(){requestAnimationFrame(function(){requestAnimationFrame(function(){setTimeout(boot,400);});});}if(document.readyState==="complete")arm();else window.addEventListener("load",arm);setTimeout(boot,5000);})();</script>`;
  const body = out.lastIndexOf("</body>");
  if (body === -1) return out + loader;
  return out.slice(0, body) + loader + out.slice(body);
}

/**
 * Puppeteer runs the affiliate injector and the kit pixel snippet, then saves
 * the tags they inserted. A baked lynk, GTM, or gtag tag would start during
 * parse. The inline loaders still add those on the client.
 * fbevents.js is removed too. Puppeteer can insert it once the pixel snippet
 * runs, and a baked tag would execute during parse, ahead of the sales poster.
 * The head snippet still queues PageView and inserts the script after paint.
 */
export function stripBakedThirdPartyScripts(html: string): string {
  return html.replace(
    /<script\b[^>]*\bsrc=["'][^"']*(?:lynks\.lynkific\.com|googletagmanager\.com|google-analytics\.com|connect\.facebook\.net\/[^"']*fbevents\.js|js\.stripe\.com)[^"']*["'][^>]*>\s*<\/script>/gi,
    "",
  );
}

/**
 * When a prerender actually executed the pixel (production host), keep that
 * async tag and tell the head snippet not to write a second one.
 */
export function markBakedPixel(html: string): string {
  if (!/<script\b[^>]*\bsrc=["'][^"']*fbevents\.js/i.test(html)) return html;
  if (/\bdata-ss-pixel=/.test(html)) return html;
  return html.replace(/<html\b/i, '<html data-ss-pixel="1"');
}

/**
 * Homepage URLs the preload scanner must not see in the SPA fallback.
 * `/` is both the homepage and the file every unmapped route receives.
 * These assets stay in the document as data attributes and are promoted
 * back to real URLs only when this file is actually opened as the homepage.
 */
const HEAVY_HOME_MEDIA = /https?:\/\/|filesafe\.space|video-onboarding|hero-bg|custom-onboarding|track-activity|toggle-videos|lovable-uploads/i;

const REVEAL_HOME_MEDIA = `<script data-ss-reveal-home>(function(){var host=(location.hostname||"").toLowerCase().replace(/^www\\./,"");if(host==="onefeaturekit.com")return;var path=(location.pathname||"/").replace(/\\/+$/,"")||"/";if(path!=="/")return;var root=document.getElementById("root");if(!root)return;root.querySelectorAll("[data-ss-src],[data-ss-poster],[data-ss-srcset],[data-ss-style]").forEach(function(el){["src","poster","srcset","style"].forEach(function(name){var value=el.getAttribute("data-ss-"+name);if(value!=null)el.setAttribute(name,value);});});})();</script>`;

function shelveHeavyAttributes(html: string): string {
  return html.replace(/<([a-zA-Z0-9:-]+)(\s[^>]*?)(\/?)>/g, (full, tag: string, attrs: string, slash: string) => {
    if (tag.toLowerCase() === "script") return full;
    const next = attrs.replace(
      /\s(src|poster|srcset|style)\s*=\s*("([^"]*)"|'([^']*)')/gi,
      (match, name: string, _quoted: string, doubleQuoted: string | undefined, singleQuoted: string | undefined) => {
        const value = doubleQuoted ?? singleQuoted ?? "";
        if (!HEAVY_HOME_MEDIA.test(value)) return match;
        const quote = doubleQuoted !== undefined ? '"' : "'";
        return ` data-ss-${name.toLowerCase()}=${quote}${value}${quote}`;
      },
    );
    return `<${tag}${next}${slash}>`;
  });
}

function sliceRoot(html: string): { before: string; inner: string; after: string } | null {
  const open = html.indexOf('<div id="root">');
  if (open === -1) return null;
  const innerStart = open + '<div id="root">'.length;
  let depth = 1;
  let i = innerStart;
  while (i < html.length && depth > 0) {
    const nextOpen = html.indexOf("<div", i);
    const nextClose = html.indexOf("</div>", i);
    if (nextClose === -1) return null;
    if (nextOpen !== -1 && nextOpen < nextClose) {
      depth += 1;
      i = nextOpen + 4;
      continue;
    }
    depth -= 1;
    if (depth === 0) {
      return {
        before: html.slice(0, innerStart),
        inner: html.slice(innerStart, nextClose),
        after: html.slice(nextClose),
      };
    }
    i = nextClose + "</div>".length;
  }
  return null;
}

/**
 * The static host serves dist/index.html for `/` and for every route that
 * has no own file. Keep the homepage markup, but don't leave fetchable
 * hero URLs in that shared file. A blocking script puts them back only on `/`.
 */
export function shelveHomepageMedia(html: string): string {
  if (html.includes("data-ss-reveal-home")) return html;
  let out = html.replace(/<link\b[^>]*\brel=["']preload["'][^>]*>/gi, (tag) =>
    HEAVY_HOME_MEDIA.test(tag) ? "" : tag,
  );
  const parts = sliceRoot(out);
  if (!parts) return out;
  const inner = shelveHeavyAttributes(parts.inner);
  const after = parts.after.replace("</div>", `</div>${REVEAL_HOME_MEDIA}`);
  return parts.before + inner + after;
}

export const FALLBACK_TITLE = "SaaSSuite | The Best HighLevel SaaS Tool";

/** Prerender keeps the static title and Helmet's title. Leave exactly one. */
export function collapseDuplicateTitles(html: string): string {
  const titles = [...html.matchAll(/<title\b[^>]*>[\s\S]*?<\/title>/gi)];
  if (titles.length <= 1) return html;
  const textOf = (tag: string) => tag.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
  const fallback = titles.filter((match) => /data-static-seo/i.test(match[0]) || textOf(match[0]) === FALLBACK_TITLE);
  const specific = titles.filter((match) => !fallback.includes(match));
  let out = html;
  if (specific.length === 0) {
    for (const match of fallback.slice(1)) out = out.replace(match[0], "");
    return out;
  }
  for (const match of fallback) out = out.replace(match[0], "");
  const rest = [...out.matchAll(/<title\b[^>]*>[\s\S]*?<\/title>/gi)];
  for (const match of rest.slice(1)) out = out.replace(match[0], "");
  return out;
}

function attr(tag: string, name: string) {
  const match = tag.match(new RegExp(`\\b${name}\\s*=\\s*("([^"]*)"|'([^']*)')`, "i"));
  return match?.[2] ?? match?.[3] ?? "";
}

/**
 * The hero image is the LCP element on these landers. A head preload starts it
 * before the parser reaches the body, and an avif source wins over the jpg fallback.
 */
export function preloadLanderLcpImage(html: string): string {
  if (html.includes('data-ss-lcp-preload="1"')) return html;
  const img = html.match(/<img\b[^>]*\bfetchpriority=["']high["'][^>]*>/i);
  if (!img || img.index === undefined) return html;
  const before = html.slice(0, img.index);
  const pictureStart = before.lastIndexOf("<picture");
  const pictureEnd = before.lastIndexOf("</picture>");
  const inPicture = pictureStart !== -1 && pictureStart > pictureEnd;
  let preload = "";
  if (inPicture) {
    const picture = html.slice(pictureStart, img.index + img[0].length);
    const source = picture.match(/<source\b[^>]*type=["']image\/avif["'][^>]*>/i)?.[0] ?? "";
    const srcset = attr(source, "srcset");
    if (srcset) {
      const href = srcset.split(",")[0]?.trim().split(/\s+/)[0] ?? "";
      const sizes = attr(source, "sizes");
      if (href) {
        preload = `<link rel="preload" as="image" fetchpriority="high" type="image/avif" href="${href}" imagesrcset="${srcset}"${sizes ? ` imagesizes="${sizes}"` : ""} data-ss-lcp-preload="1">`;
      }
    }
  }
  if (!preload) {
    const src = attr(img[0], "src");
    if (!src || src.startsWith("data:")) return html;
    preload = `<link rel="preload" as="image" fetchpriority="high" href="${src}" data-ss-lcp-preload="1">`;
  }
  const head = html.match(/<head[^>]*>/i);
  if (!head || head.index === undefined) return html;
  const at = head.index + head[0].length;
  return html.slice(0, at) + preload + html.slice(at);
}

/** Strip the prerender server address out of saved HTML and unhide the booking calendar. */
export function cleanPrerenderedHtml(html: string): string {
  let out = collapseDuplicateTitles(markBakedPixel(stripBakedThirdPartyScripts(stripCookieNotice(html))))
    .replace(/<iframe\b[^>]*(?:127\.0\.0\.1|m-outer|js\.stripe\.com|m\.stripe\.network)[^>]*>[\s\S]*?<\/iframe>/gi, "");
  out = out
    .replace(/https?:\/\/127\.0\.0\.1:8000/gi, "https://saassuite.ai")
    .replace(/https?%3A%2F%2F127\.0\.0\.1%3A8000/gi, "https%3A%2F%2Fsaassuite.ai")
    .replace(/http%3A%2F%2F127\.0\.0\.1%3A8000/gi, "https%3A%2F%2Fsaassuite.ai");
  out = out.replace(/<iframe\b[^>]*link\.saassuite\.ai\/widget\/booking[^>]*>/gi, (tag) => {
    const cleaned = tag
      .replace(/\sdata-iframe-resizer-[a-z0-9-]+=(?:"[^"]*"|'[^']*')/gi, "")
      .replace(/\sdata-initial-iframe-hidden(?:=(?:"[^"]*"|'[^']*'))?/gi, "")
      .replace(/\sstyle=(?:"[^"]*"|'[^']*')/gi, "");
    return cleaned.replace(/<iframe/i, '<iframe style="width:100%;border:none;overflow:hidden;min-height:600px"');
  });
  return out;
}

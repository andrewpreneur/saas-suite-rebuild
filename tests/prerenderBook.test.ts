import { expect, test } from "bun:test";
import { readFileSync } from "fs";
import { cleanPrerenderedHtml, collapseDuplicateTitles, deferFunnelModuleScript, preloadLanderLcpImage, shelveHomepageMedia, stripBakedThirdPartyScripts, stripCookieNotice } from "../scripts/prerenderPostProcess";

test("prerendered booking HTML drops the dev server and shows the calendar", () => {
  const html = `
    <iframe src="https://m.stripe.network/inner.html#url=http%3A%2F%2F127.0.0.1%3A8000%2Fbook"></iframe>
    <iframe src="https://js.stripe.com/v3/m-outer.html#url=http://127.0.0.1:8000/book"></iframe>
    <iframe src="https://link.saassuite.ai/widget/booking/o9wpEynHX15bCaaSl9bM" style="opacity:0;visibility:hidden;position:absolute;left:-9999px" data-iframe-resizer-initialized="true" data-initial-iframe-hidden="true"></iframe>
    <a href="http://127.0.0.1:8000/book">book</a>
  `;
  const cleaned = cleanPrerenderedHtml(html);
  expect(cleaned).not.toContain("127.0.0.1");
  expect(cleaned).not.toContain("m-outer");
  expect(cleaned).toContain("https://saassuite.ai/book");
  expect(cleaned).toContain("min-height:600px");
  expect(cleaned).not.toContain("data-initial-iframe-hidden");
  expect(cleaned).not.toContain("left:-9999px");
  expect(readFileSync("vite.config.ts", "utf8")).toContain("cleanPrerenderedHtml");
  expect(readFileSync("vite.config.ts", "utf8")).toContain('data-ss-hydrate="1"');
});

test("prerender strips the delayed cookie banner so hydration can keep the hero", () => {
  const html = `<div id="root"><div class="ofk"><h1>Get the Kit</h1></div><div role="region" aria-label="Cookie notice"><div><p>Cookies</p></div></div></div>`;
  const cleaned = stripCookieNotice(html);
  expect(cleaned).toContain("<h1>Get the Kit</h1>");
  expect(cleaned).not.toContain("Cookie notice");
  expect(cleaned).toContain('<div id="root"><div class="ofk">');
  expect(readFileSync("src/entries/bootRoot.tsx", "utf8")).toContain("hydrateRoot");
});

test("funnel HTML boots the module after the hero can paint", () => {
  const html = `<head><script type="module" crossorigin="" src="/assets/index-abc.js"></script><link rel="modulepreload" crossorigin="" href="/assets/funnel-x.js"><link rel="stylesheet" href="/assets/kit.css"></head><body><h1>Kit</h1></body>`;
  const out = deferFunnelModuleScript(html);
  expect(out).not.toContain("<script type=\"module\" crossorigin");
  expect(out).not.toContain("modulepreload");
  expect(out).toContain("/assets/kit.css");
  expect(out).toContain('s.src="/assets/index-abc.js"');
  expect(out).toContain('addEventListener("load"');
  expect(out).toContain("requestAnimationFrame");
  expect(out).toContain("setTimeout(boot,400)");
  expect(out).toContain("setTimeout(boot,5000)");
  expect(out).toContain("s.onerror=function()");
  expect(out).toContain("if(tries<4)setTimeout(boot,tries*500)");
  expect(out).not.toContain('addEventListener("load",boot)');
  expect(out.indexOf("<h1>Kit</h1>")).toBeLessThan(out.indexOf("addEventListener"));
});

test("homepage fallback shelves heavy media until the path is /", () => {
  const html = `<html><head><link rel="preload" as="image" href="https://assets.cdn.filesafe.space/a.gif"><link rel="modulepreload" href="/assets/app.js"></head><body><div id="root"><div><video poster="https://assets.cdn.filesafe.space/a.gif"><source src="https://assets.cdn.filesafe.space/a.mp4" type="video/mp4"></video><img src="/assets/hero-bg.png" alt=""><img src="/assets/video-onboarding-abc.png" alt=""><img src="/assets/saassuite-logo.png" alt="logo"><div style="background-image: url(/assets/hero-bg.png)"></div></div></div></body></html>`;
  const shelved = shelveHomepageMedia(html);
  expect(shelved).not.toContain(' src="https://assets.cdn.filesafe.space/a.mp4"');
  expect(shelved).not.toContain(' poster="https://assets.cdn.filesafe.space/a.gif"');
  expect(shelved).not.toContain(' src="/assets/hero-bg.png"');
  expect(shelved).not.toContain(' src="/assets/video-onboarding-abc.png"');
  expect(shelved).not.toContain("rel=\"preload\" as=\"image\" href=\"https://assets.cdn.filesafe.space/a.gif\"");
  expect(shelved).toContain('data-ss-src="https://assets.cdn.filesafe.space/a.mp4"');
  expect(shelved).toContain('data-ss-poster="https://assets.cdn.filesafe.space/a.gif"');
  expect(shelved).toContain('data-ss-src="/assets/hero-bg.png"');
  expect(shelved).toContain('src="/assets/saassuite-logo.png"');
  expect(shelved).toContain("data-ss-style=");
  expect(shelved).toContain("modulepreload");
  expect(shelved).toContain("data-ss-reveal-home");
  expect(shelved).toContain('host==="onefeaturekit.com"');
  expect(shelved).toContain('path!=="/"');
  expect(shelved.indexOf('id="root"')).toBeLessThan(shelved.indexOf("data-ss-reveal-home"));
  expect(readFileSync("vite.config.ts", "utf8")).toContain('"/onefeaturetraining-3"');
  expect(readFileSync("vite.config.ts", "utf8")).toContain('"/onefeaturetraining-4"');
  expect(readFileSync("vite.config.ts", "utf8")).toContain('"/aisaas"');
  expect(readFileSync("vite.config.ts", "utf8")).toContain("shelveHomepageMedia");
  expect(readFileSync("vite.config.ts", "utf8")).toContain("LANDER_PRERENDER_ROUTES.includes(renderedRoute.route)");
  expect(readFileSync("src/components/one-feature/shared.tsx", "utf8")).toContain("YouTubeFacade");
  expect(readFileSync("src/components/one-feature/shared.tsx", "utf8")).toContain("TRAINING_YOUTUBE_ID");
});

test("pixel init ignores a second bare call and a second PageView on the same path", () => {
  const html = readFileSync("index.html", "utf8");
  expect(html).toContain("if (f.__ssPx[pixelId]) return;");
  expect(html).toContain("arguments[2] && typeof arguments[2] === 'object'");
  expect(html).toContain("fbq('set', 'autoConfig', false, '745177780828109');");
  expect(html.indexOf("fbq('set', 'autoConfig', false, '745177780828109')")).toBeLessThan(
    html.indexOf("fbq('init', '745177780828109')"),
  );
  expect(html).toContain("fbq('init', '745177780828109')");
  expect(html).toContain("cmd === 'trackSingle' || cmd === 'trackSingleCustom'");
  expect(html).toContain("f.__ssPvPath !== pvPath");
  expect(html).toContain("f.__ssPv = {}");
  expect(html).toContain("f.__ssPv['*|' + pvPath]");
  expect(html).toContain("eventID: window.__ofkMetaIds.pageViewId");

  const start = html.indexOf("!function(f,b,e,v,n,t,s)");
  const end = html.indexOf("}(window, document,'script'", start);
  const invokeEnd = html.indexOf(");", end);
  const script = html.slice(start, invokeEnd + 2);
  const location = { pathname: "/onefeaturetraining-3", search: "" };
  const documentStub = {
    documentElement: { getAttribute: () => null },
    querySelector: () => null,
    readyState: "complete",
    addEventListener() {},
    createElement: () => ({ async: false, src: "" }),
    getElementsByTagName: () => [{ parentNode: { insertBefore() {} } }],
  };
  const windowStub: { fbq?: { queue: unknown[][] } & ((...args: unknown[]) => void) } = {};
  new Function("window", "document", "location", script)(windowStub, documentStub, location);
  const fbq = windowStub.fbq!;
  const pageViews = () =>
    fbq.queue
      .filter((entry) => entry[1] === "PageView" || entry[2] === "PageView")
      .map((entry) => [entry[0], entry[1], entry[2]].filter((part) => part !== undefined));

  fbq("set", "autoConfig", false, "745177780828109");
  fbq("init", "745177780828109");
  fbq("set", "autoConfig", false, "1601372838188959");
  fbq("init", "1601372838188959");
  fbq("track", "PageView");
  fbq("init", "745177780828109", {});
  expect(fbq.queue.filter((entry) => entry[0] === "init" && entry[2] && Object.keys(entry[2] as object).length === 0)).toEqual([]);
  fbq("track", "PageView");
  fbq("trackSingle", "745177780828109", "PageView");
  fbq("trackSingleCustom", "745177780828109", "PageView");
  expect(pageViews()).toEqual([["track", "PageView"]]);
  fbq("init", "745177780828109", { em: "a@b.test" });
  expect(fbq.queue.some((entry) => entry[0] === "init" && entry[2] && typeof entry[2] === "object")).toBe(true);
  location.pathname = "/aisaas";
  fbq("track", "PageView");
  fbq("track", "PageView");
  fbq("trackSingle", "745177780828109", "PageView");
  location.pathname = "/onefeaturetraining-3";
  fbq("track", "PageView");
  fbq("trackSingle", "1601372838188959", "PageView");
  location.pathname = "/onefeaturetraining-success";
  fbq("track", "PageView");
  expect(pageViews()).toEqual([
    ["track", "PageView"],
    ["track", "PageView"],
    ["track", "PageView"],
    ["track", "PageView"],
  ]);
  fbq("track", "Lead", {});
  fbq("trackSingle", "745177780828109", "Lead", { content_name: "gtm" });
  fbq("track", "Purchase", { value: 97 });
  fbq("track", "Lead", {}, { eventID: "lead_row" });
  fbq("track", "Purchase", { value: 97 }, { eventID: "order_cs_123" });
  const named = (eventName: string) => fbq.queue.filter((entry) => entry[1] === eventName || entry[2] === eventName);
  expect(named("Lead")).toHaveLength(1);
  expect(named("Lead")[0]?.[3]).toEqual({ eventID: "lead_row" });
  expect(named("Purchase")).toHaveLength(1);
  expect(named("Purchase")[0]?.[3]).toEqual({ eventID: "order_cs_123" });
  const checkout = readFileSync("src/components/StripeEmbeddedCheckout.tsx", "utf8");
  expect(checkout).not.toMatch(/useMemo\(\s*\(\)\s*=>\s*loadStripe/);
  expect(checkout).not.toMatch(/from "@stripe\/stripe-js"/);
  expect(checkout).not.toMatch(/from "@stripe\/react-stripe-js"/);
  expect(checkout).toContain('import("@stripe/stripe-js")');
  expect(checkout).toContain("if (!open || isNativeApp()) return;");
  expect(checkout).toContain("export function prefetchEmbeddedStripe");
  const markup = readFileSync("src/funnel/one-feature-kit/markup/checkout.html", "utf8");
  expect(markup).toContain('<h1 class="mt32 ofk-co-title">The GoHighLevel One Feature Kit</h1>');
  expect(markup).toContain('data-ofk-complete-proxy="1"');
  expect(readFileSync("src/funnel/one-feature-kit/wire.ts", "utf8")).toContain('target.closest("[data-ofk-complete-proxy]")');
  expect(readFileSync("src/pages/OneFeatureKit.tsx", "utf8")).toContain('pageId === "thankyou"');
});

test("prerender drops third-party tags the browser inserted while snapshotting", () => {
  const html = `<html><head><script type="text/javascript" async="" src="https://lynks.lynkific.com/js/am.js"></script><script async src="https://connect.facebook.net/en_US/fbevents.js"></script><script src="https://www.googletagmanager.com/gtm.js?id=GTM-M7B83SRK"></script><script src="https://www.google-analytics.com/analytics.js"></script><script src="https://js.stripe.com/dahlia/stripe.js"></script><iframe src="https://js.stripe.com/v3/m-outer.html"></iframe><script>keep()</script></head></html>`;
  const cleaned = stripBakedThirdPartyScripts(html);
  expect(cleaned).not.toContain("lynks.lynkific.com");
  expect(cleaned).not.toContain("googletagmanager.com");
  expect(cleaned).not.toContain("google-analytics.com");
  expect(cleaned).not.toContain("fbevents.js");
  expect(cleaned).not.toContain("js.stripe.com/dahlia/stripe.js");
  expect(cleaned).toContain("keep()");
  const full = cleanPrerenderedHtml(html);
  expect(full).not.toContain("js.stripe.com");
  expect(full).not.toContain("m-outer");
  expect(full).not.toContain("lynks.lynkific.com");
  expect(full).not.toContain('data-ss-pixel="1"');
  expect(full).not.toContain("fbevents.js");
  const noPixel = cleanPrerenderedHtml(`<html><head><script>fbq('track', 'PageView')</script></head></html>`);
  expect(noPixel).not.toContain("data-ss-pixel");
  expect(noPixel).toContain("fbq('track', 'PageView')");
});

test("lander prerender preloads the high-priority hero, avif first", () => {
  const avif = `<html><head><title>Train</title></head><body><picture><source type="image/avif" srcset="/assets/ofk/yt-480.avif 480w, /assets/ofk/yt-960.avif 960w" sizes="100vw"><img src="/assets/ofk/yt-960.jpg" fetchpriority="high"></picture></body></html>`;
  const preloaded = preloadLanderLcpImage(avif);
  expect(preloaded).toContain('type="image/avif"');
  expect(preloaded).toContain('href="/assets/ofk/yt-480.avif"');
  expect(preloaded).toContain('imagesrcset="/assets/ofk/yt-480.avif 480w, /assets/ofk/yt-960.avif 960w"');
  expect(preloaded).toContain('data-ss-lcp-preload="1"');
  expect(preloaded.indexOf("data-ss-lcp-preload")).toBeLessThan(preloaded.indexOf("<picture"));
  expect(preloadLanderLcpImage(preloaded)).toBe(preloaded);
  const portrait = `<html><head></head><body><img src="/assets/andrew.webp" fetchpriority="high"></body></html>`;
  expect(preloadLanderLcpImage(portrait)).toContain('href="/assets/andrew.webp"');
  expect(preloadLanderLcpImage(`<html><head></head><body><img src="/logo.png"></body></html>`)).not.toContain("preload");
  expect(readFileSync("vite.config.ts", "utf8")).toContain("preloadLanderLcpImage");
});

test("prerendered pages keep one title", () => {
  const html = `<head><title data-rh="true">I sell ONE GHL Feature for $99/month | Free Training</title><title data-static-seo>SaaSSuite | The Best HighLevel SaaS Tool</title><meta data-static-seo name="description" content="fallback"></head>`;
  const collapsed = collapseDuplicateTitles(html);
  expect(collapsed.match(/<title\b/gi)).toHaveLength(1);
  expect(collapsed).toContain("Free Training");
  expect(collapsed).not.toContain("Best HighLevel");
  expect(cleanPrerenderedHtml(html).match(/<title\b/gi)).toHaveLength(1);
  const only = collapseDuplicateTitles(`<title data-static-seo>SaaSSuite | The Best HighLevel SaaS Tool</title>`);
  expect(only.match(/<title\b/gi)).toHaveLength(1);
  expect(readFileSync("index.html", "utf8")).toContain("<title data-static-seo>");
});

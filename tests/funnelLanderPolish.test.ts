import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { PAGE_OWNED_ROBOTS } from "../src/components/RobotsPolicy";
import { socialImageUrl } from "../src/components/PageSEO";

const FUNNELS = [
  "/onefeaturetraining-2",
  "/onefeaturetraining-success",
  "/onefeaturetraining-5",
  "/onefeaturetraining-quiz",
  "/agents",
  "/work-with-us",
  "/highlevelers",
  "/highlevelers-upgrade",
  "/founders-plan",
] as const;

test("pre-ad funnels own one noindex, nofollow tag", () => {
  expect([...PAGE_OWNED_ROBOTS]).toEqual([...FUNNELS]);
  const policy = readFileSync("src/components/RobotsPolicy.tsx", "utf8");
  expect(policy).toContain('content="noindex, follow"');
  expect(policy).toContain("PAGE_OWNED_ROBOTS.has(pathKey(pathname))");
  const seo = readFileSync("src/components/PageSEO.tsx", "utf8");
  expect(seo).toContain('content="noindex, nofollow"');
  expect(seo.match(/name="robots"/g)).toHaveLength(1);
  const training = readFileSync("src/pages/OneFeatureTraining.tsx", "utf8");
  expect(training).toContain("noindex={variant === 2}");
  expect(training).not.toContain("noindex={variant === 1}");
  expect(readFileSync("src/pages/OneFeatureStrategy.tsx", "utf8")).toContain("noindex={variant === 5}");
  for (const file of [
    "src/pages/OneFeatureQuiz.tsx",
    "src/pages/OneFeatureTrainingSuccess.tsx",
    "src/pages/AgentsApply.tsx",
    "src/pages/WorkWithUs.tsx",
    "src/pages/HighLevelers.tsx",
  ]) {
    expect(readFileSync(file, "utf8")).toContain("noindex");
  }
});

test("social images are absolute and the control shows the 1,200 line", () => {
  expect(socialImageUrl("/creatives/D/og-start-right-1200x630.png")).toBe(
    "https://saassuite.ai/creatives/D/og-start-right-1200x630.png",
  );
  expect(socialImageUrl("/creatives/D/og-burned-before-1200x630.png", "https://saassuite.ai/")).toBe(
    "https://saassuite.ai/creatives/D/og-burned-before-1200x630.png",
  );
  expect(socialImageUrl("https://cdn.example/a.png")).toBe("https://cdn.example/a.png");
  const high = readFileSync("src/pages/HighLevelers.tsx", "utf8");
  expect(high).toContain('"/creatives/D/og-start-right-1200x630.png"');
  expect(high).toContain('"/creatives/D/og-burned-before-1200x630.png"');
  const training = readFileSync("src/pages/OneFeatureTraining.tsx", "utf8");
  expect(training).toContain('variant === 2 ? "Trusted by 1,200+ agencies" : "Trusted by 500+ Agencies"');
  expect(training).toContain("deferPosters={variant === 2}");
  expect(training).toContain('fetchPriority="high"');
  expect(training).toContain('decoding="async"');
});

test("fast landers delay the pixel and GTM the way the kit does", () => {
  const html = readFileSync("index.html", "utf8");
  for (const path of FUNNELS) expect(html).toContain(`"${path}": 1`);
  expect(html).toContain("window.__ssFastLander = !!fastLanders[landerPath]");
  expect(html).toContain("if (!kit && !window.__ssFastLander) { inject(); return; }");
  expect(html).toContain("if (!w.__ssKitPath && !w.__ssFastLander) w.__ssLoadGtm();");
  expect(html).toContain("if (!window.__ssKitPath && !window.__ssFastLander) return;");
  expect(html).toContain("else if (f.__ssFastLander)");
  expect(html).toContain('img[fetchpriority="high"], button.ofk-facade img');
  const scheduleAt = html.indexOf("function scheduleFbq()");
  const kitAt = html.indexOf("if (f.__ssKitPath)");
  const landerAt = html.indexOf("else if (f.__ssFastLander)");
  const immediateAt = html.indexOf("f.__ssLoadFbq();", landerAt);
  expect(scheduleAt).toBeGreaterThan(-1);
  expect(kitAt).toBeGreaterThan(scheduleAt);
  expect(landerAt).toBeGreaterThan(kitAt);
  expect(immediateAt).toBeGreaterThan(landerAt);

  const start = html.indexOf("!function(f,b,e,v,n,t,s)");
  const end = html.indexOf("}(window, document,'script'", start);
  const script = html.slice(start, html.indexOf(");", end) + 2);
  const created: string[] = [];
  const documentStub = {
    documentElement: { getAttribute: () => null },
    querySelector: () => null,
    readyState: "complete",
    addEventListener() {},
    createElement: () => ({ async: false, src: "" }),
    getElementsByTagName: () => [{ parentNode: { insertBefore(_node: unknown, _before: unknown) { created.push("fbevents"); } } }],
  };
  const windowStub: { __ssFastLander?: boolean; fbq?: unknown } = { __ssFastLander: true };
  new Function("window", "document", "location", script)(windowStub, documentStub, { pathname: "/onefeaturetraining-2", search: "" });
  expect(created).toEqual([]);
  expect(windowStub.fbq).toBeTypeOf("function");
});

test("work with us does not ship the full-size headshot", () => {
  const page = readFileSync("src/pages/WorkWithUs.tsx", "utf8");
  expect(page).toContain('src="/assets/andrew-george-192.webp"');
  expect(page).not.toContain("andrew-george.png");
  expect(page).toContain('fetchPriority="low"');
  expect(page).toContain('loading="lazy"');
  const success = readFileSync("src/pages/OneFeatureTrainingSuccess.tsx", "utf8");
  expect(success).toContain("<TrainingVideo eager={false} />");
  expect(readFileSync("src/components/one-feature/shared.tsx", "utf8")).toContain('fetchPriority={eager ? "high" : "low"}');
});

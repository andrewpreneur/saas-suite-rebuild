import { expect, test } from "bun:test";
import { readFileSync } from "fs";
import { isPaintFirstPath, renderedPastFallback } from "../src/entries/paintFirst";

test("paint-first landers include the paid ad pages and the training routes that were falling through to the homepage", () => {
  expect(isPaintFirstPath("/onefeaturetraining-1")).toBe(true);
  expect(isPaintFirstPath("/onefeaturetraining-2")).toBe(true);
  expect(isPaintFirstPath("/onefeaturetraining-3")).toBe(true);
  expect(isPaintFirstPath("/onefeaturetraining-4/")).toBe(true);
  expect(isPaintFirstPath("/onefeaturetraining-5")).toBe(true);
  expect(isPaintFirstPath("/onefeaturetraining-success")).toBe(true);
  expect(isPaintFirstPath("/onefeaturetraining-quiz")).toBe(true);
  expect(isPaintFirstPath("/aisaas")).toBe(true);
  expect(isPaintFirstPath("/agents")).toBe(true);
  expect(isPaintFirstPath("/work-with-us")).toBe(true);
  expect(isPaintFirstPath("/highlevelers")).toBe(true);
  expect(isPaintFirstPath("/highlevelers-upgrade")).toBe(true);
  expect(isPaintFirstPath("/founders-plan")).toBe(true);
  expect(isPaintFirstPath("/agents/thanks")).toBe(false);
  expect(isPaintFirstPath("/one-feature-kit")).toBe(false);
  expect(isPaintFirstPath("/")).toBe(false);
  expect(isPaintFirstPath("/basic")).toBe(false);
});

test("the empty Suspense fallback is not a rendered page", () => {
  expect(renderedPastFallback({ loading: true, heading: "", textLength: 0 })).toBe(false);
  expect(renderedPastFallback({ loading: true, heading: "I sell ONE GHL Feature", textLength: 80 })).toBe(false);
  expect(renderedPastFallback({ loading: false, heading: "", textLength: 12 })).toBe(false);
  expect(renderedPastFallback({ loading: false, heading: "Your 14-Day Free Trial Is Unlocked", textLength: 40 })).toBe(true);
  expect(renderedPastFallback({ loading: false, heading: "This page didn't load", textLength: 80 })).toBe(true);
});

test("a failed module boot retries and the lander prerender is not cleared first", () => {
  const loader = readFileSync("scripts/prerenderPostProcess.ts", "utf8");
  expect(loader).toContain("s.onerror=function(){started=false;if(tries<4)setTimeout(boot,tries*500);}");
  expect(loader).toContain("setTimeout(boot,5000)");
  const boot = readFileSync("src/entries/bootRoot.tsx", "utf8");
  expect(boot).not.toContain('prerender.innerHTML = ""');
  expect(boot).toContain("el.replaceChildren()");
  expect(boot).toContain("prerender.replaceWith(host)");
});

test("paint-first boot keeps the prerender until React commits past the fallback", () => {
  const boot = readFileSync("src/entries/bootRoot.tsx", "utf8");
  expect(boot).toContain("bootBesidePrerender");
  expect(boot).toContain('host.id = "ss-boot"');
  expect(boot).toContain("prerender.replaceWith(host)");
  expect(boot).toContain("renderedPastFallback");
  expect(boot).toContain("isPaintFirstPath(location.pathname) && prerenderMatchesLocation()");
  const main = readFileSync("src/main.tsx", "utf8");
  expect(main).toContain("preloadPaintFirst");
  expect(main).toContain('import("./pages/AiSaasTrial")');
  expect(main).toContain('import("./pages/OneFeatureStrategy")');
});

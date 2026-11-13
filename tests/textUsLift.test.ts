import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { addedPaddingPx, bottomClearancePx, documentEndReached, liftShiftPx } from "../src/lib/liftTextUs";

const link = { top: 700, right: 180, bottom: 732, left: 40 };
const bar = { top: 720, right: 375, bottom: 812, left: 0 };
const banner = { top: 760, right: 360, bottom: 812, left: 12 };

test("a footer Text Us link is lifted clear of a sticky bar it overlaps", () => {
  expect(liftShiftPx(link, [bar])).toBe(20);
  expect(liftShiftPx(link, [banner])).toBe(0);
  expect(liftShiftPx({ ...link, top: 400, bottom: 444 }, [bar])).toBe(0);
  const footer = { top: 768, right: 121, bottom: 812, left: 46 };
  const sticky = { top: 740, right: 375, bottom: 812, left: 0 };
  const cookie = { top: 620, right: 363, bottom: 740, left: 12 };
  expect(liftShiftPx(footer, [sticky, cookie])).toBe(200);
  expect(bottomClearancePx(link, [bar], 812)).toBe(100);
  expect(bottomClearancePx({ ...link, left: 400, right: 500 }, [banner], 812)).toBe(0);
});

test("footer padding does not flip the end check", () => {
  expect(addedPaddingPx("100px", "")).toBe(100);
  expect(addedPaddingPx("100px", "20px")).toBe(80);
  expect(addedPaddingPx("", "")).toBe(0);
  expect(addedPaddingPx("20px", "20px")).toBe(0);
  const scrollY = 1196;
  const viewport = 800;
  const content = 2000;
  expect(documentEndReached(scrollY, viewport, content, 0)).toBe(true);
  expect(documentEndReached(scrollY, viewport, content + 100, 100)).toBe(true);
  expect(documentEndReached(scrollY, viewport, content + 100, 0)).toBe(false);
  expect(documentEndReached(1000, viewport, content + 100, 100)).toBe(false);
});

test("cookie notice width rules stay on the notice", () => {
  const css = readFileSync("src/funnel/one-feature-kit/funnel.css", "utf8");
  const marker = '[aria-label="Cookie notice"]';
  const start = css.indexOf(`${marker}{`);
  expect(start).toBeGreaterThan(0);
  const block = css.slice(start, css.indexOf(".ofk .bump .head{cursor:pointer}"));
  expect(block).toContain("border-radius:16px");
  expect(block).toContain("white-space:normal");
  expect(block).toContain(`${marker} *{`);
  expect(css).not.toMatch(/(^|\n)\*{box-sizing:border-box/);
  expect(block).not.toContain(".ofk *");
});

test("Text Us stays an sms link with a 44px target and no visible number", () => {
  const link = readFileSync("src/components/TextUsLink.tsx", "utf8");
  const css = readFileSync("src/funnel/one-feature-kit/funnel.css", "utf8");
  expect(link).toContain("SUPPORT_SMS_HREF");
  expect(link).toContain("min-h-11 min-w-11");
  expect(link).not.toContain("337");
  expect(css).toContain("min-height:44px;min-width:44px");
  expect(css).toContain("box-sizing:border-box");
  expect(css).toContain("max-width:calc(100vw - 1.5rem - env(safe-area-inset-left,0px) - env(safe-area-inset-right,0px))");
  expect(css).toContain("min-width:0");
  expect(css).toContain("white-space:normal");
  expect(readFileSync("src/entries/app.tsx", "utf8")).toContain("startTextUsLift");
  expect(readFileSync("src/entries/funnel.tsx", "utf8")).toContain("startTextUsLift");
  expect(readFileSync("src/lib/liftTextUs.ts", "utf8")).toContain(".ofk-checkout-sticky");
  expect(readFileSync("src/lib/liftTextUs.ts", "utf8")).toContain("Cookie notice");
  expect(readFileSync("src/lib/liftTextUs.ts", "utf8")).toContain('minHeight = "44px"');
});

import { readFileSync } from "node:fs";
import { expect, test } from "bun:test";
import { kitSlashlessRedirect } from "../src/funnel/one-feature-kit/host";
import { FUNNEL_ROUTES } from "../src/funnel/one-feature-kit/order";
import { kitStepForPath } from "../src/funnel/one-feature-kit/steps";

const STEPS = [
  ["sales", FUNNEL_ROUTES.sales],
  ["checkout", FUNNEL_ROUTES.checkout],
  ["ghl", FUNNEL_ROUTES.ghl],
  ["launch", FUNNEL_ROUTES.launch],
  ["webinar", FUNNEL_ROUTES.webinar],
  ["thanks", FUNNEL_ROUTES.thanks],
] as const;

test("trailing-slash kit paths map to the slashless step", () => {
  for (const [step, path] of STEPS) {
    expect(kitStepForPath(path)).toBe(step);
    expect(kitStepForPath(`${path}/`)).toBe(step);
    expect(kitStepForPath(`${path}///`)).toBe(step);
  }
  expect(kitStepForPath("/one-feature-kit/nope/")).toBeNull();
  expect(kitStepForPath("/pricing/")).toBeNull();
});

test("the trailing-slash redirect keeps the query string and hash", () => {
  const search = "?fbclid=test&utm_source=facebook&utm_medium=cpc&utm_campaign=kit&utm_content=ad";
  const hash = "#buy";

  for (const [, path] of STEPS) {
    const target = kitSlashlessRedirect(`${path}/`, search, hash, "saassuite.ai");
    expect(target).toEqual({ pathname: path, search, hash });
    const href = `${target?.pathname}${target?.search}${target?.hash}`;
    expect(href).toBe(`${path}${search}${hash}`);
    expect(href).toContain("fbclid=test");
    expect(href).toContain("utm_source=facebook");
  }

  expect(kitSlashlessRedirect("/one-feature-kit", search, hash, "saassuite.ai")).toBeNull();
  expect(kitSlashlessRedirect("/pricing/", "?fbclid=test", "", "saassuite.ai")).toBeNull();
  expect(kitSlashlessRedirect("/one-feature-kit/nope/", search, hash, "saassuite.ai")).toBeNull();

  const kitHost = kitSlashlessRedirect(
    "/checkout/",
    "?fbclid=adclick&utm_source=facebook",
    "#pay",
    "onefeaturekit.com",
  );
  expect(kitHost).toEqual({
    pathname: "/checkout",
    search: "?fbclid=adclick&utm_source=facebook",
    hash: "#pay",
  });
  expect(kitSlashlessRedirect("/thank-you/", search, "", "www.onefeaturekit.com")).toEqual({
    pathname: "/thank-you",
    search,
    hash: "",
  });
});

test("index.html normalizes the early kit view path and the pixel kit-path check", () => {
  const html = readFileSync("index.html", "utf8");
  const early = html.slice(
    html.indexOf("Kit view before React"),
    html.indexOf('src="/src/main.tsx"'),
  );
  expect(early).toContain("var path = (location.pathname||'/').replace(/\\/+$/,'')||'/';");
  expect(html).toContain("var path = (window.location.pathname||'/').replace(/\\/+$/,'')||'/';");
  expect(html).toContain(
    "var kitPath = path === '/one-feature-kit' || path.indexOf('/one-feature-kit/') === 0;",
  );
});

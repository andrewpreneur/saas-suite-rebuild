import { describe, expect, test } from "bun:test";
import {
  appendAttributionToUrl,
  captureWebinarAttribution,
  ensureWebinarAttributionOnPage,
  externalReferrer,
  mergeFirstTouch,
  parseStoredAttribution,
  readAttributionParams,
  rememberFirstTouch,
  WEBINAR_ATTRIBUTION_STORAGE_KEY,
  WEBINAR_ATTRIBUTION_TTL_MS,
  type AttributionStorage,
} from "../src/utils/webinarAttribution";

function memoryStore(
  initial?: Record<string, string>,
): AttributionStorage & { data: Map<string, string> } {
  const data = new Map<string, string>(Object.entries(initial ?? {}));
  return {
    data,
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => {
      data.set(key, value);
    },
  };
}

const NOW = 1_700_000_000_000;

describe("webinar attribution capture", () => {
  test("reads campaign parameters and ignores blanks", () => {
    expect(
      readAttributionParams(
        "?utm_source=test&utm_medium=&utm_campaign=spring&utm_content=ad&utm_term=saas&fbclid=abc&gclid=g1&unrelated=1",
      ),
    ).toEqual({
      utm_source: "test",
      utm_campaign: "spring",
      utm_content: "ad",
      utm_term: "saas",
      fbclid: "abc",
      gclid: "g1",
    });
  });

  test("stores the first landing in local and session storage", () => {
    const local = memoryStore();
    const session = memoryStore();
    const saved = rememberFirstTouch([local, session], {
      search: "?utm_source=test&utm_campaign=test&fbclid=abc",
      referrer: "https://facebook.com/ads",
      pageOrigin: "https://saassuite.ai",
      now: NOW,
    });

    expect(saved).toMatchObject({
      utm_source: "test",
      utm_campaign: "test",
      fbclid: "abc",
      referrer: "https://facebook.com/ads",
    });
    expect(local.data.get(WEBINAR_ATTRIBUTION_STORAGE_KEY)).toBe(
      session.data.get(WEBINAR_ATTRIBUTION_STORAGE_KEY),
    );
    const stored = parseStoredAttribution(
      local.data.get(WEBINAR_ATTRIBUTION_STORAGE_KEY) ?? null,
      NOW,
    );
    expect(stored?.expiresAt).toBe(NOW + WEBINAR_ATTRIBUTION_TTL_MS);
  });

  test("first touch wins and a later empty landing does not erase it", () => {
    const local = memoryStore();
    rememberFirstTouch([local], {
      search: "?utm_source=facebook&utm_medium=paid&gclid=first",
      referrer: "https://google.com",
      pageOrigin: "https://saassuite.ai",
      now: NOW,
    });

    const next = rememberFirstTouch([local], {
      search: "?utm_source=&utm_medium=email&utm_campaign=second&fbclid=",
      referrer: "https://saassuite.ai/pricing",
      pageOrigin: "https://saassuite.ai",
      now: NOW + 60_000,
    });

    expect(next.utm_source).toBe("facebook");
    expect(next.utm_medium).toBe("paid");
    expect(next.gclid).toBe("first");
    expect(next.utm_campaign).toBe("second");
    expect(next.referrer).toBe("https://google.com");
    expect(next.fbclid).toBeUndefined();
  });

  test("an expired record can be replaced by the next landing", () => {
    const local = memoryStore();
    rememberFirstTouch([local], {
      search: "?utm_source=old",
      now: NOW,
    });
    const expiredAt = NOW + WEBINAR_ATTRIBUTION_TTL_MS + 1;
    const next = rememberFirstTouch([local], {
      search: "?utm_source=new&fbclid=abc",
      now: expiredAt,
    });
    expect(next).toEqual({ utm_source: "new", fbclid: "abc" });
    expect(
      parseStoredAttribution(local.data.get(WEBINAR_ATTRIBUTION_STORAGE_KEY) ?? null, expiredAt)
        ?.expiresAt,
    ).toBe(expiredAt + WEBINAR_ATTRIBUTION_TTL_MS);
  });

  test("a blank browser store can inherit signup attribution without letting it override the URL", () => {
    const local = memoryStore();
    const saved = rememberFirstTouch([local], {
      search: "?utm_source=test",
      pageOrigin: "https://saassuite.ai",
      now: NOW,
      fallback: {
        utm_source: "legacy",
        utm_campaign: "from-signup",
        fbclid: "stored-click",
        referrer: "https://saassuite.ai/webinar",
      },
    });
    expect(saved.utm_source).toBe("test");
    expect(saved.utm_campaign).toBe("from-signup");
    expect(saved.fbclid).toBe("stored-click");
    expect(saved.referrer).toBeUndefined();
  });

  test("same-site referrers are not the ad source", () => {
    expect(
      externalReferrer("https://saassuite.ai/pricing", "https://saassuite.ai"),
    ).toBeUndefined();
    expect(externalReferrer("https://l.facebook.com/l.php", "https://saassuite.ai")).toBe(
      "https://l.facebook.com/l.php",
    );
    expect(mergeFirstTouch({ utm_source: "facebook" }, { utm_source: "" })).toEqual({
      utm_source: "facebook",
    });
  });
});

describe("webinar attribution URL appending", () => {
  test("adds stored parameters to a registration URL and keeps the hash", () => {
    const url = appendAttributionToUrl("/ai-saas-webinar#register", {
      utm_source: "test",
      utm_campaign: "test",
      fbclid: "abc",
      referrer: "https://facebook.com/ads",
    });
    const parsed = new URL(url, "https://saassuite.ai");
    expect(parsed.pathname).toBe("/ai-saas-webinar");
    expect(parsed.hash).toBe("#register");
    expect(parsed.searchParams.get("utm_source")).toBe("test");
    expect(parsed.searchParams.get("utm_campaign")).toBe("test");
    expect(parsed.searchParams.get("fbclid")).toBe("abc");
    expect(parsed.searchParams.get("referrer")).toBe("https://facebook.com/ads");
  });

  test("does not overwrite parameters already on the URL and skips empty stored values", () => {
    const original =
      "https://webinarkit.com/webinar/external/registration/6ac025c8b106329d6236ba46?utm_source=already&utm_medium=cpc";
    const url = appendAttributionToUrl(original, {
      utm_source: "stored",
      utm_medium: "",
      utm_campaign: "test",
      gclid: "   ",
      fbclid: "abc",
    });
    const parsed = new URL(url);
    expect(parsed.searchParams.get("utm_source")).toBe("already");
    expect(parsed.searchParams.get("utm_medium")).toBe("cpc");
    expect(parsed.searchParams.get("utm_campaign")).toBe("test");
    expect(parsed.searchParams.get("fbclid")).toBe("abc");
    expect(parsed.searchParams.get("gclid")).toBeNull();
  });

  test("leaves a URL unchanged when there is nothing to add", () => {
    const original = "/webinar?utm_source=test";
    expect(appendAttributionToUrl(original, { utm_source: "other" })).toBe(original);
    expect(appendAttributionToUrl(original, {})).toBe(original);
  });

  test("puts a saved first touch back on the page before WebinarKit can snapshot it", () => {
    const local = memoryStore();
    const session = memoryStore();
    const history = {
      state: { idx: 3 },
      url: "",
      replaceState(state: unknown, _title: string, url: string) {
        this.state = state;
        this.url = url;
      },
    };
    const previousWindow = globalThis.window;
    const previousDocument = globalThis.document;
    Object.assign(globalThis, {
      window: {
        location: {
          origin: "https://saassuite.ai",
          pathname: "/ai-saas-webinar",
          search: "?utm_source=test&utm_campaign=test&fbclid=abc",
          hash: "",
        },
        history,
        localStorage: local,
        sessionStorage: session,
      },
      document: { referrer: "https://facebook.com/ads" },
    });

    try {
      const now = Date.now();
      captureWebinarAttribution(now);
      Object.assign(window.location, { search: "" });
      ensureWebinarAttributionOnPage();
      const restored = new URL(history.url, "https://saassuite.ai");
      expect(history.state).toEqual({ idx: 3 });
      expect(restored.pathname).toBe("/ai-saas-webinar");
      expect(restored.searchParams.get("utm_source")).toBe("test");
      expect(restored.searchParams.get("utm_campaign")).toBe("test");
      expect(restored.searchParams.get("fbclid")).toBe("abc");
      expect(restored.searchParams.get("referrer")).toBe("https://facebook.com/ads");

      Object.assign(window.location, { search: "?utm_source=" });
      const kept = captureWebinarAttribution(now + 1000);
      expect(kept.utm_source).toBe("test");

      window.localStorage.setItem("ss_tracking_optout", "1");
      window.history.url = "";
      ensureWebinarAttributionOnPage();
      expect(window.history.url).toBe("");
    } finally {
      Object.assign(globalThis, { window: previousWindow, document: previousDocument });
    }
  });
});

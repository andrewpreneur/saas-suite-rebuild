import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import {
  KIT_HOME_PATH,
  KIT_HOME_RETURN_TTL_MS,
  armKitHomeReturn,
  consumeKitHomeReturn,
  kitHomeWithAttribution,
  readRememberedKitReturn,
  rememberKitReturn,
  shouldArmKitReturn,
  successAuthErrorPath,
  trainingSuccessAuthPath,
} from "../src/lib/kitReturn";
import { rememberNextPath } from "../src/utils/deepLink";
import { openTrainingSuccess } from "../src/lib/trainingSuccessNav";
import { successSub } from "../src/lib/trainingSuccessCopy";

function params(path: string) {
  return new URLSearchParams(path.split("?")[1] || "");
}

test("kit home is the in-app dashboard view", () => {
  expect(KIT_HOME_PATH).toBe("/app/dashboard?view=kit");
  expect(readFileSync("src/lib/kitDelivery.ts", "utf8")).toContain(
    "export const KIT_DASHBOARD_PATH = KIT_HOME_PATH",
  );
});

test("quiz and non-quiz auth both return to the success page", () => {
  const quiz = trainingSuccessAuthPath(
    "quiz",
    "google",
    "?utm_source=fb&fbclid=abc&src=quiz&go=kit",
  );
  expect(quiz.startsWith("/onefeaturetraining-success?")).toBe(true);
  expect(params(quiz).get("src")).toBe("quiz");
  expect(params(quiz).get("via")).toBe("google");
  expect(params(quiz).get("utm_source")).toBe("fb");
  expect(params(quiz).get("fbclid")).toBe("abc");
  expect(params(quiz).get("go")).toBeNull();
  expect(quiz).not.toContain("/app/dashboard");

  const email = trainingSuccessAuthPath("quiz", "email", "?utm_campaign=oft");
  expect(params(email).get("via")).toBe("email");
  expect(params(email).get("src")).toBe("quiz");
  expect(params(email).get("utm_campaign")).toBe("oft");
  expect(params(email).get("go")).toBeNull();

  for (const src of ["oft5", "oft4", "oft2", ""]) {
    const path = trainingSuccessAuthPath(
      src,
      "google",
      `?utm_source=fb&fbclid=clk&lead=lead_1&src=${src}`,
    );
    expect(path.startsWith("/onefeaturetraining-success?")).toBe(true);
    expect(path).not.toContain("/app/dashboard");
    expect(params(path).get("go")).toBe("kit");
    expect(params(path).get("via")).toBe("google");
    expect(params(path).get("utm_source")).toBe("fb");
    expect(params(path).get("fbclid")).toBe("clk");
    expect(params(path).get("lead")).toBe("lead_1");
    if (src) expect(params(path).get("src")).toBe(src);
    else expect(params(path).get("src")).toBeNull();
  }
  const mailed = trainingSuccessAuthPath("oft5", "email", "?src=oft5&utm_source=fb");
  expect(params(mailed).get("via")).toBe("email");
  expect(params(mailed).get("go")).toBe("kit");
  expect(shouldArmKitReturn("quiz")).toBe(false);
  expect(shouldArmKitReturn("oft5")).toBe(true);
  expect(shouldArmKitReturn("")).toBe(true);
});

test("kit attribution drops open redirects and unknown sources", () => {
  const path = kitHomeWithAttribution(
    "?utm_source=fb&src=https://evil.example&lead=not a lead&fbclid=clk",
    {
      src: "oft5",
      lead: "abc-123",
    },
  );
  expect(params(path).get("view")).toBe("kit");
  expect(params(path).get("utm_source")).toBe("fb");
  expect(params(path).get("fbclid")).toBe("clk");
  expect(params(path).get("src")).toBe("oft5");
  expect(params(path).get("lead")).toBe("abc-123");
  expect(path).not.toContain("evil.example");
});

test("the kit home return is one session key, consumed once, and is not stored durably", () => {
  const source = readFileSync("src/lib/kitReturn.ts", "utf8");
  expect(source).not.toContain("localStorage");
  expect(source).not.toContain("document.cookie");
  const data = new Map<string, string>();
  const store = {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => {
      data.set(key, value);
    },
    removeItem: (key: string) => {
      data.delete(key);
    },
    clear: () => data.clear(),
    key: () => null,
    get length() {
      return data.size;
    },
  };
  const previous = Object.getOwnPropertyDescriptor(globalThis, "sessionStorage");
  Object.defineProperty(globalThis, "sessionStorage", {
    configurable: true,
    writable: true,
    value: store,
  });
  const local = globalThis.localStorage;
  local?.removeItem("kit_return_to");
  local?.removeItem("post_auth_redirect");
  try {
    expect(consumeKitHomeReturn()).toBeNull();
    const armedAt = 1_700_000_000_000;
    armKitHomeReturn(armedAt);
    expect(readRememberedKitReturn(armedAt)).toBe(KIT_HOME_PATH);
    expect(store.getItem("kit_return_to")).not.toBe(KIT_HOME_PATH);
    expect(local?.getItem("kit_return_to") ?? null).toBeNull();
    expect(local?.getItem("post_auth_redirect") ?? null).toBeNull();
    expect(readRememberedKitReturn(armedAt + KIT_HOME_RETURN_TTL_MS + 1)).toBeNull();
    expect(store.getItem("kit_return_to")).toBeNull();
    armKitHomeReturn(armedAt);
    expect(consumeKitHomeReturn(armedAt)).toBe(KIT_HOME_PATH);
    expect(store.getItem("kit_return_to")).toBeNull();
    expect(consumeKitHomeReturn(armedAt)).toBeNull();

    rememberKitReturn("/app/dashboard?view=kit&step=replay");
    expect(consumeKitHomeReturn()).toBeNull();
    expect(readRememberedKitReturn()).toBe("/app/dashboard?view=kit&step=replay");
  } finally {
    if (previous) Object.defineProperty(globalThis, "sessionStorage", previous);
    else delete (globalThis as { sessionStorage?: unknown }).sessionStorage;
  }
});

function installStorage() {
  const sessionData = new Map<string, string>();
  const localData = new Map<string, string>();
  const make = (data: Map<string, string>) => ({
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => {
      data.set(key, value);
    },
    removeItem: (key: string) => {
      data.delete(key);
    },
    clear: () => data.clear(),
    key: () => null,
    get length() {
      return data.size;
    },
  });
  const previousSession = Object.getOwnPropertyDescriptor(globalThis, "sessionStorage");
  const previousLocal = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
  const session = make(sessionData);
  const local = make(localData);
  Object.defineProperty(globalThis, "sessionStorage", {
    configurable: true,
    writable: true,
    value: session,
  });
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    writable: true,
    value: local,
  });
  return {
    local,
    session,
    restore() {
      if (previousSession) Object.defineProperty(globalThis, "sessionStorage", previousSession);
      else delete (globalThis as { sessionStorage?: unknown }).sessionStorage;
      if (previousLocal) Object.defineProperty(globalThis, "localStorage", previousLocal);
      else delete (globalThis as { localStorage?: unknown }).localStorage;
    },
  };
}

test("a cancelled or expired auth return does not store post_auth_redirect", () => {
  const installed = installStorage();
  try {
    for (const src of ["oft5", "oft4", "oft2", "", "quiz"]) {
      for (const via of ["google", "email"] as const) {
        const redirectTo = trainingSuccessAuthPath(
          src,
          via,
          `?utm_source=fb&fbclid=clk&lead=lead_1&src=${src}`,
        );
        const failed = new URL(redirectTo, "https://saassuite.ai");
        failed.searchParams.set("error", "access_denied");
        failed.searchParams.set("error_code", "otp_expired");
        expect(failed.pathname).toBe("/onefeaturetraining-success");
        expect(failed.pathname.startsWith("/app")).toBe(false);
        // Same call the logged-out app shell makes with the address it loaded.
        rememberNextPath(`${failed.pathname}${failed.search}`);
        expect(installed.local.getItem("post_auth_redirect")).toBeNull();
        expect(installed.session.getItem("post_auth_redirect")).toBeNull();

        armKitHomeReturn();
        const expired = successAuthErrorPath(failed.search, "");
        expect(expired?.startsWith("/onefeaturetraining-quiz?")).toBe(true);
        expect(params(expired || "").get("auth")).toBe("expired");
        expect(params(expired || "").get("go")).toBeNull();
        expect(params(expired || "").get("error")).toBeNull();
        expect(params(expired || "").get("utm_source")).toBe("fb");
        expect(readRememberedKitReturn()).toBeNull();
        expect(installed.local.getItem("post_auth_redirect")).toBeNull();

        const cancelledUrl = new URL(redirectTo, "https://saassuite.ai");
        cancelledUrl.hash = "error=access_denied&error_code=access_denied";
        rememberNextPath(`${cancelledUrl.pathname}${cancelledUrl.search}`);
        armKitHomeReturn();
        const cancelled = successAuthErrorPath(cancelledUrl.search, cancelledUrl.hash);
        expect(params(cancelled || "").get("auth")).toBe("cancelled");
        expect(cancelledUrl.pathname).toBe("/onefeaturetraining-success");
        expect(readRememberedKitReturn()).toBeNull();
        expect(installed.local.getItem("post_auth_redirect")).toBeNull();
        expect(installed.session.getItem("post_auth_redirect")).toBeNull();
      }
    }
    // The app shell does store an in-app address. This proves the assertion above
    // is watching the real key, and that a kit error URL would have failed it.
    rememberNextPath("/app/dashboard?view=kit&error=access_denied&error_code=otp_expired");
    expect(installed.local.getItem("post_auth_redirect")).toContain("/app/dashboard?view=kit");
    expect(installed.session.getItem("post_auth_redirect")).toContain("/app/dashboard?view=kit");
  } finally {
    installed.restore();
  }
});

test("subs follow the bridge states", () => {
  expect(successSub("quiz", "google")).toContain("Meanwhile your One Feature Kit is ready");
  expect(successSub("oft5", "")).toContain("We've got your details");
  expect(successSub("oft4", "")).toContain("Log in to SaaSSuite to open your One Feature Kit now");
  expect(successSub("", "")).toBe("Your One Feature Kit and setup steps are below.");
});

test("a slow success chunk does a full navigation instead of hanging on an empty route", async () => {
  let assigned = "";
  let navigated = "";
  let pending: (() => void) | undefined;
  openTrainingSuccess(
    "/onefeaturetraining-success?src=oft5",
    (path) => {
      navigated = path;
    },
    {
      load: () => new Promise(() => {}),
      assign: (url) => {
        assigned = url;
      },
      timeoutMs: 2500,
      schedule: (fn) => {
        pending = fn;
        return 1;
      },
      cancel: () => {},
    },
  );
  pending?.();
  expect(assigned).toBe("/onefeaturetraining-success?src=oft5");
  expect(navigated).toBe("");

  let navigatedReady = "";
  let assignedReady = "";
  let cancelled = 0;
  let resolveLoad: () => void = () => {};
  openTrainingSuccess(
    "/onefeaturetraining-success?src=oft5",
    (path) => {
      navigatedReady = path;
    },
    {
      load: () =>
        new Promise<void>((resolve) => {
          resolveLoad = resolve;
        }),
      assign: (url) => {
        assignedReady = url;
      },
      schedule: () => 7,
      cancel: () => {
        cancelled += 1;
      },
    },
  );
  resolveLoad();
  await Promise.resolve();
  expect(navigatedReady).toBe("/onefeaturetraining-success?src=oft5");
  expect(assignedReady).toBe("");
  expect(cancelled).toBe(1);
});

test("bridge wiring stays on the success page and plain login still defaults to /app", () => {
  const success = readFileSync("src/pages/OneFeatureTrainingSuccess.tsx", "utf8");
  const login = readFileSync("src/pages/Login.tsx", "utf8");
  const app = readFileSync("src/App.tsx", "utf8");
  const dashboard = readFileSync("src/components/Dashboard.tsx", "utf8");
  const strategy = readFileSync("src/pages/OneFeatureStrategy.tsx", "utf8");
  const main = readFileSync("src/main.tsx", "utf8");
  expect(success).toContain("shouldArmKitReturn(src)");
  expect(success).toContain("armKitHomeReturn()");
  expect(success).toContain("trainingSuccessAuthPath");
  expect(success).toContain("successAuthErrorPath");
  expect(success).toContain('current.get("go") === "kit"');
  expect(success).toContain("window.location.replace");
  expect(success).toContain("emailRedirectTo");
  expect(success).toContain("signInWithOtp");
  expect(success).toContain("noindex");
  expect(success).not.toContain("rememberNextPath");
  expect(success).not.toContain("localStorage.setItem");
  expect(success).not.toContain("continue with email</a> on the quiz page");
  expect(login).toContain("consumeKitHomeReturn");
  expect(login).toContain("readNextPath() || navigateWithParams('/app')");
  expect(login).not.toContain("prefers_kit");
  expect(app).toContain("<TrainingSuccessShell />");
  expect(app).toContain('aria-label="Loading"');
  expect(dashboard).toContain("consumeKitHomeReturn()");
  expect(strategy).toContain("preloadTrainingSuccess");
  expect(strategy).toContain("src=oft5");
  expect(main).toContain('import("./pages/OneFeatureTrainingSuccess")');
  const shell = readFileSync("src/components/one-feature/TrainingSuccessShell.tsx", "utf8");
  expect(shell).toContain("Your One Feature Kit");
  expect(shell).not.toContain('aria-label="Loading"');
});

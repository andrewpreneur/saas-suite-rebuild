import { expect, test } from "bun:test";
import { readFileSync } from "fs";
import { shouldAutoOpenNativeApp, webAuthContinueUrl } from "../src/lib/nativeAuthReturn";

test("desktop sign-in stays on https and phones can still open the app", () => {
  expect(shouldAutoOpenNativeApp("Mozilla/5.0 (X11; Linux x86_64)")).toBe(false);
  expect(shouldAutoOpenNativeApp("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)")).toBe(true);
  expect(shouldAutoOpenNativeApp("Mozilla/5.0 (Linux; Android 14)")).toBe(true);
  const web = webAuthContinueUrl("?code=abc&next=%2Fapp", "");
  expect(web.startsWith("https://saassuite.ai/app?")).toBe(true);
  expect(web).toContain("code=abc");
  expect(web).not.toContain("ai.saassuite.app");
  const page = readFileSync("public/auth-native-return.html", "utf8");
  expect(page).toContain("if (!mobile)");
  expect(page).toContain("window.location.replace(web)");
  expect(page.indexOf("if (!mobile)")).toBeLessThan(page.indexOf("ai.saassuite.app://auth?"));
});

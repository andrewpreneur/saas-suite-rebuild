import { expect, test } from "bun:test";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { SUPPORT_SMS_HREF, SUPPORT_SMS_NUMBER, supportSmsUrl } from "../src/lib/supportContact";

const area = "337";
const prefix = "227";
const line = "0501";
const visiblePatterns = [
  `(${area}) ${prefix}-${line}`,
  `${area}-${prefix}-${line}`,
  `${area}.${prefix}.${line}`,
  `+1 ${area} ${prefix} ${line}`,
  `+1-${area}-${prefix}-${line}`,
  `tel:+1${area}${prefix}${line}`,
  `tel:+1-${area}-${prefix}-${line}`,
];

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === "node_modules" || name === "dist" || name === ".git") continue;
    const path = join(dir, name);
    if (statSync(path).isDirectory()) walk(path, out);
    else if (/\.(tsx|ts|html|css|js|jsx|svg|md|json|txt|xml)$/.test(name)) out.push(path);
  }
  return out;
}

test("SaaSSuite texting uses Andrew's number only inside an sms href", () => {
  expect(SUPPORT_SMS_NUMBER).toBe(`${area}${prefix}${line}`);
  expect(SUPPORT_SMS_HREF).toBe(`sms:+1${area}${prefix}${line}`);
  expect(supportSmsUrl("HELP")).toBe(`sms:+1${area}${prefix}${line}?body=HELP`);
  expect(supportSmsUrl("Hi! I have a question about SaaSSuite.", `${area}${prefix}${line}`)).toBe(
    `sms:+1${area}${prefix}${line}?body=Hi!%20I%20have%20a%20question%20about%20SaaSSuite.`,
  );
  expect(supportSmsUrl("")).toBe(SUPPORT_SMS_HREF);
});

test("public Copilot Text Us opens TextUsDialog without showing the number", () => {
  const page = readFileSync(new URL("../src/pages/PublicCopilot.tsx", import.meta.url), "utf8");
  expect(page).toContain("phone={SUPPORT_SMS_NUMBER}");
  expect(page).toContain('message="Hi! I have a question about SaaSSuite."');
  expect(page).not.toContain("supportSmsUrl");
  expect(page).not.toContain("canOpenSmsDirectly");
  const dialog = readFileSync(new URL("../src/components/dashboard/SetupHelpPopup.tsx", import.meta.url), "utf8");
  expect(dialog).toContain('aria-label="Text us"');
  expect(dialog).toContain("supportSmsUrl(message, smsNumber)");
  expect(dialog).not.toContain("Copy number");
  expect(dialog).not.toContain("supportPhoneLabel");
  for (const pattern of visiblePatterns) expect(dialog).not.toContain(pattern);
});

test("agency-specific support numbers remain supported", () => {
  expect(supportSmsUrl("Setup & help", "1234567890")).toBe("sms:1234567890?body=Setup%20%26%20help");
});

test("the support number is not rendered as visible text, alt, title, or a tel link", () => {
  const root = new URL("..", import.meta.url).pathname;
  const files = [...walk(join(root, "src")), join(root, "index.html"), ...walk(join(root, "public")), ...walk(join(root, "seo"))];
  const hits: string[] = [];
  for (const file of files) {
    if (file.endsWith("supportContact.test.ts")) continue;
    const text = readFileSync(file, "utf8");
    for (const pattern of visiblePatterns) {
      if (text.includes(pattern)) hits.push(`${file}: ${pattern}`);
    }
    const labeled = text.match(/(?:aria-label|alt|title)\s*=\s*["'][^"']*(?:337|227)[^"']*["']/gi) || [];
    for (const label of labeled) {
      if (label.includes(area) && label.includes(line)) hits.push(`${file}: ${label}`);
    }
  }
  expect(hits).toEqual([]);
});

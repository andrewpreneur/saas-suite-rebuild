import { describe, expect, it } from "bun:test";
import { languagePreferenceWrites, saveLanguagePreferences } from "../src/lib/languagePreferences";
import { LANGUAGE_OPTIONS, translations } from "../src/translations";

describe("Settings language scope", () => {
  it("personal-only Danish never writes customer defaults", async () => {
    const writes: string[] = [];
    await saveLanguagePreferences("da", false, async (lang) => { writes.push(`personal:${lang}`); }, async (lang) => { writes.push(`customer:${lang}`); });
    expect(writes).toEqual(["personal:da"]);
    expect(languagePreferenceWrites("da", false).customer).toBeNull();
  });
  it("both scopes save Danish for themselves and customer defaults", async () => {
    const writes: string[] = [];
    await saveLanguagePreferences("da", true, async (lang) => { writes.push(`personal:${lang}`); }, async (lang) => { writes.push(`customer:${lang}`); });
    expect(writes).toEqual(["personal:da", "customer:da"]);
  });
  it("personal save failure never changes customer defaults", async () => {
    let changedCustomer = false;
    await expect(saveLanguagePreferences("da", true, async () => { throw new Error("Save failed"); }, async () => { changedCustomer = true; })).rejects.toThrow("Save failed");
    expect(changedCustomer).toBe(false);
  });
  it("reports a partial save rather than claiming both saved", async () => {
    await expect(saveLanguagePreferences("da", true, async () => {}, async () => { throw new Error("Denied"); })).rejects.toThrow("customer default could not be saved");
  });
  it("Danish is selectable with a non-English dashboard dictionary", () => {
    expect(LANGUAGE_OPTIONS.some((option) => option.value === "da")).toBe(true);
    expect(translations.da).not.toEqual(translations.en);
  });
});
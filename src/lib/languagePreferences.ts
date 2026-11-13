import type { SupportedLanguage } from "../translations";

export function languagePreferenceWrites(language: SupportedLanguage, includeCustomers: boolean) {
  return { personal: language, customer: includeCustomers ? language : null };
}

export async function saveLanguagePreferences(
  language: SupportedLanguage,
  includeCustomers: boolean,
  savePersonal: (language: SupportedLanguage) => Promise<void>,
  saveCustomers: (language: SupportedLanguage) => Promise<void>,
) {
  const writes = languagePreferenceWrites(language, includeCustomers);
  await savePersonal(writes.personal);
  if (writes.customer) {
    try {
      await saveCustomers(writes.customer);
    } catch {
      throw new Error("Your language was saved, but the customer default could not be saved. Please try again.");
    }
  }
}
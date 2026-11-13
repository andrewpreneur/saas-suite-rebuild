export const BUILD_YOUR_SAAS_MESSAGE = "I'm ready to work with your GHL agency - my name is ";
export const SETUP_SERVICES = [
  'SaaS white labeling', 'SaaS configurator Setup', 'Webinar Setup',
  'Sales Deck creation', 'Sales page creation', 'Automations Setup',
  'Client portal tracking', 'One account GHL audit',
] as const;
export const LAUNCH_SERVICES = [
  'Ad creative creation', 'Ads setup in your ad account', 'Webinar Video Creation', 'Full GHL audit',
] as const;
export const BUILD_YOUR_SAAS_PACKAGES = {
  setup: { name: 'SaaS Setup', amount: 250000, priceId: 'price_1UXjJbGdZ9PRE3Zil0mpbi4F', services: [...SETUP_SERVICES] },
  launch: { name: 'SaaS Setup + Launch', amount: 500000, priceId: 'price_1UXjMXGdZ9PRE3ZiMgiFe6WN', services: [...SETUP_SERVICES, ...LAUNCH_SERVICES] },
} as const;
export type BuildYourSaasPackage = keyof typeof BUILD_YOUR_SAAS_PACKAGES;
export function getBuildYourSaasPackage(value: unknown) {
  return value === 'setup' || value === 'launch' ? BUILD_YOUR_SAAS_PACKAGES[value] : null;
}
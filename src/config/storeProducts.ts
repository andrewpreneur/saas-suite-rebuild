import { SAME_DAY_WL_SUPPORT } from '@/constants/pricingPlans';

/**
 * In-app subscription configuration for the iOS / Android apps.
 *
 * Web checkout (Stripe) stays exactly as it is. Inside the packaged app the
 * stores require their own billing, so every paid plan has a matching store
 * product and a RevenueCat entitlement.
 *
 * The product IDs below must be created with the SAME identifiers in
 * App Store Connect and Google Play Console, then attached to the matching
 * RevenueCat entitlement.
 */

export type StoreEntitlement = 'basic' | 'advanced' | 'premium_support' | 'agency_seat';

export interface StorePlan {
  /** RevenueCat / store product identifier. */
  productId: string;
  /** RevenueCat entitlement unlocked by this product. */
  entitlement: StoreEntitlement;
  name: string;
  priceDisplay: string;
  period: string;
  interval: 'month' | 'year';
  /** Plan written onto the account when the purchase is active. */
  plan: 'BASIC' | 'ADVANCED' | null;
  /** Whether this purchase also unlocks Premium Support. */
  premiumSupport: boolean;
  /** Agency seats granted while this purchase is active. */
  seats?: number;
  blurb: string;
  features: string[];
  highlight?: boolean;
}

/**
 * Paid plans sold inside the iOS and Android apps. Starter stays free and is
 * not a store product. Product IDs must match App Store Connect and RevenueCat.
 */
export const STORE_PLANS: StorePlan[] = [
  {
    productId: 'ss_basic_monthly',
    entitlement: 'basic',
    name: 'Basic',
    priceDisplay: '$27',
    period: 'per month',
    interval: 'month',
    plan: 'BASIC',
    premiumSupport: false,
    blurb: 'One branded onboarding and support hub for your customers.',
    features: [
      '1 SaaS onboarding experience',
      'Branded client hub',
      'AI chat support',
      'Knowledge base and videos',
    ],
  },
  {
    productId: 'ss_basic_yearly',
    entitlement: 'basic',
    name: 'Basic',
    priceDisplay: '$239.99',
    period: 'per year',
    interval: 'year',
    plan: 'BASIC',
    premiumSupport: false,
    blurb: 'Basic billed once a year, $20 a month.',
    features: ['Everything in Basic', 'Billed once a year'],
  },
  {
    productId: 'ss_advanced_monthly',
    entitlement: 'advanced',
    name: 'Advanced',
    priceDisplay: '$97',
    period: 'per month',
    interval: 'month',
    plan: 'ADVANCED',
    premiumSupport: false,
    highlight: true,
    blurb: 'Everything unlocked — unlimited users and the full AI suite.',
    features: [
      'Everything in Basic',
      SAME_DAY_WL_SUPPORT,
      '3 custom onboarding experiences',
      'SaaS Health dashboard and tracking',
      'Voice AI, human handover, AI CoPilot',
      'Custom domain and marketing suite',
      'Unlimited users',
    ],
  },
  {
    productId: 'ss_advanced_yearly',
    entitlement: 'advanced',
    name: 'Advanced',
    priceDisplay: '$869.99',
    period: 'per year',
    interval: 'year',
    plan: 'ADVANCED',
    premiumSupport: false,
    highlight: true,
    blurb: 'Advanced billed once a year, $72.50 a month.',
    features: ['Everything in Advanced', 'Billed once a year'],
  },
  {
    productId: 'ss_premium_support_monthly',
    entitlement: 'premium_support',
    name: 'Premium Support',
    priceDisplay: '$297',
    period: 'per month',
    interval: 'month',
    plan: 'ADVANCED',
    premiumSupport: true,
    blurb: 'Advanced plus our team answering your customers for you.',
    features: [
      'Everything in Advanced',
      'Our team answers your clients',
      'Done-for-you chat coverage',
      'Priority onboarding help',
    ],
  },
  {
    productId: 'ss_premium_support_annual',
    entitlement: 'premium_support',
    name: 'Premium Support',
    priceDisplay: '$999.99',
    period: 'per year',
    interval: 'year',
    plan: 'ADVANCED',
    premiumSupport: true,
    blurb: 'Premium Support billed once a year.',
    features: ['Everything in Premium Support', 'Billed once a year'],
  },
  {
    productId: 'ss_agency_seat_monthly',
    entitlement: 'agency_seat',
    name: 'Agency seat',
    priceDisplay: '$49',
    period: 'per seat / month',
    interval: 'month',
    plan: null,
    premiumSupport: false,
    seats: 1,
    blurb: 'One renewing agency support seat. Apple allows one of these per Apple ID.',
    features: ['1 agency support seat', 'Renews every month', 'Assign the seat to a client'],
  },
];

export const findStorePlan = (productId?: string | null) =>
  STORE_PLANS.find((p) => p.productId === productId) ?? null;

const PLAN_RANK: Record<StoreEntitlement, number> = {
  basic: 1,
  advanced: 2,
  premium_support: 3,
  agency_seat: 0,
};

/**
 * One current plan. If Basic and Advanced are both active, only Advanced
 * (or Premium Support, when that is higher) is the current plan. An agency
 * seat can sit beside that plan. Same-tier monthly and yearly both stay so
 * each billing toggle can mark the one that was bought.
 */
export const currentStoreProductIds = (productIds: string[]): string[] => {
  const plans = productIds
    .map((id) => ({ id, plan: findStorePlan(id) }))
    .filter((item): item is { id: string; plan: StorePlan } => Boolean(item.plan));
  const seats = plans.filter((item) => item.plan.entitlement === 'agency_seat').map((item) => item.id);
  const subscriptions = plans.filter((item) => item.plan.entitlement !== 'agency_seat');
  const best = subscriptions.reduce((max, item) => Math.max(max, PLAN_RANK[item.plan.entitlement] ?? 0), 0);
  const winners = best === 0
    ? []
    : subscriptions.filter((item) => PLAN_RANK[item.plan.entitlement] === best).map((item) => item.id);
  return [...winners, ...seats];
};

/** Website checkout plan → App Store / Play product. Starter and special offers have none. */
export const storeProductIdForCheckout = (plan: string): string | null => {
  const ids: Record<string, string> = {
    basic: 'ss_basic_monthly',
    basic_annual: 'ss_basic_yearly',
    advanced: 'ss_advanced_monthly',
    advanced_annual: 'ss_advanced_yearly',
    enhanced: 'ss_premium_support_monthly',
    enhanced_annual: 'ss_premium_support_annual',
  };
  return ids[plan] ?? null;
};

/**
 * RevenueCat public SDK keys. These are publishable by design (safe in the
 * bundle) — the secret key and webhook secret live only on the server.
 */
const IOS_PUBLIC_KEY = 'appl_TSUXCBryHEakVQhGBiTptgosPcq';
const ANDROID_PUBLIC_KEY = 'goog_zBcRUDldHvOpHNcdXlxOunSsYfk';

export const REVENUECAT_API_KEYS = {
  ios: import.meta.env.VITE_REVENUECAT_IOS_KEY || IOS_PUBLIC_KEY,
  android: import.meta.env.VITE_REVENUECAT_ANDROID_KEY || ANDROID_PUBLIC_KEY,
};

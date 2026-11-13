// Shared pricing config for SaaS Support (default) vs Agency Support (white-glove fulfillment)

export type PricingMode = 'saas' | 'agency';
export type BillingCycle = 'monthly' | 'annual';
export type SaasPlanKey = 'starter' | 'basic' | 'advanced' | 'premium';
export type CheckoutPlan = 'basic' | 'basic_annual' | 'advanced' | 'advanced_annual' | 'enhanced' | 'enhanced_annual';

export interface SaasPlan {
  key: SaasPlanKey;
  name: string;
  tagline: string;
  monthlyPrice: number | null;
  annualMonthlyEquivalent: number | null;
  annualTotal: number | null;
  featureIntro?: string;
  features: string[];
  recommended?: boolean;
}

/** Advanced ($97) only. Not part of Basic. Premium keeps its own list plus "Everything in Advanced". */
export const SAME_DAY_WL_SUPPORT = "Same Day WL Support";
export const SAME_DAY_WL_SUPPORT_INFO =
  "We can answer tickets, chats, and questions from your customers within 24 hours.";

export const PLAN_FEATURE_INFO: Readonly<Record<string, string>> = {
  [SAME_DAY_WL_SUPPORT]: SAME_DAY_WL_SUPPORT_INFO,
};

export const featureInfoFor = (label: string): string | undefined => PLAN_FEATURE_INFO[label];

export const SAAS_PLANS: Record<SaasPlanKey, SaasPlan> = {
  starter: {
    key: 'starter', name: 'Starter', tagline: 'Everything you need to start your SaaS.',
    monthlyPrice: null, annualMonthlyEquivalent: null, annualTotal: null,
    features: ['25+ Brandless Video Onboarding Series', 'Upload Custom Videos', 'Create Custom Onboarding Checklists', 'White-Label Knowledge Base', 'Support Ticketing', 'Up to 1 user'],
  },
  basic: {
    key: 'basic', name: 'Basic', tagline: 'Support your momentum with a completely custom SaaS experience.',
    monthlyPrice: 27, annualMonthlyEquivalent: 20, annualTotal: 240,
    featureIntro: 'Everything in Starter, plus…',
    features: ['White Label Branding Tool', 'Toggle On/Off Videos', 'AI Chat Support Access', 'Menu Link Removal', 'AI Offer & Ads Tool', 'Up to 5 users'],
  },
  advanced: {
    key: 'advanced', name: 'Advanced', tagline: 'Unlimited users. Endless analytics. Real humans, 24/7.',
    monthlyPrice: 97, annualMonthlyEquivalent: 72.5, annualTotal: 870,
    featureIntro: 'Everything in Basic, plus…',
    features: ['24/7 Human Support for You & Your Team (live chat, tickets, and Zoom with our team)', SAME_DAY_WL_SUPPORT, 'Unlimited 24/7 AI Chat Support', 'Unlimited Subaccounts', 'Unlimited Users', '3 Custom SaaS Plan Onboarding Experiences', 'SaaS Health Dashboard', 'Login Tracking', 'Onboarding Tracking', 'Voice AI Onboarding', 'Knowledge Base Editor', 'White-Label Help Center Widget & Article Library', 'Feature Release Announcements with video guides', 'White-Label Client Academy'],
  },
  premium: {
    key: 'premium', name: 'Premium Support', tagline: 'We become your support team. Your brand, our people.',
    monthlyPrice: 297, annualMonthlyEquivalent: 222.5, annualTotal: 2670,
    featureIntro: 'Everything in Advanced, plus…', recommended: true,
    features: ['24/7 Human Live Chat Support for Your Clients (white-labeled under your brand)', '1:1 Zoom Support for Your Clients', 'Ticket & Email Support for Your Clients', 'HighLevel-Certified Support Agents', "We open GHL tickets on your customers' behalf", 'Dedicated Slack channel with our team', 'Priority escalation for developer issues', 'Direct contact with the founder'],
  },
};

export const checkoutPlanFor = (plan: Exclude<SaasPlanKey, 'starter'>, cycle: BillingCycle): CheckoutPlan => {
  if (plan === 'premium') return cycle === 'annual' ? 'enhanced_annual' : 'enhanced';
  return `${plan}${cycle === 'annual' ? '_annual' : ''}` as CheckoutPlan;
};

export const AGENCY_BOOKING_URL = 'https://saassuite.ai/book';

export interface AgencyPlan {
  key: 'payg' | 'starter' | 'advanced';
  name: string;
  tagline: string;
  priceDisplay: string;        // e.g. "$97", "$485", "Custom"
  priceSuffix: string;         // e.g. "/account/month", "/month", ""
  note?: string;               // small line under price
  ctaLabel: string;
  highlight?: boolean;
}

export const AGENCY_PLANS: AgencyPlan[] = [
  {
    key: 'payg',
    name: 'Pay-as-you-go',
    tagline: 'Fulfillment on demand, per client account.',
    priceDisplay: '$49',
    priceSuffix: '/account/month',
    note: 'No minimum. Add or remove accounts anytime.',
    ctaLabel: 'Book a call',
  },
  {
    key: 'starter',
    name: 'Starter',
    tagline: 'For agencies with a small book of business.',
    priceDisplay: '$245',
    priceSuffix: '/month',
    note: '5 client accounts included ($49 × 5)',
    ctaLabel: 'Book a call',
    highlight: true,
  },
  {
    key: 'advanced',
    name: 'Advanced',
    tagline: 'Scale accounts up or down as you grow.',
    priceDisplay: '$49',
    priceSuffix: '/account/month',
    note: 'Scale account count month to month.',
    ctaLabel: 'Talk to us',
  },
];

// Features shared across all Agency plans (delivered under white-glove fulfillment)
export const AGENCY_FEATURES: string[] = [
  'Everything included in the SaaSSuite software',
  'A2P HighLevel registration handled for you',
  'Website building for your clients',
  'Automation & workflow building',
  'QA on your funnels and workflows',
  '24/7 chat with your clients — we answer, not you',
  'Complete white-glove support & onboarding',
  '100% US team for live calls',
  'CRM, marketing automation, and AI implementation done-for-you',
];

export const AGENCY_PITCH =
  'We become your CRM, marketing automation, and AI implementation team. Your clients talk to us — not you.';

export const SAAS_PITCH =
  'Onboarding, education, and support for your SaaS customers. Your clients get quick answers on the platform.';
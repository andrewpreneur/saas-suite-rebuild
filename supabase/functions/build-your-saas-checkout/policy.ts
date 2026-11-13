import { getBuildYourSaasPackage } from '../_shared/build-your-saas-catalog.ts';

export function checkoutOrigin(value: string | null): string {
  if (!value) return 'https://saassuite.ai';
  const url = new URL(value);
  if (url.origin !== value || !(
    value === 'http://localhost:8080' || value === 'https://saassuite.ai' ||
    value === 'https://saas-suite.lovable.app' ||
    (url.protocol === 'https:' && /^id-preview--[a-z0-9-]+\.lovable\.app$/.test(url.hostname))
  )) throw new Error('Unsupported checkout origin.');
  return value;
}

export function serviceCheckoutParams(packageKey: unknown, origin: string, browserHash: string) {
  const config = getBuildYourSaasPackage(packageKey);
  if (!config) throw new Error('Choose one of the two service packages.');
  return {
    mode: 'payment' as const,
    ui_mode: 'embedded' as const,
    redirect_on_completion: 'if_required' as const,
    adaptive_pricing: { enabled: false },
    line_items: [{ price: config.priceId, quantity: 1 }],
    return_url: `${checkoutOrigin(origin)}/buildyoursaas/thank-you?session_id={CHECKOUT_SESSION_ID}`,
    metadata: { funnel: 'build-your-saas', product: 'ghl_service', package: String(packageKey), browser_hash: browserHash },
    payment_intent_data: { metadata: { funnel: 'build-your-saas', product: 'ghl_service', package: String(packageKey) } },
  };
}

export function isPaidServiceSession(session: { payment_status: string; mode: string | null; currency: string | null; amount_total: number | null; metadata: Record<string, string> | null }) {
  const config = getBuildYourSaasPackage(session.metadata?.package);
  return Boolean(config && session.mode === 'payment' && session.payment_status === 'paid'
    && session.currency === 'usd' && session.amount_total === config.amount
    && session.metadata?.funnel === 'build-your-saas' && session.metadata?.product === 'ghl_service');
}
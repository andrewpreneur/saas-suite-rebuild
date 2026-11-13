import { expect, test } from 'bun:test';
import { BUILD_YOUR_SAAS_PACKAGES, SETUP_SERVICES, LAUNCH_SERVICES } from '../src/config/buildYourSaas';
import { checkoutOrigin, isPaidServiceSession, serviceCheckoutParams } from '../supabase/functions/build-your-saas-checkout/policy';
test('Setup costs exactly $2,500 once and contains all eight requested services', () => {
  expect(BUILD_YOUR_SAAS_PACKAGES.setup.amount).toBe(250000);
  expect(SETUP_SERVICES).toEqual(['SaaS white labeling','SaaS configurator Setup','Webinar Setup','Sales Deck creation','Sales page creation','Automations Setup','Client portal tracking','One account GHL audit']);
});
test('Launch costs exactly $5,000 and includes Setup plus the four launch services', () => {
  expect(BUILD_YOUR_SAAS_PACKAGES.launch.amount).toBe(500000);
  expect(LAUNCH_SERVICES).toEqual(['Ad creative creation','Ads setup in your ad account','Webinar Video Creation','Full GHL audit']);
  expect(BUILD_YOUR_SAAS_PACKAGES.launch.services).toEqual([...SETUP_SERVICES, ...LAUNCH_SERVICES]);
});
test('each checkout uses one fixed price with no upsells and returns only to thank-you', () => {
  for (const key of ['setup','launch'] as const) {
    const params = serviceCheckoutParams(key, 'https://saassuite.ai','hash');
    expect(params.mode).toBe('payment');
    expect(params.line_items).toEqual([{ price: BUILD_YOUR_SAAS_PACKAGES[key].priceId, quantity: 1 }]);
    expect(params.return_url).toBe('https://saassuite.ai/buildyoursaas/thank-you?session_id={CHECKOUT_SESSION_ID}');
  }
  expect(() => serviceCheckoutParams('other','https://saassuite.ai','hash')).toThrow();
});
test('only paid exact-amount service sessions can show a purchase confirmation', () => {
  const session = { payment_status:'paid', mode:'payment',currency:'usd',amount_total:250000,metadata:{package:'setup',funnel:'build-your-saas',product:'ghl_service'} };
  expect(isPaidServiceSession(session)).toBe(true);
  expect(isPaidServiceSession({...session,payment_status:'unpaid'})).toBe(false);
  expect(isPaidServiceSession({...session,amount_total:27})).toBe(false);
  expect(isPaidServiceSession({...session,metadata:{...session.metadata,funnel:'one-feature-kit'}})).toBe(false);
});
test('checkout cannot redirect to an untrusted origin', () => {
  expect(checkoutOrigin('http://localhost:8080')).toBe('http://localhost:8080');
  expect(() => checkoutOrigin('https://attacker.example')).toThrow();
});
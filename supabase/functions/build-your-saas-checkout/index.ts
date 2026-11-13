import Stripe from 'https://esm.sh/stripe@18.5.0';
import { createClient } from 'npm:@supabase/supabase-js@2.57.2';
import { checkoutOrigin, isPaidServiceSession, serviceCheckoutParams } from './policy.ts';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};
const reply = (status: number, body: object) => new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });
async function hash(value: string) {
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(bytes), b => b.toString(16).padStart(2, '0')).join('');
}
Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: cors });
  if (req.method !== 'POST') return reply(405, { error: 'Use POST.' });
  try {
    const body = await req.json();
    const origin = checkoutOrigin(req.headers.get('origin'));
    if (typeof body.browserToken !== 'string' || !/^[a-f0-9]{64}$/.test(body.browserToken)) return reply(400, { error: 'Please restart checkout on this device.' });
    const key = Deno.env.get('STRIPE_SECRET_KEY');
    if (!key) return reply(503, { error: 'Checkout is temporarily unavailable.' });
    const stripe = new Stripe(key, { apiVersion: '2025-08-27.basil' });
    const browserHash = await hash(body.browserToken);
    if (body.action === 'verify') {
      if (typeof body.sessionId !== 'string' || !/^cs_[a-zA-Z0-9_]+$/.test(body.sessionId)) return reply(400, { error: 'Invalid checkout session.' });
      const session = await stripe.checkout.sessions.retrieve(body.sessionId);
      if (session.metadata?.browser_hash !== browserHash || session.metadata?.funnel !== 'build-your-saas') return reply(403, { error: 'Open this confirmation on the device used for checkout.' });
      return reply(200, { paid: isPaidServiceSession(session), package: session.metadata.package });
    }
    if (body.action !== 'create') return reply(400, { error: 'Invalid checkout action.' });
    const params = serviceCheckoutParams(body.package, origin, browserHash);
    let customerId: string | undefined;
    let email: string | undefined;
    const authorization = req.headers.get('Authorization');
    const url = Deno.env.get('SUPABASE_URL');
    const anon = Deno.env.get('SUPABASE_ANON_KEY');
    if (authorization?.startsWith('Bearer ') && url && anon) {
      const client = createClient(url, anon);
      const { data } = await client.auth.getUser(authorization.slice(7));
      email = data.user?.email?.trim().toLowerCase();
    }
    if (email) customerId = (await stripe.customers.list({ email, limit: 1 })).data[0]?.id;
    const session = await stripe.checkout.sessions.create({ ...params, customer: customerId, customer_email: customerId ? undefined : email });
    return reply(200, { clientSecret: session.client_secret, sessionId: session.id });
  } catch (error) {
    console.error('[BUILD-YOUR-SAAS] Checkout failed', error instanceof Error ? error.name : 'Unknown error');
    return reply(400, { error: 'Checkout could not be completed. Please try again or text us.' });
  }
});
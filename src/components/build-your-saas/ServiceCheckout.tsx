import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { prefetchEmbeddedStripe } from '@/components/StripeEmbeddedCheckout';
import { Button } from '@/components/ui/button';
import type { BuildYourSaasPackage } from '@/config/buildYourSaas';

export const SERVICE_BROWSER_KEY = 'ss_build_your_saas_checkout_token';
function browserToken() {
  const existing = sessionStorage.getItem(SERVICE_BROWSER_KEY);
  if (existing) return existing;
  const token = Array.from(crypto.getRandomValues(new Uint8Array(32)), n => n.toString(16).padStart(2, '0')).join('');
  sessionStorage.setItem(SERVICE_BROWSER_KEY, token);
  return token;
}
export default function ServiceCheckout({ packageKey }: { packageKey: BuildYourSaasPackage }) {
  const navigate = useNavigate();
  const sessionId = useRef<string | null>(null);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const [stripe, setStripe] = useState<Awaited<ReturnType<typeof prefetchEmbeddedStripe>>>(null);
  const [ui, setUi] = useState<typeof import('@stripe/react-stripe-js') | null>(null);
  useEffect(() => {
    let active = true;
    Promise.all([prefetchEmbeddedStripe(), import('@stripe/react-stripe-js')]).then(([stripeValue, uiValue]) => {
      if (!active) return;
      if (!stripeValue) throw new Error('Secure checkout is unavailable.');
      setStripe(stripeValue); setUi(uiValue);
    }).catch(() => { if (active) setError('Secure checkout could not load. Please try again.'); });
    return () => { active = false; };
  }, [attempt]);
  const fetchClientSecret = useCallback(async () => {
    try {
      const { data, error: requestError } = await supabase.functions.invoke('build-your-saas-checkout', {
        body: { action: 'create', package: packageKey, browserToken: browserToken() },
      });
      if (requestError || !data?.clientSecret || !data?.sessionId) throw new Error(data?.error || 'Checkout could not load. Please try again.');
      sessionId.current = data.sessionId;
      return String(data.clientSecret);
    } catch (e) { setError(e instanceof Error ? e.message : 'Checkout is unavailable.'); throw e; }
  }, [packageKey]);
  if (error) return <div className="py-8 text-center" role="alert"><p>{error}</p><Button className="mt-4" variant="outline" onClick={() => { setError(''); setAttempt(n => n + 1); }}>Try again</Button></div>;
  if (!stripe || !ui) return <p role="status" className="py-12 text-center text-muted-foreground">Loading secure checkout…</p>;
  return <ui.EmbeddedCheckoutProvider key={`${packageKey}-${attempt}`} stripe={stripe} options={{ fetchClientSecret, onComplete: () => {
    if (sessionId.current) navigate(`/buildyoursaas/thank-you?session_id=${encodeURIComponent(sessionId.current)}`, { replace: true });
  } }}><ui.EmbeddedCheckout /></ui.EmbeddedCheckoutProvider>;
}
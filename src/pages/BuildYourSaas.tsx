import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Check, CheckCircle2, LockKeyhole, MessageCircle, Play, Star } from 'lucide-react';
import { Button } from '@/components/ui/button';
import PageSEO from '@/components/PageSEO';
import { TESTIMONIALS } from '@/components/VideoTestimonialsSection';
import ServiceCheckout, { SERVICE_BROWSER_KEY } from '@/components/build-your-saas/ServiceCheckout';
import { BUILD_YOUR_SAAS_MESSAGE, BUILD_YOUR_SAAS_PACKAGES, LAUNCH_SERVICES, SETUP_SERVICES, type BuildYourSaasPackage } from '@/config/buildYourSaas';
import { supportSmsUrl } from '@/lib/supportContact';
import { supabase } from '@/integrations/supabase/client';

function TextUs() {
  return <Button asChild className="bys-text-button"><a href={supportSmsUrl(BUILD_YOUR_SAAS_MESSAGE)}><MessageCircle className="h-6 w-6 fill-current" /><span>Text us for more info</span></a></Button>;
}
function Services({ items }: { items: readonly string[] }) {
  return <ul className="space-y-3">{items.map(item => <li key={item} className="flex gap-3"><Check className="mt-1 h-4 w-4 shrink-0 text-success" /><span>{item}</span></li>)}</ul>;
}
function CustomerProof() {
  const [playing, setPlaying] = useState<string | null>(null);
  return <section className="bys-proof py-14" id="customers"><div className="mx-auto max-w-6xl px-5">
    <p className="bys-eyebrow text-center">REAL PEOPLE. REAL FEEDBACK.</p><h2 className="mt-3 text-center text-3xl font-bold">You don't have to figure it out alone.</h2>
    <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">{TESTIMONIALS.filter(t => ['ben', 'brentney', 'jess', 'lee'].includes(t.id)).map(t => <figure className="overflow-hidden rounded-lg border border-border bg-card" key={t.id}>
      <div className="relative aspect-[4/3] overflow-hidden bg-muted">
        {playing === t.id ? <video autoPlay controls playsInline className="h-full w-full object-contain" src={`https://assets.cdn.filesafe.space/T69cI1milcirIORef4Ib/media/${t.file}`} /> : <><img src={t.poster} alt={`${t.name}, SaaSSuite customer`} loading="lazy" className="h-full w-full object-cover" /><Button aria-label={`Play testimonial from ${t.name}`} size="icon" className="absolute bottom-3 right-3 rounded-full" onClick={() => setPlaying(t.id)}><Play className="h-5 w-5" /></Button></>}
      </div><figcaption className="p-5"><div className="mb-3 flex gap-1 text-offer" aria-label="5 stars">{Array.from({ length: 5 }, (_, i) => <Star key={i} className="h-3.5 w-3.5 fill-current" />)}</div><blockquote className="text-sm leading-relaxed">“{t.quote}”</blockquote><p className="mt-4 text-sm font-bold">— {t.name}</p></figcaption>
    </figure>)}</div>
  </div></section>;
}
export default function BuildYourSaas() {
  const location = useLocation();
  const navigate = useNavigate();
  const checkout = location.pathname.endsWith('/checkout');
  const thankYou = location.pathname.endsWith('/thank-you');
  const params = new URLSearchParams(location.search);
  const packageKey: BuildYourSaasPackage = params.get('package') === 'launch' ? 'launch' : 'setup';
  const selected = BUILD_YOUR_SAAS_PACKAGES[packageKey];
  const [verification, setVerification] = useState<'loading' | 'paid' | 'pending' | 'error'>('loading');
  const [paidPackage, setPaidPackage] = useState<BuildYourSaasPackage>('setup');
  const [retry, setRetry] = useState(0);
  const sessionId = params.get('session_id');
  useEffect(() => {
    if (!thankYou) return;
    let active = true;
    setVerification('loading');
    const token = sessionStorage.getItem(SERVICE_BROWSER_KEY);
    if (!sessionId || !token) { setVerification('error'); return; }
    supabase.functions.invoke('build-your-saas-checkout', { body: { action: 'verify', sessionId, browserToken: token } }).then(({ data, error }) => {
      if (!active) return;
      setVerification(error ? 'error' : data?.paid ? 'paid' : 'pending');
      if (data?.package === 'setup' || data?.package === 'launch') setPaidPackage(data.package);
    }).catch(() => { if (active) setVerification('error'); });
    return () => { active = false; };
  }, [thankYou, sessionId, retry]);
  const startCheckout = (key: BuildYourSaasPackage) => navigate(`/buildyoursaas/checkout?package=${key}`);
  return <div className="bys-page min-h-screen bg-background text-foreground">
    <PageSEO title="Build Your SaaS — Done-for-You GHL Setup | SaaSSuite" description="GHL is complicated. Get hands-on SaaS setup for $2,500, or setup plus launch creative and ads for $5,000. One-time service packages." path={location.pathname} />
    <div className="bys-strip px-5 py-2 text-center text-xs font-semibold">YOUR GHL AGENCY BUILD PARTNER · ONE-TIME SERVICE PACKAGES</div>
    <header className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-5 py-5"><Link to="/buildyoursaas" className="flex items-center gap-2 text-xl font-bold"><img src="/assets/saassuite-logo.png" alt="SaaSSuite" className="h-9 w-9" />SaaSSuite</Link><TextUs /></header>
    {thankYou ? <main className="mx-auto max-w-2xl px-5 py-20 text-center">
      <CheckCircle2 className="mx-auto h-14 w-14 text-success" /><h1 className="mt-6 text-4xl font-bold">{verification === 'paid' ? "Thank you. Let's build your SaaS." : verification === 'loading' ? 'Confirming your payment…' : verification === 'pending' ? 'Your payment is still processing.' : 'We couldn’t confirm this payment yet.'}</h1>
      <p className="mt-5 text-muted-foreground">{verification === 'paid' ? `Your ${BUILD_YOUR_SAAS_PACKAGES[paidPackage].name} purchase is confirmed. Text us your name and we'll coordinate your project with you.` : 'Keep this page open on the device you used for checkout. You can check again or text us for help.'}</p>
      <div className="mt-8 flex flex-wrap justify-center gap-3"><TextUs />{verification !== 'paid' && verification !== 'loading' && <Button variant="outline" onClick={() => setRetry(n => n + 1)}>Check again</Button>}</div><Button asChild variant="link" className="mt-6"><Link to="/">Back to home</Link></Button>
    </main> : checkout ? <main className="bys-checkout mx-auto grid max-w-6xl gap-8 px-5 py-8 lg:grid-cols-[0.8fr_1.2fr]">
      <aside><Button asChild variant="ghost" className="mb-5"><Link to="/buildyoursaas"><ArrowLeft className="mr-2 h-4 w-4" />Back to packages</Link></Button><p className="bys-eyebrow">YOUR PACKAGE</p><h1 className="mt-3 text-3xl font-bold">{selected.name}</h1><p className="my-5 text-4xl font-bold">${(selected.amount / 100).toLocaleString()} <span className="text-sm font-normal text-muted-foreground">USD · one time</span></p><Services items={selected.services} /><p className="mt-6 text-sm text-muted-foreground">No recurring service fee. HighLevel subscriptions and advertising spend are separate. All fees are non-refundable.</p></aside>
      <section className="min-w-0"><div className="mb-4 flex items-center gap-2 font-semibold"><LockKeyhole className="h-4 w-4" />Secure checkout</div><ServiceCheckout key={packageKey} packageKey={packageKey} /><p className="mt-4 text-center text-xs text-muted-foreground">By purchasing, you agree to our <Link to="/terms" className="underline">Terms</Link> and <Link to="/refunds" className="underline">Refund Policy</Link>.</p></section>
    </main> : <main>
      <section className="mx-auto max-w-6xl px-5 pb-10 pt-7 text-center"><p className="bys-eyebrow">BUILD YOUR SAAS</p><h1 className="mx-auto mt-4 max-w-4xl text-4xl font-extrabold leading-tight sm:text-5xl">GHL IS COMPLICATED -<br /><span className="bys-accent">Let us help</span></h1><p className="mx-auto mt-5 max-w-2xl text-lg text-muted-foreground">Your brand. Your software. Our team getting the setup done.<br className="hidden sm:block" /> From white labeling to your webinar and sales page, we build it with you.</p><div className="mt-6 flex flex-wrap justify-center gap-3"><Button asChild className="bys-buy-button"><a href="#packages">Choose your package<ArrowRight className="ml-2 h-4 w-4" /></a></Button><TextUs /></div>
        <p className="mx-auto mt-6 max-w-xl text-sm text-muted-foreground">“{TESTIMONIALS.find(t => t.id === 'ben')?.quote}” <span className="font-semibold">— Ben</span></p>
      </section>
      <section id="packages" className="mx-auto max-w-5xl px-5 pb-14 pt-4"><div className="grid items-start gap-6 md:grid-cols-2">{(['setup', 'launch'] as const).map(key => {
        const config = BUILD_YOUR_SAAS_PACKAGES[key];
        return <article className={`bys-package rounded-lg border-2 bg-card p-6 sm:p-8 ${key === 'launch' ? 'bys-package-launch' : 'border-border'}`} key={key}><p className="bys-eyebrow">{key === 'setup' ? 'BUILD THE FOUNDATION' : 'BUILD + LAUNCH'}</p><h2 className="mt-3 text-2xl font-bold">{config.name}</h2><p className="mb-1 mt-5 text-5xl font-extrabold">${(config.amount / 100).toLocaleString()}</p><p className="mb-6 text-sm text-muted-foreground">USD · one-time payment</p>{key === 'launch' && <p className="mb-4 font-semibold">Everything in SaaS Setup, plus:</p>}<Services items={key === 'setup' ? SETUP_SERVICES : LAUNCH_SERVICES} /><Button className="bys-buy-button mt-7 w-full" onClick={() => startCheckout(key)}>Choose {config.name}<ArrowRight className="ml-2 h-4 w-4" /></Button><div className="mt-3 flex items-center justify-center gap-2 text-xs text-muted-foreground"><LockKeyhole className="h-3.5 w-3.5" />Secure checkout with Stripe</div></article>;
      })}</div><p className="mt-6 text-center text-xs text-muted-foreground">HighLevel subscriptions, AI usage and ad spend are separate. No income or results are guaranteed. All fees are non-refundable.</p></section>
      <CustomerProof /><section className="px-5 py-14 text-center"><h2 className="text-3xl font-bold">Let's get your GHL working for you.</h2><p className="mb-6 mt-3 text-muted-foreground">Have a question before we start? Send us a text.</p><TextUs /></section>
    </main>}
    <footer className="border-t border-border px-5 py-8 text-center text-xs text-muted-foreground"><div className="mb-4 flex flex-wrap justify-center gap-5"><Link to="/terms">Terms</Link><Link to="/privacy">Privacy</Link><Link to="/refunds">Refund Policy</Link></div><p>© 2026 SaaSSuite · DNA Media Consulting LLC</p><p className="mt-2">Independent of and not endorsed by HighLevel Inc. Customer testimonials describe individual experiences, not guaranteed results.</p></footer>
  </div>;
}
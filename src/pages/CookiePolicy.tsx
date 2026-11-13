import { useEffect, useState } from "react";
import MarketingLayout from "@/components/MarketingLayout";
import PageSEO from "@/components/PageSEO";
import { buildBreadcrumbJsonLd } from "@/lib/seoJsonLd";
import { Button } from "@/components/ui/button";
import { hasOptedOutOfTracking, setTrackingOptOut } from "@/utils/trackingConsent";

const CookiePolicy = () => {
  const [optedOut, setOptedOut] = useState(false);

  useEffect(() => {
    setOptedOut(hasOptedOutOfTracking());
  }, []);

  const toggle = () => {
    const next = !optedOut;
    setTrackingOptOut(next);
    setOptedOut(next);
  };

  return (
    <MarketingLayout>
      <PageSEO
        title="Cookie Policy | SaaSSuite"
        description="Which cookies and tracking technologies SaaSSuite uses, what each one does, and how to turn the optional ones off."
        path="/cookies"
        jsonLd={buildBreadcrumbJsonLd([{ name: "Cookie Policy", path: "/cookies" }])!}
      />
      <div className="max-w-3xl mx-auto px-6 py-16">
        <article className="prose prose-slate max-w-none">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">Cookie Policy</h1>
          <p className="text-gray-600 mb-8">Last updated: September 9, 2026</p>

          <p className="text-gray-700 mb-8">
            This policy explains how SaaSSuite.ai, operated by DNA Media Consulting LLC, uses
            cookies and similar technologies (local storage, session storage, pixels, and beacons)
            on saassuite.ai and inside the SaaSSuite web application.
          </p>

          <section className="mb-10 rounded-xl border border-gray-200 bg-gray-50 p-6 not-prose">
            <h2 className="text-xl font-semibold text-gray-900 mb-2">Your cookie choices</h2>
            <p className="text-gray-700 mb-4 text-sm">
              Optional analytics and advertising cookies are currently{" "}
              <strong>{optedOut ? "off" : "on"}</strong> in this browser. Essential cookies used for
              login and security always stay on.
            </p>
            <Button onClick={toggle} className="min-h-11">
              {optedOut ? "Turn optional cookies back on" : "Turn off optional cookies"}
            </Button>
          </section>

          <section className="mb-10">
            <h2 className="text-2xl font-semibold text-gray-900 mb-3">1. Strictly necessary</h2>
            <ul className="list-disc pl-6 space-y-2 text-gray-700">
              <li>
                <strong>Supabase authentication tokens</strong> (local storage) — keep you signed in
                and protect your account. Removing them signs you out.
              </li>
              <li>
                <strong>Session identifiers</strong> (session storage) — keep app state consistent
                while you browse; cleared when you close the tab.
              </li>
              <li>
                <strong>Consent record</strong> (local storage) — remembers this cookie choice.
              </li>
            </ul>
          </section>

          <section className="mb-10">
            <h2 className="text-2xl font-semibold text-gray-900 mb-3">2. Analytics</h2>
            <ul className="list-disc pl-6 space-y-2 text-gray-700">
              <li>
                <strong>SaaSSuite first-party analytics</strong> — we record page views, referrer,
                approximate device type, and in-app engagement events on our own servers to
                understand which pages and features are used. No third-party advertising network
                receives this data.
              </li>
              <li>
                <strong>PostHog website analytics</strong> — records anonymous page visits,
                navigation, page exits, referrer and device information. Session recordings and
                automatic form or chat capture are disabled. URL query strings and fragments
                are removed before sending. Your optional-cookie choice also controls PostHog.
              </li>
            </ul>
          </section>

          <section className="mb-10">
            <h2 className="text-2xl font-semibold text-gray-900 mb-3">3. Advertising</h2>
            <ul className="list-disc pl-6 space-y-2 text-gray-700">
              <li>
                <strong>LSPXL advertising pixel</strong> — the script hosted at px.lspxl.com
                loads only after explicit advertising acceptance, including on later visits.
                Loading it shares request information such as your IP address and browser details
                with that service. Rejecting advertising or your browser’s Global Privacy Control
                blocks it. Withdraw permission through Cookie settings; the page reloads to stop
                the already-loaded script. Its additional data collection is controlled by the provider.
              </li>
              <li>
                <strong>Meta Pixel</strong> (Facebook/Instagram ads) — measures which ads lead to
                signups and purchases. Sets Meta's <code>_fbp</code> cookie and stores a click
                identifier (<code>fbclid</code>). We also send matching conversion events to Meta
                from our server so a single signup is not counted twice.
              </li>
              <li>
                <strong>Affiliate attribution</strong> (Lynkific / LeadConnector) — records which
                affiliate referred you so commissions can be paid.
              </li>
              <li>
                <strong>Campaign parameters</strong> (UTM values, <code>gclid</code>) — stored in
                your browser so we can attribute a signup to the campaign that brought you here.
              </li>
            </ul>
          </section>

          <section className="mb-10">
            <h2 className="text-2xl font-semibold text-gray-900 mb-3">4. Third-party embeds</h2>
            <p className="text-gray-700">
              Some pages embed services that set their own cookies when loaded: Stripe (checkout and
              fraud prevention), HighLevel / LeadConnector (forms, booking calendars, review
              widgets), WebinarKit (webinar playback), Fanbasis (alternative checkout), and video
              hosts used for lessons and testimonials. Those cookies are controlled by those
              providers under their own privacy policies.
            </p>
          </section>

          <section className="mb-10">
            <h2 className="text-2xl font-semibold text-gray-900 mb-3">5. Managing cookies</h2>
            <p className="text-gray-700">
              Use the switch above to turn off analytics and advertising cookies for this browser.
              You can also block or delete cookies in your browser settings, and most browsers
              support a "Do Not Track" or global privacy control signal. Blocking essential cookies
              will prevent you from signing in.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mb-3">6. Contact</h2>
            <p className="text-gray-700">
              Questions about this policy: DNA Media Consulting LLC, 5830 E 2nd St, Casper, WY 82609,
              United States —{" "}
              <a href="mailto:andrew@dna-media.net" className="text-primary hover:underline">
                andrew@dna-media.net
              </a>
              .
            </p>
          </section>
        </article>
      </div>
    </MarketingLayout>
  );
};

export default CookiePolicy;

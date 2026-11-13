import MarketingLayout from "@/components/MarketingLayout";
import PageSEO from "@/components/PageSEO";
import { buildBreadcrumbJsonLd } from "@/lib/seoJsonLd";

const Refunds = () => {
  return (
    <MarketingLayout>
      <PageSEO
        title="Refund & Cancellation Policy | SaaSSuite"
        description="SaaSSuite's refund and cancellation policy: how billing works, how to cancel, and what happens to your data."
        path="/refunds"
        jsonLd={buildBreadcrumbJsonLd([{ name: "Refund Policy", path: "/refunds" }])!}
      />
      <div className="max-w-3xl mx-auto px-6 py-16">
        <article className="prose prose-slate max-w-none">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">Refund &amp; Cancellation Policy</h1>
          <p className="text-gray-600 mb-8">Last updated: September 9, 2026</p>

          <section className="mb-10">
            <h2 className="text-2xl font-semibold text-gray-900 mb-3">1. All fees are non-refundable</h2>
            <p className="text-gray-700 mb-4">
              Subscription fees, add-on fees, one-time purchases, and course purchases are{" "}
              <strong>non-refundable</strong>, including for partial billing periods and for periods
              in which you did not use the service. We do not offer a money-back guarantee or a free
              trial period unless a specific written offer says otherwise for that offer.
            </p>
            <p className="text-gray-700">
              This does not limit rights you have under laws that cannot be waived — see section 5.
            </p>
          </section>

          <section className="mb-10">
            <h2 className="text-2xl font-semibold text-gray-900 mb-3">2. How billing works</h2>
            <ul className="list-disc pl-6 space-y-2 text-gray-700">
              <li>Subscriptions renew automatically at the interval and price shown at checkout.</li>
              <li>
                The price at checkout is the total you pay. There are no setup fees or hidden charges;
                any optional add-on (for example additional onboarding calls or agency-support seats)
                is priced and confirmed before you buy it.
              </li>
              <li>Taxes, if applicable to your location, are shown at checkout.</li>
              <li>
                If a payment fails we keep your account open for a short grace period and email you
                to update your card. Access reduces to the entry tier until payment succeeds.
              </li>
            </ul>
          </section>

          <section className="mb-10">
            <h2 className="text-2xl font-semibold text-gray-900 mb-3">3. Cancelling</h2>
            <ul className="list-disc pl-6 space-y-2 text-gray-700">
              <li>
                You can cancel at any time from Billing inside the app, which opens the Stripe
                customer portal, or by emailing us. No phone call or retention conversation is
                required.
              </li>
              <li>
                Cancellation takes effect at the end of the current billing period. You keep access
                until then and are not billed again.
              </li>
              <li>
                On cancellation, stored configuration — branding, custom URLs, onboarding portals,
                and settings — may be permanently deleted and cannot be recovered. Export anything
                you need first.
              </li>
            </ul>
          </section>

          <section className="mb-10">
            <h2 className="text-2xl font-semibold text-gray-900 mb-3">4. Billing errors and duplicates</h2>
            <p className="text-gray-700">
              If you were charged twice for the same period, charged after a confirmed cancellation,
              or charged an amount that does not match what you agreed to at checkout, contact us
              within 60 days of the charge and we will correct it.
            </p>
          </section>

          <section className="mb-10">
            <h2 className="text-2xl font-semibold text-gray-900 mb-3">5. Mandatory legal rights</h2>
            <p className="text-gray-700">
              Some jurisdictions give consumers statutory cancellation or refund rights that cannot
              be contracted away (for example certain EU/UK distance-selling and cooling-off rules,
              or state consumer-protection laws). Nothing in this policy removes those rights. If a
              non-waivable right applies to you, tell us and we will honour it.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mb-3">6. Contact</h2>
            <p className="text-gray-700">
              DNA Media Consulting LLC, 5830 E 2nd St, Casper, WY 82609, United States —{" "}
              <a href="mailto:andrew@dna-media.net" className="text-primary hover:underline">
                andrew@dna-media.net
              </a>{" "}
              or{" "}
              <a href="mailto:support@saassuite.ai" className="text-primary hover:underline">
                support@saassuite.ai
              </a>
              .
            </p>
          </section>
        </article>
      </div>
    </MarketingLayout>
  );
};

export default Refunds;

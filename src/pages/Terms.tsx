import { TextUsLink } from "@/components/TextUsLink";
import MarketingLayout from "@/components/MarketingLayout";
import PageSEO from "@/components/PageSEO";
import { buildBreadcrumbJsonLd } from "@/lib/seoJsonLd";

const Terms = () => {
  return (
    <MarketingLayout>
      <PageSEO
        title="Terms and Conditions | SaaSSuite"
        description="The terms governing your use of SaaSSuite's white-label tools and services for HighLevel agencies."
        path="/terms"
        jsonLd={buildBreadcrumbJsonLd([{ name: "Terms and Conditions", path: "/terms" }])!}
      />
      <div className="max-w-3xl mx-auto px-6 py-16">
        <article className="prose prose-slate max-w-none">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">Terms and Conditions</h1>
          <p className="text-gray-600 mb-8">Last updated: September 9, 2026</p>

          <p className="text-gray-700 mb-8">
            These terms are an agreement between you and DNA Media Consulting LLC, a Wyoming limited
            liability company, 5830 E 2nd St, Casper, WY 82609, United States ("SaaSSuite", "we"),
            covering saassuite.ai and the SaaSSuite web application (the "Service"). By creating an
            account or using the Service you accept these terms. If you do not agree, do not use the
            Service.
          </p>

          <section className="mb-10">
            <h2 className="text-2xl font-semibold text-gray-900 mb-3">1. Eligibility and accounts</h2>
            <ul className="list-disc pl-6 space-y-2 text-gray-700">
              <li>You must be at least 18 and using the Service for business purposes.</li>
              <li>Provide accurate account information and keep it current.</li>
              <li>
                You are responsible for your login credentials and for everything done under your
                account, including by team members and admins you invite.
              </li>
            </ul>
          </section>

          <section className="mb-10">
            <h2 className="text-2xl font-semibold text-gray-900 mb-3">2. Subscriptions, pricing, and payment</h2>
            <ul className="list-disc pl-6 space-y-2 text-gray-700">
              <li>
                The Service is sold on a recurring subscription. By subscribing you authorise us and
                our payment processor to charge your payment method at the interval and price shown
                at checkout until you cancel.
              </li>
              <li>
                The checkout total is the full amount you pay for that period. We do not add setup,
                onboarding, or cancellation fees. Optional add-ons are priced and confirmed
                separately before purchase.
              </li>
              <li>Applicable taxes are shown at checkout and added to the total.</li>
              <li>
                We may change prices with at least 30 days' notice by email; changes apply to the
                next renewal, and you may cancel before it takes effect.
              </li>
              <li>
                If a payment fails, access is reduced to the entry tier during a short grace period
                while we contact you. Persistent non-payment ends access.
              </li>
            </ul>
          </section>

          <section className="mb-10">
            <h2 className="text-2xl font-semibold text-gray-900 mb-3">3. Refunds and cancellation</h2>
            <p className="text-gray-700">
              All fees are non-refundable, including for partial periods. You may cancel at any time
              from Billing in the app; access continues to the end of the paid period. Cancellation
              may permanently delete stored configuration. Full details are in our{" "}
              <a href="/refunds" className="text-primary hover:underline">
                Refund &amp; Cancellation Policy
              </a>
              , which forms part of these terms. Nothing here removes consumer rights that cannot be
              waived under the law that applies to you.
            </p>
          </section>

          <section className="mb-10">
            <h2 className="text-2xl font-semibold text-gray-900 mb-3">4. Your content and licence</h2>
            <ul className="list-disc pl-6 space-y-2 text-gray-700">
              <li>
                You keep ownership of the logos, copy, videos, and other content you upload. You grant
                us a limited licence to host, process, and display it solely to operate the Service
                for you.
              </li>
              <li>
                You confirm you have the rights to everything you upload, including any trademarks,
                fonts, images, and music, and that it does not infringe anyone's rights or break the
                law.
              </li>
              <li>
                We may remove content that is unlawful, infringing, or that puts the Service at risk.
              </li>
            </ul>
          </section>

          <section className="mb-10">
            <h2 className="text-2xl font-semibold text-gray-900 mb-3">5. Our intellectual property</h2>
            <ul className="list-disc pl-6 space-y-2 text-gray-700">
              <li>
                The Service, its software, templates, course material, and designs are owned by DNA
                Media Consulting LLC and licensed to you, not sold.
              </li>
              <li>
                You may not copy, resell, sublicense, reverse-engineer, or scrape the Service or its
                content except as these terms allow. You may use the tools to deliver services to
                your own clients under your own brand.
              </li>
              <li>
                "SaaSSuite" and our logo are our marks. Third-party names such as HighLevel,
                GoHighLevel, Stripe, Slack, and Meta belong to their owners and are used only to
                describe compatibility. We are not affiliated with, endorsed by, or sponsored by
                HighLevel.
              </li>
            </ul>
          </section>

          <section className="mb-10">
            <h2 className="text-2xl font-semibold text-gray-900 mb-3">6. Acceptable use</h2>
            <p className="text-gray-700 mb-2">You agree not to:</p>
            <ul className="list-disc pl-6 space-y-2 text-gray-700">
              <li>use the Service unlawfully or to send unsolicited or deceptive messages;</li>
              <li>upload malware or attempt unauthorised access to our systems or other accounts;</li>
              <li>misrepresent your identity, your results, or your relationship with us;</li>
              <li>share one account across separate businesses to avoid plan limits.</li>
            </ul>
          </section>

          <section className="mb-10">
            <h2 className="text-2xl font-semibold text-gray-900 mb-3">7. Your clients and data protection</h2>
            <p className="text-gray-700">
              If you use the Service to onboard or support your own clients, you are the controller of
              their personal data and we process it on your behalf under our{" "}
              <a href="/privacy" className="text-primary hover:underline">
                Privacy Policy
              </a>
              . You are responsible for having a lawful basis, your own privacy notice, and any
              consents required from those clients.
            </p>
          </section>

          <section className="mb-10">
            <h2 className="text-2xl font-semibold text-gray-900 mb-3">8. No results guarantee</h2>
            <p className="text-gray-700">
              We provide software, templates, and education. We do not guarantee revenue, client
              acquisition, retention, or any other business outcome. Any example, testimonial, or
              case study describes that person's experience and is not a promise of your results.
            </p>
          </section>

          <section className="mb-10">
            <h2 className="text-2xl font-semibold text-gray-900 mb-3">9. Third-party services</h2>
            <p className="text-gray-700">
              The Service integrates with platforms we do not control, including HighLevel, Stripe,
              Slack, and Meta. Their availability, changes, and terms are their own. If a third party
              changes or discontinues a feature we rely on, our related functionality may change.
            </p>
          </section>

          <section className="mb-10">
            <h2 className="text-2xl font-semibold text-gray-900 mb-3">10. Availability and support</h2>
            <p className="text-gray-700">
              We aim for continuous availability but do not promise uninterrupted service, and we may
              perform maintenance or modify features. We may suspend or discontinue the Service, in
              whole or part, with reasonable notice.
            </p>
          </section>

          <section className="mb-10">
            <h2 className="text-2xl font-semibold text-gray-900 mb-3">11. Disclaimers</h2>
            <p className="text-gray-700">
              Except as expressly stated, the Service is provided "as is" and "as available" without
              warranties of any kind, including merchantability, fitness for a particular purpose, and
              non-infringement. Some jurisdictions do not allow these exclusions, in which case they
              apply to the extent permitted.
            </p>
          </section>

          <section className="mb-10">
            <h2 className="text-2xl font-semibold text-gray-900 mb-3">12. Limitation of liability</h2>
            <p className="text-gray-700">
              To the maximum extent permitted by law, we are not liable for indirect, incidental,
              special, consequential, or punitive damages, or for lost profits, revenue, goodwill, or
              data. Our total liability for any claim is limited to the amount you paid us in the
              three months before the event giving rise to the claim. Nothing here limits liability
              that cannot be limited by law.
            </p>
          </section>

          <section className="mb-10">
            <h2 className="text-2xl font-semibold text-gray-900 mb-3">13. Indemnity</h2>
            <p className="text-gray-700">
              You will defend and indemnify us against claims arising from your use of the Service,
              your content, your customisations, your dealings with your own clients, or your breach
              of these terms.
            </p>
          </section>

          <section className="mb-10">
            <h2 className="text-2xl font-semibold text-gray-900 mb-3">14. Termination</h2>
            <p className="text-gray-700">
              You may stop using the Service and cancel at any time. We may suspend or terminate your
              account for breach of these terms, non-payment, or misuse, with notice where practical.
              Sections that by nature survive termination continue to apply.
            </p>
          </section>

          <section className="mb-10">
            <h2 className="text-2xl font-semibold text-gray-900 mb-3">15. Governing law and disputes</h2>
            <p className="text-gray-700">
              These terms are governed by the laws of the State of Wyoming, United States, without
              regard to conflict-of-law rules. Disputes will be brought in the state or federal courts
              located in Natrona County, Wyoming, and both parties consent to that venue. If you are a
              consumer resident elsewhere, you may have the right to bring proceedings in your own
              courts under local law.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mb-3">16. Changes and contact</h2>
            <p className="text-gray-700">
              We may update these terms; material changes will be posted here and notified by email or
              in-app notice, and continued use after they take effect means acceptance. Contact: DNA
              Media Consulting LLC, 5830 E 2nd St, Casper, WY 82609, United States —{" "}
              <a href="mailto:andrew@dna-media.net" className="text-primary hover:underline">
                andrew@dna-media.net
              </a>
              , <TextUsLink variant="inline" icon={false} className="font-normal text-primary">Text Us</TextUsLink>.
            </p>
          </section>
        </article>
      </div>
    </MarketingLayout>
  );
};

export default Terms;

import { TextUsLink } from "@/components/TextUsLink";
import MarketingLayout from "@/components/MarketingLayout";
import PageSEO from "@/components/PageSEO";
import { buildBreadcrumbJsonLd } from "@/lib/seoJsonLd";

const Privacy = () => {
  return (
    <MarketingLayout>
      <PageSEO
        title="Privacy Policy | SaaSSuite"
        description="How SaaSSuite collects, uses, shares, and protects personal data for HighLevel agencies and their clients, and the rights you have over your data."
        path="/privacy"
        jsonLd={buildBreadcrumbJsonLd([{ name: "Privacy Policy", path: "/privacy" }])!}
      />
      <div className="max-w-3xl mx-auto px-6 py-16">
        <article className="prose prose-slate max-w-none">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">Privacy Policy</h1>
          <p className="text-gray-600 mb-8">Last updated: September 9, 2026</p>

          <p className="text-gray-700 mb-8">
            SaaSSuite.ai is operated by DNA Media Consulting LLC ("SaaSSuite", "we", "us"), 5830 E
            2nd St, Casper, WY 82609, United States. This policy explains what personal data we
            collect, why we collect it, who we share it with, and the choices you have. We collect
            only what we need to run the service, bill it, support it, and measure our own marketing.
          </p>

          <section className="mb-10">
            <h2 className="text-2xl font-semibold text-gray-900 mb-3">1. Data we collect</h2>
            <ul className="list-disc pl-6 space-y-2 text-gray-700">
              <li>
                <strong>Account data:</strong> name, email address, agency name, plan, and the
                settings you configure. Passwords are stored as salted hashes by our authentication
                provider — we never see them.
              </li>
              <li>
                <strong>Billing data:</strong> subscription status, plan, invoices, and the last four
                digits and brand of your card. Full card numbers go directly to Stripe; we never
                receive or store them.
              </li>
              <li>
                <strong>Support data:</strong> tickets, chat messages, and any files you attach.
              </li>
              <li>
                <strong>Usage data:</strong> pages viewed, features used, logins, approximate device
                and browser type, IP address, referrer, and campaign parameters.
              </li>
              <li>
                <strong>Customer content:</strong> logos, colors, copy, videos, and configuration you
                upload to build your white-label portal.
              </li>
              <li>
                <strong>Your clients' data:</strong> if you invite your own clients into a portal we
                host, we process their name, email, login activity, progress, and support messages on
                your behalf.
              </li>
            </ul>
            <p className="text-gray-700 mt-4">
              We do not ask for and do not want government identifiers, financial account numbers,
              health data, biometric data, precise geolocation, or data about children.
            </p>
          </section>

          <section className="mb-10">
            <h2 className="text-2xl font-semibold text-gray-900 mb-3">2. Why we use it</h2>
            <ul className="list-disc pl-6 space-y-2 text-gray-700">
              <li>To create and operate your account and portals (performance of our contract).</li>
              <li>To take payment and manage subscriptions (contract).</li>
              <li>To answer support requests and send service notices (contract).</li>
              <li>
                To keep the service secure, prevent fraud and abuse, and meet legal and accounting
                obligations (legal obligation and legitimate interests).
              </li>
              <li>
                To measure how our own website and marketing perform, and to send product emails you
                can unsubscribe from (legitimate interests, or consent where required).
              </li>
            </ul>
            <p className="text-gray-700 mt-4">
              We do not sell personal information, and we do not share it for cross-context
              behavioural advertising beyond the advertising measurement described in section 4.
            </p>
          </section>

          <section className="mb-10">
            <h2 className="text-2xl font-semibold text-gray-900 mb-3">3. AI features</h2>
            <p className="text-gray-700">
              Parts of the product use AI models to draft emails, answer support questions, and
              summarise activity. Content you submit to those features (and the knowledge base you
              provide) is sent to our model providers to generate the response. We do not permit
              those providers to use your content to train their models, and we do not feed one
              customer's data into another customer's assistant.
            </p>
          </section>

          <section className="mb-10">
            <h2 className="text-2xl font-semibold text-gray-900 mb-3">4. Processors and third parties</h2>
            <p className="text-gray-700 mb-4">
              We share data only with providers that help us deliver the service, under contract and
              limited to what they need:
            </p>
            <ul className="list-disc pl-6 space-y-2 text-gray-700">
              <li>
                <strong>Supabase</strong> — database, authentication, file storage, and server
                functions.
              </li>
              <li>
                <strong>Stripe</strong> — payments, subscriptions, and the billing portal.
              </li>
              <li>
                <strong>Fanbasis</strong> — alternative checkout on certain offers.
              </li>
              <li>
                <strong>HighLevel / LeadConnector</strong> — transactional and marketing email,
                forms, booking calendars, and review widgets.
              </li>
              <li>
                <strong>Meta (Facebook)</strong> — advertising measurement via the Meta Pixel and
                matching server-side conversion events (email is transmitted hashed).
              </li>
              <li>
                <strong>Slack</strong> — only if you choose to connect a workspace.
              </li>
              <li>
                <strong>LSPXL (px.lspxl.com)</strong> — a sitewide advertising pixel for marketing
                measurement, loaded only after explicit advertising acceptance. Loading shares
                request information, including IP address and browser details, with the provider.
                Its additional collection has not been independently verified. You can withdraw
                permission in Cookie settings; Global Privacy Control blocks this pixel.
              </li>
              <li>
                <strong>AI model providers</strong> — for the features described in section 3.
              </li>
              <li>
                <strong>WebinarKit and video hosts</strong> — webinar and lesson playback.
              </li>
            </ul>
            <p className="text-gray-700 mt-4">
              We may also disclose data if required by law, to enforce our terms, or in connection
              with a merger or sale of the business (you will be notified).
            </p>
          </section>

          <section className="mb-10">
            <h2 className="text-2xl font-semibold text-gray-900 mb-3">5. Cookies and tracking</h2>
            <p className="text-gray-700">
              Essential cookies keep you signed in. Cookie choices are managed through the Ospry consent banner. Other existing optional tools are on by
              default and can be switched off at any time from our{" "}
              <a href="/cookies" className="text-primary hover:underline">
                Cookie Policy
              </a>
              , which lists every cookie and pixel we use.
            </p>
          </section>

          <section className="mb-10">
            <h2 className="text-2xl font-semibold text-gray-900 mb-3">6. Retention and deletion</h2>
            <ul className="list-disc pl-6 space-y-2 text-gray-700">
              <li>Account and content data is kept while your account is active.</li>
              <li>
                After cancellation, configuration such as branding, custom URLs, and portal settings
                may be deleted permanently and cannot be recovered.
              </li>
              <li>
                Analytics events are retained in aggregate; billing and tax records are kept as long
                as law requires (typically seven years).
              </li>
              <li>
                You can ask us to delete your account and data at any time by emailing us, and the
                app includes an account-deletion request path.
              </li>
            </ul>
          </section>

          <section className="mb-10">
            <h2 className="text-2xl font-semibold text-gray-900 mb-3">7. Your rights</h2>
            <p className="text-gray-700 mb-4">
              Depending on where you live you may have the right to access, correct, delete, port, or
              restrict processing of your personal data, to object to processing based on legitimate
              interests, to opt out of targeted advertising and any sale or sharing of personal
              information, and to withdraw consent. California residents additionally have the right
              not to be discriminated against for exercising these rights. EU, UK, and Swiss
              residents may lodge a complaint with their local data protection authority.
            </p>
            <p className="text-gray-700">
              To exercise a right, email{" "}
              <a href="mailto:andrew@dna-media.net" className="text-primary hover:underline">
                andrew@dna-media.net
              </a>
              . We respond within 30 days and may need to verify your identity. Requests are free
              unless excessive.
            </p>
          </section>

          <section className="mb-10">
            <h2 className="text-2xl font-semibold text-gray-900 mb-3">8. International transfers</h2>
            <p className="text-gray-700">
              We operate from the United States and our providers may process data in the US and
              other countries. Where we transfer personal data out of the EEA, UK, or Switzerland we
              rely on the European Commission's Standard Contractual Clauses or another lawful
              transfer mechanism offered by the provider.
            </p>
          </section>

          <section className="mb-10">
            <h2 className="text-2xl font-semibold text-gray-900 mb-3">9. Agencies as controllers</h2>
            <p className="text-gray-700">
              When you use SaaSSuite to onboard and support your own clients, you decide what data
              you collect from them and you are the controller of that data; we act as your
              processor. You are responsible for having a lawful basis and your own privacy notice
              for those clients, and for the accessibility and content of any customisations you
              publish.
            </p>
          </section>

          <section className="mb-10">
            <h2 className="text-2xl font-semibold text-gray-900 mb-3">10. Security</h2>
            <p className="text-gray-700">
              We use encryption in transit, row-level access controls in the database, scoped access
              tokens, and role-based admin access. No system is perfectly secure; if a breach affects
              your personal data we will notify you and any regulator as required by law.
            </p>
          </section>

          <section className="mb-10">
            <h2 className="text-2xl font-semibold text-gray-900 mb-3">11. Children</h2>
            <p className="text-gray-700">
              The service is for business use by adults. We do not knowingly collect data from anyone
              under 18. If you believe a minor has given us data, email us and we will delete it.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mb-3">12. Changes and contact</h2>
            <p className="text-gray-700">
              We will post updates here and, for material changes, notify you by email or in-app
              notice. Contact: DNA Media Consulting LLC, 5830 E 2nd St, Casper, WY 82609, United
              States —{" "}
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

export default Privacy;

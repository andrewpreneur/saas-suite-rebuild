import MarketingLayout from "@/components/MarketingLayout";
import PageSEO from "@/components/PageSEO";
import { buildBreadcrumbJsonLd } from "@/lib/seoJsonLd";

const Accessibility = () => {
  return (
    <MarketingLayout>
      <PageSEO
        title="Accessibility Statement — SaaSSuite"
        description="SaaSSuite's commitment to making our white-label HighLevel platform usable for everyone. Read about our accessibility practices and how to report barriers."
        path="/accessibility"
        jsonLd={buildBreadcrumbJsonLd([{ name: "Accessibility", path: "/accessibility" }])!}
      />
      <div className="max-w-3xl mx-auto px-6 py-16">
        <article className="prose prose-slate max-w-none">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">Accessibility Statement</h1>
          <p className="text-gray-600 mb-8">
            This page is maintained by SaaSSuite to explain how we approach accessibility for our
            website and platform. We welcome feedback and are committed to removing barriers as we
            identify them.
          </p>

          <section className="mb-10">
            <h2 className="text-2xl font-semibold text-gray-900 mb-3">Our commitment</h2>
            <p className="text-gray-700 mb-4">
              SaaSSuite aims to make its website and white-label HighLevel tools usable by as many
              people as possible. We consider accessibility during design and development, and we
              regularly review pages and components for common issues such as missing labels,
              low-contrast text, keyboard traps, and unclear focus indicators.
            </p>
            <p className="text-gray-700">
              We do not claim third-party certification or a specific conformance level on behalf of
              any external body. This statement describes the practices we follow today and the
              areas we are actively improving.
            </p>
          </section>

          <section className="mb-10">
            <h2 className="text-2xl font-semibold text-gray-900 mb-3">What we focus on</h2>
            <ul className="list-disc pl-6 space-y-2 text-gray-700">
              <li>
                <strong>Keyboard navigation:</strong> Core pages, dialogs, forms, and menus are built
                to be operable with a keyboard.
              </li>
              <li>
                <strong>Screen-reader support:</strong> We use semantic HTML, ARIA labels on icon-only
                controls, and descriptive link text where appropriate.
              </li>
              <li>
                <strong>Color and contrast:</strong> We use a semantic color system and avoid relying
                on color alone to communicate status or meaning.
              </li>
              <li>
                <strong>Responsive layouts:</strong> Pages are designed to work across desktop,
                tablet, and mobile viewports.
              </li>
              <li>
                <strong>Focus management:</strong> Interactive elements use visible focus indicators
                and logical tab order.
              </li>
            </ul>
          </section>

          <section className="mb-10">
            <h2 className="text-2xl font-semibold text-gray-900 mb-3">Known limitations</h2>
            <p className="text-gray-700 mb-4">
              Some parts of the platform embed third-party content or scripts (for example, checkout
              widgets, webinar players, calendar schedulers, and customer-provided branding
              customizations). We do not control the accessibility of that embedded content, and it
              may not meet the same standards as the rest of the site.
            </p>
            <p className="text-gray-700">
              Customers who apply custom CSS, colors, fonts, or uploaded media through the
              white-label tools are responsible for the accessibility of those customizations.
            </p>
          </section>

          <section className="mb-10">
            <h2 className="text-2xl font-semibold text-gray-900 mb-3">How to report an issue</h2>
            <p className="text-gray-700 mb-4">
              If you encounter a barrier while using SaaSSuite, please let us know. Include the page
              URL, a description of the issue, and the browser or assistive technology you were
              using.
            </p>
            <p className="text-gray-700">
              Email us at{" "}
              <a
                href="mailto:support@saassuite.ai"
                className="text-primary hover:underline font-medium"
              >
                support@saassuite.ai
              </a>{" "}
              or book a call through{" "}
              <a
                href="https://saassuite.ai/book"
                target="_blank"
                rel="noreferrer"
                className="text-primary hover:underline font-medium"
              >
                saassuite.ai/book
              </a>
              .
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mb-3">Scope and updates</h2>
            <p className="text-gray-700 mb-4">
              This statement applies to the public marketing website and the SaaSSuite web
              application. It was last reviewed on July 30, 2026.
            </p>
            <p className="text-gray-700">
              Accessibility is an ongoing effort. We update this page as our practices and platform
              evolve.
            </p>
          </section>
        </article>
      </div>
    </MarketingLayout>
  );
};

export default Accessibility;

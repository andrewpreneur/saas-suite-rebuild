import { useParams, Link, Navigate } from "react-router-dom";
import PageSEO from "@/components/PageSEO";
import { useStripStaticSeo } from "@/hooks/useStripStaticSeo";
import { NICHE_PAGES } from "@/config/landingPages";
import { SITE_URL, buildBreadcrumbJsonLd, buildFaqJsonLd } from "@/lib/blog";
import { Button } from "@/components/ui/button";
import MarketingLayout from "@/components/MarketingLayout";
import { ChevronLeft } from "lucide-react";

const NichePage = () => {
  const { niche } = useParams<{ niche: string }>();
  useStripStaticSeo(niche);
  const data = NICHE_PAGES.find((p) => p.slug === niche);
  if (!data) return <Navigate to="/" replace />;

  const url = `${SITE_URL}/for/${data.slug}`;
  const jsonLd = [
    buildBreadcrumbJsonLd([
      { name: "For", url: `${SITE_URL}/for` },
      { name: data.niche, url },
    ]),
    buildFaqJsonLd(data.faq),
  ].filter(Boolean);

  return (
    <MarketingLayout>
      <PageSEO
        title={data.headline}
        description={data.subheadline}
        path={`/for/${data.slug}`}
        jsonLd={jsonLd as Record<string, unknown>[]}
      />

      <article className="max-w-3xl mx-auto px-6 py-12">
        <Link
          to="/blog"
          className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-6"
        >
          <ChevronLeft className="w-4 h-4 mr-1" /> Back to blog
        </Link>

        <p className="text-sm font-medium text-primary mb-3">
          SaaSSuite for {data.niche}
        </p>
        <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-4">
          {data.headline}
        </h1>
        <p className="text-lg text-muted-foreground mb-10">
          {data.subheadline}
        </p>

        <div className="prose prose-neutral max-w-none">
          <h2>Built for {data.niche} agencies</h2>
          {data.useCases.map((u) => (
            <div key={u.title}>
              <h3>{u.title}</h3>
              <p>{u.body}</p>
            </div>
          ))}

          {data.faq.length > 0 && (
            <>
              <h2>Frequently asked questions</h2>
              {data.faq.map((f, i) => (
                <div key={i}>
                  <h3>{f.question}</h3>
                  <p>{f.answer}</p>
                </div>
              ))}
            </>
          )}
        </div>

        <div className="mt-16 rounded-xl border p-8 bg-gradient-to-br from-primary/10 to-primary/5 text-center">
          <h2 className="text-2xl font-bold mb-2">
            Ready to white-label your HighLevel SaaS?
          </h2>
          <p className="text-muted-foreground mb-4">
            SaaSSuite gives HighLevel agencies onboarding, AI support, branding,
            and retention — in one platform.
          </p>
          <Button asChild size="lg">
            <Link to="/pricing">See pricing</Link>
          </Button>
        </div>
      </article>
    </MarketingLayout>
  );
};

export default NichePage;
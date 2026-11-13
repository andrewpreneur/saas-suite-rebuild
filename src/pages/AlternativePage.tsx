import { useParams, Link, Navigate } from "react-router-dom";
import PageSEO from "@/components/PageSEO";
import { useStripStaticSeo } from "@/hooks/useStripStaticSeo";
import { ALTERNATIVE_PAGES, SAASSUITE_FEATURE_GROUPS } from "@/config/landingPages";
import { SITE_URL, buildBreadcrumbJsonLd, buildFaqJsonLd } from "@/lib/blog";
import { Button } from "@/components/ui/button";
import MarketingLayout from "@/components/MarketingLayout";
import { navigateWithParams } from "@/utils/preserveParams";
import { ChevronLeft, Check, X, ArrowRight } from "lucide-react";

const AlternativePage = () => {
  const { competitor } = useParams<{ competitor: string }>();
  useStripStaticSeo(competitor);
  const data = ALTERNATIVE_PAGES.find((p) => p.slug === competitor);
  if (!data) return <Navigate to="/" replace />;

  const url = `${SITE_URL}/alternatives/${data.slug}`;
  const description = data.subheadline;
  const signupHref = navigateWithParams("/signup");
  const featureGroups = data.featureGroups ?? SAASSUITE_FEATURE_GROUPS;
  const jsonLd = [
    buildBreadcrumbJsonLd([
      { name: "Alternatives", url: `${SITE_URL}/alternatives` },
      { name: data.competitor, url },
    ]),
    buildFaqJsonLd(data.faq),
  ].filter(Boolean);

  return (
    <MarketingLayout>
      <PageSEO
        title={data.headline}
        description={description}
        path={`/alternatives/${data.slug}`}
        jsonLd={jsonLd as Record<string, unknown>[]}
      />

      <article className="max-w-4xl mx-auto px-6 py-12">
        <Link
          to="/blog"
          className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-6"
        >
          <ChevronLeft className="w-4 h-4 mr-1" /> Back to blog
        </Link>

        <p className="text-sm font-medium text-primary mb-3">
          Alternative to {data.competitor}
        </p>
        <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-4">
          {data.headline}
        </h1>
        <p className="text-lg text-muted-foreground mb-6">
          {data.subheadline}
        </p>

        {data.eyebrow && (
          <p className="inline-flex items-center rounded-full border border-primary/30 bg-primary/10 px-4 py-1.5 text-sm font-medium text-primary mb-8">
            {data.eyebrow}
          </p>
        )}

        <div className="flex flex-col sm:flex-row gap-3 mb-14">
          <Button asChild size="lg">
            <a href={signupHref}>
              Create your free account <ArrowRight className="ml-2 h-4 w-4" />
            </a>
          </Button>
          <Button asChild size="lg" variant="outline">
            <Link to="/pricing">See pricing</Link>
          </Button>
        </div>

        {data.painPoints && data.painPoints.length > 0 && (
          <section className="mb-14">
            <h2 className="text-2xl font-bold mb-4">
              What agencies tell us before they switch
            </h2>
            <ul className="space-y-3">
              {data.painPoints.map((p) => (
                <li key={p} className="flex gap-3 text-muted-foreground">
                  <X className="h-5 w-5 shrink-0 text-destructive mt-0.5" aria-hidden="true" />
                  <span>{p}</span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {data.comparison && data.comparison.length > 0 && (
          <section className="mb-14">
            <h2 className="text-2xl font-bold mb-4">
              SaaSSuite vs {data.competitor}, side by side
            </h2>
            <div className="overflow-x-auto rounded-xl border">
              <table className="w-full text-sm">
                <caption className="sr-only">
                  Feature and pricing comparison between SaaSSuite and {data.competitor}
                </caption>
                <thead className="bg-muted/50">
                  <tr>
                    <th scope="col" className="text-left font-semibold p-3">Feature</th>
                    <th scope="col" className="text-left font-semibold p-3">SaaSSuite</th>
                    <th scope="col" className="text-left font-semibold p-3">{data.competitor}</th>
                  </tr>
                </thead>
                <tbody>
                  {data.comparison.map((row) => (
                    <tr key={row.feature} className="border-t align-top">
                      <th scope="row" className="text-left font-medium p-3">{row.feature}</th>
                      <td className="p-3 text-foreground">{row.saassuite}</td>
                      <td className="p-3 text-muted-foreground">{row.them}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-xs text-muted-foreground mt-3">
              {data.competitor} pricing and features change — always confirm current details on
              their site. Everything in the SaaSSuite column is what we ship today.
            </p>
          </section>
        )}

        <section className="mb-14">
          <h2 className="text-2xl font-bold mb-2">Everything you get with SaaSSuite</h2>
          <p className="text-muted-foreground mb-6">
            No contracts, no setup fees, and no four-figure monthly minimum. Start on the free
            Starter plan, upgrade to Basic ($27/mo) or Advanced ($97/mo) when it's paying for itself.
          </p>
          <div className="grid gap-6 sm:grid-cols-2">
            {featureGroups.map((group) => (
              <div key={group.title} className="rounded-xl border p-5 bg-card">
                <h3 className="font-semibold mb-3">{group.title}</h3>
                <ul className="space-y-2">
                  {group.items.map((item) => (
                    <li key={item} className="flex gap-2 text-sm text-muted-foreground">
                      <Check className="h-4 w-4 shrink-0 text-primary mt-0.5" aria-hidden="true" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>

        <div className="prose prose-neutral max-w-none">
          <h2>Why agencies switch to SaaSSuite</h2>
          {data.differentiators.map((d) => (
            <div key={d.title}>
              <h3>{d.title}</h3>
              <p>{d.body}</p>
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
          <p className="text-muted-foreground mb-5">
            Create your account in under two minutes. Free to start, no contract, cancel anytime.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Button asChild size="lg">
              <a href={signupHref}>
                Get started free <ArrowRight className="ml-2 h-4 w-4" />
              </a>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link to="/pricing">Compare plans</Link>
            </Button>
          </div>
        </div>
      </article>
    </MarketingLayout>
  );
};

export default AlternativePage;
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { useStripStaticSeo } from "@/hooks/useStripStaticSeo";
import { DEFAULT_SOCIAL_IMAGE } from "@/components/PageSEO";
import {
  BlogPost as BlogPostType,
  SITE_URL,
  buildArticleJsonLd,
  buildBreadcrumbJsonLd,
  buildFaqJsonLd,
  buildHowToJsonLd,
  fetchPublishedPostBySlug,
} from "@/lib/blog";
import MarkdownContent from "@/components/blog/MarkdownContent";
import MarketingLayout from "@/components/MarketingLayout";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ChevronLeft, Sparkles } from "lucide-react";

const BlogPostPage = () => {
  const { slug } = useParams<{ slug: string }>();
  useStripStaticSeo(slug);
  const [post, setPost] = useState<BlogPostType | null | undefined>(undefined);

  useEffect(() => {
    if (!slug) return;
    fetchPublishedPostBySlug(slug).then((p) => setPost(p ?? null));
  }, [slug]);

  if (post === undefined) {
    return (
      <MarketingLayout>
      <div className="max-w-3xl mx-auto px-6 py-16 space-y-4">
        <Skeleton className="h-8 w-3/4" />
        <Skeleton className="h-4 w-1/3" />
        <Skeleton className="h-64 w-full" />
      </div>
      </MarketingLayout>
    );
  }

  if (post === null) {
    return (
      <MarketingLayout>
      <div className="min-h-[60vh] flex flex-col items-center justify-center p-6 text-center">
        <h1 className="text-2xl font-bold mb-2">Post not found</h1>
        <p className="text-muted-foreground mb-6">
          This post may have been unpublished or moved.
        </p>
        <Button asChild>
          <Link to="/blog">Back to blog</Link>
        </Button>
      </div>
      </MarketingLayout>
    );
  }

  const url = `${SITE_URL}/blog/${post.slug}`;
  const title = post.meta_title || post.title;
  const description =
    post.meta_description || post.excerpt || post.tldr || undefined;
  const jsonLd = [
    buildArticleJsonLd(post),
    buildBreadcrumbJsonLd([
      { name: "Blog", url: `${SITE_URL}/blog` },
      { name: post.title, url },
    ]),
    buildFaqJsonLd(post.faq),
    buildHowToJsonLd(post),
  ].filter(Boolean);

  return (
    <MarketingLayout>
      <Helmet>
        <title>{title}</title>
        {description && <meta name="description" content={description} />}
        <link rel="canonical" href={post.canonical_url || url} />
        <meta property="og:type" content="article" />
        <meta property="og:title" content={title} />
        <meta property="og:url" content={url} />
        {description && <meta property="og:description" content={description} />}
        <meta
          property="og:image"
          content={post.cover_image_url || DEFAULT_SOCIAL_IMAGE}
        />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={title} />
        {description && <meta name="twitter:description" content={description} />}
        <meta
          name="twitter:image"
          content={post.cover_image_url || DEFAULT_SOCIAL_IMAGE}
        />
        {jsonLd.map((data, i) => (
          <script key={i} type="application/ld+json">
            {JSON.stringify(data)}
          </script>
        ))}
      </Helmet>

      <article className="max-w-3xl mx-auto px-6 py-12">
        <Link
          to="/blog"
          className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-6"
        >
          <ChevronLeft className="w-4 h-4 mr-1" /> Back to blog
        </Link>

        <div className="flex flex-wrap gap-2 mb-4">
          {post.tags.map((t) => (
            <Badge key={t} variant="secondary">
              {t}
            </Badge>
          ))}
        </div>

        <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-4">
          {post.title}
        </h1>

        <div className="flex items-center gap-3 text-sm text-muted-foreground mb-8">
          <span className="font-medium text-foreground">{post.author_name}</span>
          {post.reading_minutes && <span>· {post.reading_minutes} min read</span>}
          {post.published_at && (
            <span>
              ·{" "}
              {new Date(post.published_at).toLocaleDateString(undefined, {
                year: "numeric",
                month: "long",
                day: "numeric",
              })}
            </span>
          )}
        </div>

        {post.cover_image_url && (
          <img
            src={post.cover_image_url}
            alt={post.title}
            className="w-full aspect-[16/9] object-cover rounded-xl mb-8"
          />
        )}

        {post.tldr && (
          <Card className="mb-8 border-primary/20 bg-primary/5 p-5">
            <div className="flex items-center gap-2 text-primary font-semibold mb-2">
              <Sparkles className="w-4 h-4" /> TL;DR
            </div>
            <p className="text-sm md:text-base">{post.tldr}</p>
          </Card>
        )}

        <MarkdownContent markdown={post.body_markdown} />

        {post.faq.length > 0 && (
          <section className="mt-12 border-t pt-10">
            <h2 className="text-2xl font-bold mb-6">Frequently asked questions</h2>
            <div className="space-y-6">
              {post.faq.map((f, i) => (
                <div key={i}>
                  <h3 className="font-semibold mb-2">{f.question}</h3>
                  <p className="text-muted-foreground">{f.answer}</p>
                </div>
              ))}
            </div>
          </section>
        )}

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

export default BlogPostPage;
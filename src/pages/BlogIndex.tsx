import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import PageSEO from "@/components/PageSEO";
import { buildBreadcrumbJsonLd } from "@/lib/seoJsonLd";
import { fetchPublishedPosts, BlogPost, SITE_URL } from "@/lib/blog";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import MarketingLayout from "@/components/MarketingLayout";

const BlogIndex = () => {
  const [posts, setPosts] = useState<BlogPost[] | null>(null);

  useEffect(() => {
    fetchPublishedPosts().then(setPosts);
  }, []);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Blog",
    name: "SaaSSuite Blog",
    url: `${SITE_URL}/blog`,
    description:
      "Guides, playbooks, and strategy for HighLevel agencies running white-label SaaS.",
    blogPost: (posts || []).slice(0, 20).map((p) => ({
      "@type": "BlogPosting",
      headline: p.title,
      url: `${SITE_URL}/blog/${p.slug}`,
      datePublished: p.published_at || p.created_at,
      author: { "@type": "Person", name: p.author_name },
    })),
  };

  return (
    <MarketingLayout>
      <PageSEO
        title="SaaSSuite Blog — HighLevel White-Label & Agency Playbooks"
        description="Guides, playbooks, and case studies for HighLevel agencies running white-label SaaS. Onboarding, retention, AI support, branding, and growth."
        path="/blog"
        jsonLd={[jsonLd, buildBreadcrumbJsonLd([{ name: "Blog", path: "/blog" }])!]}
      />

      <header className="border-b bg-gradient-to-b from-primary/5 to-transparent">
        <div className="max-w-5xl mx-auto px-6 py-16">
          <p className="text-sm font-medium text-primary mb-3">SaaSSuite Blog</p>
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight">
            HighLevel white-label playbooks
          </h1>
          <p className="mt-4 text-lg text-muted-foreground max-w-2xl">
            Field-tested strategies for agencies scaling SaaS mode: onboarding,
            retention, AI support, branding, and monetization.
          </p>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-12">
        {posts === null ? (
          <div className="grid gap-6 md:grid-cols-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-48 w-full" />
            ))}
          </div>
        ) : posts.length === 0 ? (
          <p className="text-muted-foreground">No posts published yet.</p>
        ) : (
          <div className="grid gap-6 md:grid-cols-2">
            {posts.map((post) => (
              <Link key={post.id} to={`/blog/${post.slug}`} className="group">
                <Card className="h-full transition-all group-hover:border-primary/40 group-hover:shadow-md">
                  {post.cover_image_url && (
                    <img
                      src={post.cover_image_url}
                      alt={post.title}
                      loading="lazy"
                      className="w-full aspect-[16/9] object-cover rounded-t-lg"
                    />
                  )}
                  <CardHeader>
                    <div className="flex flex-wrap gap-2 mb-2">
                      {post.tags.slice(0, 3).map((t) => (
                        <Badge key={t} variant="secondary" className="text-xs">
                          {t}
                        </Badge>
                      ))}
                    </div>
                    <CardTitle className="text-xl group-hover:text-primary transition-colors">
                      {post.title}
                    </CardTitle>
                    {post.excerpt && (
                      <CardDescription className="line-clamp-3">
                        {post.excerpt}
                      </CardDescription>
                    )}
                  </CardHeader>
                  <CardContent className="text-xs text-muted-foreground flex items-center gap-3">
                    <span>{post.author_name}</span>
                    {post.reading_minutes && <span>· {post.reading_minutes} min read</span>}
                    {post.published_at && (
                      <span>
                        · {new Date(post.published_at).toLocaleDateString(undefined, {
                          year: "numeric",
                          month: "short",
                          day: "numeric",
                        })}
                      </span>
                    )}
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </main>
    </MarketingLayout>
  );
};

export default BlogIndex;
import { supabase } from "@/integrations/supabase/client";

export interface BlogFaqItem {
  question: string;
  answer: string;
}

export interface BlogHowToStep {
  name: string;
  text: string;
}

export interface BlogPost {
  id: string;
  slug: string;
  title: string;
  excerpt: string | null;
  body_markdown: string;
  cover_image_url: string | null;
  author_name: string;
  author_bio: string | null;
  author_avatar_url: string | null;
  tldr: string | null;
  faq: BlogFaqItem[];
  howto_steps: BlogHowToStep[];
  tags: string[];
  meta_title: string | null;
  meta_description: string | null;
  canonical_url: string | null;
  published: boolean;
  published_at: string | null;
  scheduled_publish_at: string | null;
  reading_minutes: number | null;
  view_count: number;
  created_at: string;
  updated_at: string;
}

export const SITE_URL = "https://saassuite.ai";

export function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

export function calcReadingMinutes(markdown: string): number {
  const words = markdown.trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 220));
}

/** Entity links to auto-inject into rendered markdown. Case-insensitive first-occurrence only. */
export const ENTITY_LINKS: { keyword: RegExp; href: string; label: string }[] = [
  { keyword: /\bHighLevel\b/, href: "/", label: "HighLevel" },
  { keyword: /\bGoHighLevel\b/, href: "/", label: "GoHighLevel" },
  { keyword: /\bwhite[- ]label\b/i, href: "/branding-tool", label: "white-label" },
  { keyword: /\bSaaS mode\b/i, href: "/pricing", label: "SaaS mode" },
  { keyword: /\bAI support\b/i, href: "/support", label: "AI support" },
  { keyword: /\bemail warmup\b/i, href: "/email-warmup", label: "email warmup" },
  { keyword: /\baffiliate\b/i, href: "/affiliate", label: "affiliate program" },
];

/**
 * Public read of a single published post.
 */
export async function fetchPublishedPostBySlug(slug: string): Promise<BlogPost | null> {
  const { data, error } = await supabase
    .from("blog_posts" as any)
    .select("*")
    .eq("slug", slug)
    .eq("published", true)
    .maybeSingle();
  if (error || !data) return null;
  return normalizePost(data);
}

export async function fetchPublishedPosts(): Promise<BlogPost[]> {
  const { data, error } = await supabase
    .from("blog_posts" as any)
    .select("*")
    .eq("published", true)
    .order("published_at", { ascending: false })
    .limit(200);
  if (error || !data) return [];
  return (data as any[]).map(normalizePost);
}

export async function fetchAllPostsAdmin(): Promise<BlogPost[]> {
  const { data, error } = await supabase
    .from("blog_posts" as any)
    .select("*")
    .order("created_at", { ascending: false })
    .limit(500);
  if (error || !data) return [];
  return (data as any[]).map(normalizePost);
}

function normalizePost(row: any): BlogPost {
  return {
    ...row,
    faq: Array.isArray(row.faq) ? row.faq : [],
    howto_steps: Array.isArray(row.howto_steps) ? row.howto_steps : [],
    tags: Array.isArray(row.tags) ? row.tags : [],
  } as BlogPost;
}

export function buildArticleJsonLd(post: BlogPost) {
  return {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: post.title,
    description: post.meta_description || post.excerpt || post.tldr || undefined,
    image: post.cover_image_url || undefined,
    author: {
      "@type": "Person",
      name: post.author_name,
      description: post.author_bio || undefined,
    },
    publisher: {
      "@type": "Organization",
      name: "SaaSSuite",
      url: SITE_URL,
    },
    datePublished: post.published_at || post.created_at,
    dateModified: post.updated_at,
    mainEntityOfPage: `${SITE_URL}/blog/${post.slug}`,
  };
}

export function buildFaqJsonLd(faq: BlogFaqItem[]) {
  if (!faq.length) return null;
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faq.map((f) => ({
      "@type": "Question",
      name: f.question,
      acceptedAnswer: { "@type": "Answer", text: f.answer },
    })),
  };
}

export function buildHowToJsonLd(post: BlogPost) {
  if (!post.howto_steps.length) return null;
  return {
    "@context": "https://schema.org",
    "@type": "HowTo",
    name: post.title,
    step: post.howto_steps.map((s, i) => ({
      "@type": "HowToStep",
      position: i + 1,
      name: s.name,
      text: s.text,
    })),
  };
}

export function buildBreadcrumbJsonLd(items: { name: string; url: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((it, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: it.name,
      item: it.url,
    })),
  };
}
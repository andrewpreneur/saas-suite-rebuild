/**
 * Single source of truth for public, indexable routes — used by both the
 * prerenderer (vite.config.ts) and the sitemap generator.
 */
import { ALTERNATIVE_PAGES, NICHE_PAGES } from "../src/config/landingPages";

export const SITE_URL = "https://saassuite.ai";

export interface RouteEntry {
  path: string;
  lastmod?: string;
  changefreq?: "daily" | "weekly" | "monthly" | "yearly";
  priority?: string;
}

export const STATIC_ROUTES: RouteEntry[] = [
  { path: "/", changefreq: "weekly", priority: "1.0" },
  { path: "/pricing", changefreq: "monthly", priority: "0.9" },
  { path: "/community", changefreq: "weekly", priority: "0.8" },
  { path: "/ai-studio-seo-prompt", changefreq: "monthly", priority: "0.8" },
  { path: "/setup", changefreq: "monthly", priority: "0.9" },

  { path: "/onboardings", changefreq: "monthly", priority: "0.9" },
  { path: "/support", changefreq: "monthly", priority: "0.9" },
  { path: "/support-service", changefreq: "weekly", priority: "0.9" },
  { path: "/challenge", changefreq: "daily", priority: "0.9" },
  { path: "/move-your-saas-challenge-rules", changefreq: "monthly", priority: "0.5" },
  { path: "/branding-tool", changefreq: "monthly", priority: "0.9" },
  { path: "/first-ghl-client", changefreq: "monthly", priority: "0.8" },
  { path: "/digital-agency-freedom", changefreq: "monthly", priority: "0.8" },
  { path: "/login-tracking", changefreq: "monthly", priority: "0.8" },
  { path: "/email-warmup", changefreq: "monthly", priority: "0.8" },
  { path: "/webinar", changefreq: "monthly", priority: "0.8" },
  { path: "/ai-saas-webinar", changefreq: "monthly", priority: "0.8" },
  { path: "/affiliate", changefreq: "monthly", priority: "0.7" },
  { path: "/breakdown", changefreq: "monthly", priority: "0.7" },
  { path: "/blog", changefreq: "daily", priority: "0.9" },
  { path: "/book", changefreq: "monthly", priority: "0.6" },
  { path: "/privacy", changefreq: "yearly", priority: "0.3" },
  { path: "/terms", changefreq: "yearly", priority: "0.3" },
  { path: "/accessibility", changefreq: "yearly", priority: "0.3" },
  { path: "/cookies", changefreq: "yearly", priority: "0.3" },
  { path: "/refunds", changefreq: "yearly", priority: "0.3" },
  { path: "/one-feature-kit", changefreq: "weekly", priority: "0.8" },
  { path: "/one-feature-kit/ghl-signup-and-upgrade", changefreq: "weekly", priority: "0.5" },
  { path: "/one-feature-kit/launch-pack", changefreq: "weekly", priority: "0.5" },
  { path: "/one-feature-kit/webinar-sales-system", changefreq: "weekly", priority: "0.5" },
  { path: "/saaspartner", changefreq: "monthly", priority: "0.6" },
];

export const ALTERNATIVE_ROUTES: RouteEntry[] = ALTERNATIVE_PAGES.map((p) => ({
  path: `/alternatives/${p.slug}`,
  changefreq: "monthly",
  priority: "0.8",
}));

export const NICHE_ROUTES: RouteEntry[] = NICHE_PAGES.map((p) => ({
  path: `/for/${p.slug}`,
  changefreq: "monthly",
  priority: "0.7",
}));

/** Published blog posts, read straight from Supabase at build time. */
export async function fetchBlogRoutes(): Promise<RouteEntry[]> {
  const url = process.env.VITE_SUPABASE_URL;
  const key =
    process.env.VITE_SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;
  if (!url || !key) {
    console.warn("[seo-routes] Supabase env missing — skipping blog routes.");
    return [];
  }

  try {
    const res = await fetch(
      `${url}/rest/v1/blog_posts?select=slug,updated_at,published_at&published=eq.true&order=published_at.desc&limit=1000`,
      { headers: { apikey: key, Authorization: `Bearer ${key}` } },
    );
    if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
    const rows = (await res.json()) as {
      slug: string;
      updated_at: string | null;
      published_at: string | null;
    }[];
    return rows
      .filter((r) => r.slug)
      .map((r) => ({
        path: `/blog/${r.slug}`,
        lastmod: (r.updated_at || r.published_at || undefined)?.slice(0, 10),
        changefreq: "monthly" as const,
        priority: "0.7",
      }));
  } catch (error) {
    console.warn("[seo-routes] Failed to fetch blog posts:", error);
    return [];
  }
}

export async function getAllPublicRoutes(): Promise<RouteEntry[]> {
  const blog = await fetchBlogRoutes();
  return [...STATIC_ROUTES, ...ALTERNATIVE_ROUTES, ...NICHE_ROUTES, ...blog];
}
// Runs before `vite dev` and `vite build` (predev/prebuild); writes public/sitemap.xml.
import { writeFileSync } from "fs";
import { resolve } from "path";
import { SITE_URL, getAllPublicRoutes, type RouteEntry } from "./seo-routes";

function render(entries: RouteEntry[]) {
  const urls = entries.map((e) =>
    [
      "  <url>",
      `    <loc>${SITE_URL}${e.path}</loc>`,
      e.lastmod ? `    <lastmod>${e.lastmod}</lastmod>` : null,
      e.changefreq ? `    <changefreq>${e.changefreq}</changefreq>` : null,
      e.priority ? `    <priority>${e.priority}</priority>` : null,
      "  </url>",
    ]
      .filter(Boolean)
      .join("\n"),
  );

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...urls,
    "</urlset>",
    "",
  ].join("\n");
}

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;
if (!supabaseUrl || !supabaseKey) {
  console.warn("[sitemap] Supabase env missing — leaving public/sitemap.xml unchanged.");
} else {
  const entries = await getAllPublicRoutes();
  writeFileSync(resolve("public/sitemap.xml"), render(entries));
  console.log(`sitemap.xml written (${entries.length} entries)`);
}
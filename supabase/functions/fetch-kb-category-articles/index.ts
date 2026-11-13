// Fetches the article list for a single KB category by scraping
// help.yoursoftwareonboarding.com/{agencyId}/category/{categorySlug}.
// Used by the agency owner UI to lazily expand a category in the
// "Manage Articles" panel without paying for every category up front.
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

const KB_BASE = "https://help.yoursoftwareonboarding.com";

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ");
}

function stripTags(s: string): string {
  return decodeEntities(s.replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();
}

async function fetchText(url: string, timeoutMs = 20000): Promise<string | null> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "SaaSSuite-KB-Fetcher/1.0" },
      signal: ctrl.signal,
    });
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

function parseArticles(html: string, agencyId: string, categorySlug: string) {
  const out: { slug: string; title: string }[] = [];
  const seen = new Set<string>();
  const re = new RegExp(
    `href="/${agencyId}/article/${categorySlug}/([^"]+)"([\\s\\S]*?)</a>`,
    "g",
  );
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    const slug = m[1];
    if (seen.has(slug)) continue;
    seen.add(slug);
    const inner = m[2];
    const titleMatch =
      inner.match(/<div[^>]*class="[^"]*text-sm font-medium[^"]*"[^>]*>([\s\S]*?)<\/div>/) ||
      inner.match(/<span[^>]*class="[^"]*truncate[^"]*"[^>]*>([\s\S]*?)<\/span>/);
    const title = titleMatch ? stripTags(titleMatch[1]) : slug;
    out.push({ slug, title });
  }
  return out;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const url = new URL(req.url);
    let agencyId = url.searchParams.get("agencyId") || "";
    let categorySlug = url.searchParams.get("categorySlug") || "";
    if ((!agencyId || !categorySlug) && req.method === "POST") {
      const body = await req.json().catch(() => ({}));
      agencyId = agencyId || body?.agencyId || "";
      categorySlug = categorySlug || body?.categorySlug || "";
    }
    agencyId = agencyId.trim().toLowerCase();
    categorySlug = categorySlug.trim();
    if (!agencyId || !categorySlug) {
      return new Response(
        JSON.stringify({ error: "agencyId and categorySlug required" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const html = await fetchText(`${KB_BASE}/${agencyId}/category/${categorySlug}`);
    if (!html) {
      return new Response(
        JSON.stringify({ error: "Failed to load KB category", articles: [] }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const articles = parseArticles(html, agencyId, categorySlug);
    return new Response(
      JSON.stringify({ agencyId, categorySlug, articles }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
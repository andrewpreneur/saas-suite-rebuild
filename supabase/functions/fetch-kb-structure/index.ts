// Fetches the public KB CATEGORY list (no articles) for an agency by scraping
// help.yoursoftwareonboarding.com. Article lists are loaded lazily by the
// fetch-kb-category-articles function. Keeping this endpoint cheap is what
// prevents the agency owner UI from timing out on large knowledge bases.
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

function parseCategories(html: string, agencyId: string) {
  const out: { slug: string; name: string; articleCount: number }[] = [];
  const seen = new Set<string>();
  const re = new RegExp(
    `href="/${agencyId}/category/([^"/]+)"[^>]*>([\\s\\S]*?)</a>`,
    "g",
  );
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    const slug = m[1];
    if (seen.has(slug)) continue;
    seen.add(slug);
    const inner = m[2];
    const span = inner.match(/<span[^>]*class="[^"]*truncate[^"]*"[^>]*>([\s\S]*?)<\/span>/);
    const name = span ? stripTags(span[1]) : stripTags(inner).split(" ").slice(0, 6).join(" ");
    // Card markup includes e.g. "10 articles" or "1 article".
    const countMatch = inner.match(/(\d+)\s*<!--[^>]*-->\s*<!--[^>]*-->\s*articles?/i)
      || inner.match(/>(\d+)\s*articles?</i)
      || inner.match(/(\d+)\s*articles?/i);
    const articleCount = countMatch ? parseInt(countMatch[1], 10) : 0;
    out.push({ slug, name, articleCount });
  }
  return out.sort((a, b) => a.name.localeCompare(b.name));
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const url = new URL(req.url);
    let agencyId = url.searchParams.get("agencyId") || "";
    if (!agencyId && req.method === "POST") {
      const body = await req.json().catch(() => ({}));
      agencyId = body?.agencyId || "";
    }
    agencyId = agencyId.trim().toLowerCase();
    if (!agencyId) {
      return new Response(JSON.stringify({ error: "agencyId required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const indexHtml = await fetchText(`${KB_BASE}/${agencyId}`);
    if (!indexHtml) {
      return new Response(
        JSON.stringify({ error: "Failed to load KB index", categories: [] }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const categories = parseCategories(indexHtml, agencyId);

    return new Response(
      JSON.stringify({ agencyId, categories }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

const GIPHY_API = 'https://api.giphy.com/v1/gifs';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  const apiKey = Deno.env.get('GIPHY_API_KEY');
  if (!apiKey) return json({ error: 'GIPHY_API_KEY is not configured' }, 500);

  try {
    const url = new URL(req.url);
    let query = url.searchParams.get('q') ?? '';
    let offset = Number(url.searchParams.get('offset') ?? '0');
    let limit = Number(url.searchParams.get('limit') ?? '24');

    if (req.method === 'POST') {
      const body = await req.json().catch(() => ({}));
      if (typeof body.q === 'string') query = body.q;
      if (Number.isFinite(Number(body.offset))) offset = Number(body.offset);
      if (Number.isFinite(Number(body.limit))) limit = Number(body.limit);
    }

    query = query.trim().slice(0, 100);
    offset = Math.max(0, Math.min(Math.trunc(offset) || 0, 4000));
    limit = Math.max(1, Math.min(Math.trunc(limit) || 24, 50));

    const target = new URL(`${GIPHY_API}/${query ? 'search' : 'trending'}`);
    target.searchParams.set('api_key', apiKey);
    target.searchParams.set('limit', String(limit));
    target.searchParams.set('offset', String(offset));
    target.searchParams.set('rating', 'pg-13');
    target.searchParams.set('bundle', 'messaging_non_clips');
    if (query) target.searchParams.set('q', query);

    const res = await fetch(target.toString());
    if (!res.ok) {
      return json({ error: `Giphy request failed (${res.status})` }, 502);
    }
    const data = await res.json();
    return json({ data: data.data ?? [], pagination: data.pagination ?? {}, meta: data.meta ?? {} });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : 'Unexpected error' }, 500);
  }
});

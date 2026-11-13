import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { missingIsTestColumn, requestIsTest } from '../_shared/test-traffic.ts';

/** Remember a missing column so pageviews before the migration still insert. */
let siteIsTestColumn: 'unknown' | 'no' = 'unknown';

function dynamicCors(req: Request) {
  const origin = req.headers.get('origin') ?? '*';
  return { ...corsHeaders, 'Access-Control-Allow-Origin': origin, 'Access-Control-Allow-Credentials': 'true' };
}

const ALLOWED_EVENTS = new Set([
  'pageview', 'click', 'video_play', 'video_progress', 'video_complete', 'video_pause', 'video_seek', 'scroll_depth', 'form_submit', 'conversion', 'exit', 'element_visible', 'hover_intent',
]);

const VALID_PLANS = new Set(['STARTER', 'BASIC', 'ADVANCED', 'AGENCY_SUPPORT']);

function str(v: unknown, max = 500): string | null {
  if (typeof v !== 'string') return null;
  const s = v.trim();
  return s ? s.slice(0, max) : null;
}

function bool(v: unknown): boolean | null {
  if (typeof v === 'boolean') return v;
  return null;
}

function clampMetadata(obj: unknown): Record<string, unknown> | null {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return null;
  const serialized = JSON.stringify(obj);
  if (serialized.length > 10000) {
    const trimmed: Record<string, unknown> = {};
    for (const [k, val] of Object.entries(obj as Record<string, unknown>)) {
      const s = JSON.stringify(val);
      if (s.length <= 2000) trimmed[k] = val;
    }
    return trimmed;
  }
  return obj as Record<string, unknown>;
}

async function hashIp(ip: string): Promise<string> {
  const data = new TextEncoder().encode(`saassuite:${ip}`);
  const buf = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('').slice(0, 24);
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: dynamicCors(req) });

  try {
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== 'object') {
      return new Response(JSON.stringify({ error: 'Invalid body' }), {
        status: 400, headers: { ...dynamicCors(req), 'Content-Type': 'application/json' },
      });
    }

    const path = str((body as any).path, 300);
    if (!path) {
      return new Response(JSON.stringify({ error: 'path is required' }), {
        status: 400, headers: { ...dynamicCors(req), 'Content-Type': 'application/json' },
      });
    }

    const eventType = str((body as any).event_type, 40) ?? 'pageview';
    if (!ALLOWED_EVENTS.has(eventType)) {
      return new Response(JSON.stringify({ error: 'Unknown event_type' }), {
        status: 400, headers: { ...dynamicCors(req), 'Content-Type': 'application/json' },
      });
    }

    const ip = (req.headers.get('x-forwarded-for') ?? '').split(',')[0].trim() || 'unknown';
    const ua = req.headers.get('user-agent') ?? '';
    const device = /mobile|iphone|android/i.test(ua) ? 'mobile' : /ipad|tablet/i.test(ua) ? 'tablet' : 'desktop';
    const browser = /edg\//i.test(ua) ? 'Edge' : /chrome/i.test(ua) ? 'Chrome' : /safari/i.test(ua) ? 'Safari'
      : /firefox/i.test(ua) ? 'Firefox' : 'Other';

    const rawValue = (body as any).value;
    const rawDuration = (body as any).duration_ms;

    const planRaw = str((body as any).plan_type, 40)?.toUpperCase();
    const planType = planRaw && VALID_PLANS.has(planRaw) ? planRaw : null;

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const isTest = requestIsTest({ body, cookieHeader: req.headers.get('cookie') });
    const row: Record<string, unknown> = {
      session_id: str((body as any).session_id, 64),
      visitor_key: await hashIp(ip),
      ip_address: ip,
      path,
      page_title: str((body as any).page_title, 200),
      event_type: eventType,
      label: str((body as any).label, 200),
      value: typeof rawValue === 'number' && Number.isFinite(rawValue) ? rawValue : null,
      duration_ms: typeof rawDuration === 'number' && Number.isFinite(rawDuration) ? Math.round(rawDuration) : null,
      referrer: str((body as any).referrer, 500),
      utm_source: str((body as any).utm_source, 120),
      utm_medium: str((body as any).utm_medium, 120),
      utm_campaign: str((body as any).utm_campaign, 120),
      utm_content: str((body as any).utm_content, 120),
      utm_term: str((body as any).utm_term, 120),
      fbclid: str((body as any).fbclid, 255),
      gclid: str((body as any).gclid, 255),
      device,
      browser,
      country: req.headers.get('x-vercel-ip-country') ?? req.headers.get('cf-ipcountry'),
      city: req.headers.get('x-vercel-ip-city') ?? null,
      region: req.headers.get('x-vercel-ip-country-region') ?? null,
      user_email: str((body as any).user_email, 200)?.toLowerCase() ?? null,
      plan_type: planType,
      is_app_page: bool((body as any).is_app_page) ?? false,
      session_replay_id: str((body as any).session_replay_id, 64) ?? null,
      metadata: clampMetadata((body as any).metadata) ?? {},
    };
    if (siteIsTestColumn !== 'no') row.is_test = isTest;

    let { error } = await supabase.from('site_analytics_events').insert(row);
    if (error && row.is_test !== undefined && missingIsTestColumn(error)) {
      siteIsTestColumn = 'no';
      const { is_test: _drop, ...rest } = row;
      ({ error } = await supabase.from('site_analytics_events').insert(rest));
    }

    if (error) {
      console.error('insert failed', error);
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500, headers: { ...dynamicCors(req), 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...dynamicCors(req), 'Content-Type': 'application/json' },
    });
  } catch (e) {
    console.error('track-site-event error', e);
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500, headers: { ...dynamicCors(req), 'Content-Type': 'application/json' },
    });
  }
});

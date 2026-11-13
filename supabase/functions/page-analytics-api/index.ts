import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors'

function dynamicCors(req: Request) {
  const origin = req.headers.get('origin') ?? '*'
  return { ...corsHeaders, 'Access-Control-Allow-Origin': origin, 'Access-Control-Allow-Credentials': 'true' }
}

// Public endpoint (verify_jwt = false). READ-ONLY page analytics for external
// agents. Authenticated with Authorization: Bearer <PAGE_ANALYTICS_API_KEY>.
// Never returns raw IP addresses or user emails.

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const API_KEY = Deno.env.get('PAGE_ANALYTICS_API_KEY') ?? ''

const admin = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } })

const json = (req: Request, body: unknown, status = 200) =>
  new Response(JSON.stringify(body, null, 2), {
    status,
    headers: { ...dynamicCors(req), 'Content-Type': 'application/json' },
  })

const APP_PREFIXES = ['/app', '/admin', '/auth', '/login', '/reset-password', '/v2-onboarding']
const isExternal = (p: string) => !APP_PREFIXES.some((x) => p === x || p.startsWith(`${x}/`))

type Row = Record<string, any>

async function fetchEvents(days: number, path?: string | null, includeApp = false): Promise<Row[]> {
  const since = new Date(Date.now() - days * 86400_000).toISOString()
  const out: Row[] = []
  const PAGE = 1000
  for (let from = 0; from < 50_000; from += PAGE) {
    let q = admin
      .from('site_analytics_events')
      .select(
        'created_at, session_id, visitor_key, path, page_title, event_type, label, value, duration_ms, referrer, utm_source, utm_medium, utm_campaign, utm_content, utm_term, fbclid, gclid, device, browser, country, city, region, user_email, plan_type, is_app_page, metadata',
      )
      .gte('created_at', since)
      // hover_intent is high-volume mouse sampling; excluded so it can't crowd out real events
      .neq('event_type', 'hover_intent')
      .order('created_at', { ascending: false })
      .range(from, from + PAGE - 1)
    if (path) q = q.eq('path', path)
    if (!includeApp) q = q.eq('is_app_page', false)
    const { data, error } = await q
    if (error) throw new Error(error.message)
    out.push(...(data ?? []))
    if (!data || data.length < PAGE) break
  }
  return out.filter((r) => includeApp || isExternal(String(r.path ?? '')))
}

const uniq = (rows: Row[], key: string) => new Set(rows.map((r) => r[key]).filter(Boolean)).size

const median = (nums: number[]) => {
  if (!nums.length) return 0
  const s = [...nums].sort((a, b) => a - b)
  const mid = Math.floor(s.length / 2)
  return s.length % 2 ? s[mid] : Math.round((s[mid - 1] + s[mid]) / 2)
}

function pageStats(rows: Row[]) {
  const views = rows.filter((r) => r.event_type === 'pageview')
  // section_time:* exits measure section visibility, not time on page
  const exits = rows.filter((r) => r.event_type === 'exit' && r.label === 'time_on_page')
  const clicks = rows.filter((r) => r.event_type === 'click')
  const scrolls = rows.filter((r) => r.event_type === 'scroll_depth')
  const durations = exits.map((r) => Number(r.duration_ms) || 0).filter((n) => n > 0)
  const sessionsWithScroll = new Set(scrolls.map((r) => r.session_id))
  const deep = new Set(scrolls.filter((r) => Number(r.value) >= 75).map((r) => r.session_id))
  const sessions = uniq(views, 'session_id')
  return {
    pageviews: views.length,
    unique_sessions: sessions,
    unique_visitors: uniq(views, 'visitor_key'),
    clicks: clicks.length,
    video_plays: rows.filter((r) => r.event_type === 'video_play').length,
    median_time_on_page_seconds: Math.round(median(durations) / 1000),
    avg_time_on_page_seconds: durations.length
      ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length / 1000)
      : 0,
    scroll_engaged_sessions: sessionsWithScroll.size,
    deep_scroll_75_sessions: deep.size,
    bounce_rate_pct: sessions ? Math.round(((sessions - sessionsWithScroll.size) / sessions) * 100) : 0,
  }
}

function tally(rows: Row[], key: string, limit = 20) {
  const map = new Map<string, number>()
  for (const r of rows) {
    const v = r[key]
    if (!v) continue
    map.set(String(v), (map.get(String(v)) || 0) + 1)
  }
  return Array.from(map.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([value, count]) => ({ value, count }))
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: dynamicCors(req) })

  if (!API_KEY) return json(req, { error: 'PAGE_ANALYTICS_API_KEY is not configured' }, 500)

  const auth = req.headers.get('Authorization') ?? ''
  const provided = auth.replace(/^Bearer\s+/i, '').trim()
  if (!provided || provided !== API_KEY) return json(req, { error: 'Unauthorized' }, 401)

  const url = new URL(req.url)
  // strip the /functions/v1/page-analytics-api prefix
  const route =
    '/' +
    url.pathname
      .replace(/^.*page-analytics-api\/?/, '')
      .replace(/^\/+|\/+$/g, '')
  const days = Math.min(365, Math.max(1, Number(url.searchParams.get('days')) || 30))
  const limit = Math.min(500, Math.max(1, Number(url.searchParams.get('limit')) || 50))
  const path = url.searchParams.get('path')
  const includeApp = url.searchParams.get('include_app') === 'true'

  try {
    switch (route) {
      case '/':
      case '/overview': {
        const rows = await fetchEvents(days, undefined, includeApp)
        const views = rows.filter((r) => r.event_type === 'pageview')
        return json(req, {
          window_days: days,
          generated_at: new Date().toISOString(),
          totals: pageStats(rows),
          top_pages: tally(views, 'path', 25),
          devices: tally(views, 'device'),
          countries: tally(views, 'country'),
          paid_traffic: {
            fbclid_pageviews: views.filter((r) => r.fbclid).length,
            gclid_pageviews: views.filter((r) => r.gclid).length,
            utm_pageviews: views.filter((r) => r.utm_source).length,
            unattributed_pageviews: views.filter((r) => !r.fbclid && !r.gclid && !r.utm_source).length,
          },
        })
      }

      case '/pages': {
        const rows = await fetchEvents(days, undefined, includeApp)
        const byPath = new Map<string, Row[]>()
        for (const r of rows) {
          const p = String(r.path)
          if (!byPath.has(p)) byPath.set(p, [])
          byPath.get(p)!.push(r)
        }
        const pages = Array.from(byPath.entries())
          .map(([p, rs]) => ({ path: p, title: rs.find((r) => r.page_title)?.page_title ?? null, ...pageStats(rs) }))
          .sort((a, b) => b.pageviews - a.pageviews)
        return json(req, { window_days: days, page_count: pages.length, pages })
      }

      case '/page': {
        if (!path) return json(req, { error: 'path query param is required, e.g. ?path=/go-paid' }, 400)
        const rows = await fetchEvents(days, path, includeApp)
        const views = rows.filter((r) => r.event_type === 'pageview')
        return json(req, {
          path,
          window_days: days,
          stats: pageStats(rows),
          referrers: tally(views, 'referrer'),
          utm_sources: tally(views, 'utm_source'),
          utm_campaigns: tally(views, 'utm_campaign'),
          devices: tally(views, 'device'),
          countries: tally(views, 'country'),
          top_clicked_labels: tally(rows.filter((r) => r.event_type === 'click'), 'label', 25),
          scroll_distribution: tally(rows.filter((r) => r.event_type === 'scroll_depth'), 'label'),
        })
      }

      case '/timeseries': {
        const rows = await fetchEvents(days, path, includeApp)
        const map = new Map<string, { pageviews: number; sessions: Set<string> }>()
        for (const r of rows) {
          if (r.event_type !== 'pageview') continue
          const d = String(r.created_at).slice(0, 10)
          if (!map.has(d)) map.set(d, { pageviews: 0, sessions: new Set() })
          const b = map.get(d)!
          b.pageviews++
          if (r.session_id) b.sessions.add(r.session_id)
        }
        const series = Array.from(map.entries())
          .map(([date, b]) => ({ date, pageviews: b.pageviews, unique_sessions: b.sessions.size }))
          .sort((a, b) => a.date.localeCompare(b.date))
        return json(req, { window_days: days, path: path ?? 'all', series })
      }

      case '/attribution': {
        const rows = await fetchEvents(days, undefined, includeApp)
        const views = rows.filter((r) => r.event_type === 'pageview')
        const key = (r: Row) =>
          [r.utm_source || (r.fbclid ? 'facebook' : r.gclid ? 'google' : 'direct'), r.utm_medium || '-', r.utm_campaign || '-'].join(' | ')
        const map = new Map<string, { pageviews: number; sessions: Set<string>; landing: Map<string, number> }>()
        for (const r of views) {
          const k = key(r)
          if (!map.has(k)) map.set(k, { pageviews: 0, sessions: new Set(), landing: new Map() })
          const b = map.get(k)!
          b.pageviews++
          if (r.session_id) b.sessions.add(r.session_id)
          b.landing.set(String(r.path), (b.landing.get(String(r.path)) || 0) + 1)
        }
        const sources = Array.from(map.entries())
          .map(([k, b]) => {
            const [source, medium, campaign] = k.split(' | ')
            return {
              source,
              medium,
              campaign,
              pageviews: b.pageviews,
              unique_sessions: b.sessions.size,
              top_landing_pages: Array.from(b.landing.entries())
                .sort((a, c) => c[1] - a[1])
                .slice(0, 5)
                .map(([p, c]) => ({ path: p, pageviews: c })),
            }
          })
          .sort((a, b) => b.pageviews - a.pageviews)
        return json(req, {
          window_days: days,
          sources,
          click_ids: {
            fbclid: tally(views.filter((r) => r.fbclid), 'fbclid', 50),
            gclid: tally(views.filter((r) => r.gclid), 'gclid', 50),
          },
        })
      }

      case '/sessions': {
        const rows = await fetchEvents(days, path, includeApp)
        const map = new Map<string, Row[]>()
        for (const r of rows) {
          const s = String(r.session_id ?? 'unknown')
          if (!map.has(s)) map.set(s, [])
          map.get(s)!.push(r)
        }
        const sessions = Array.from(map.entries())
          .map(([sid, rs]) => {
            const sorted = rs.slice().sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)))
            const first = sorted[0]
            return {
              session_id: sid,
              visitor_key: first.visitor_key,
              started_at: first.created_at,
              ended_at: sorted[sorted.length - 1].created_at,
              device: first.device,
              browser: first.browser,
              country: first.country,
              region: first.region,
              city: first.city,
              fbclid: first.fbclid ?? null,
              gclid: first.gclid ?? null,
              utm_source: first.utm_source ?? null,
              utm_campaign: first.utm_campaign ?? null,
              referrer: first.referrer ?? null,
              pages_viewed: Array.from(new Set(sorted.filter((r) => r.event_type === 'pageview').map((r) => r.path))),
              total_time_seconds: Math.round(
                sorted.filter((r) => r.event_type === 'exit').reduce((a, r) => a + (Number(r.duration_ms) || 0), 0) / 1000,
              ),
              max_scroll_pct: Math.max(0, ...sorted.filter((r) => r.event_type === 'scroll_depth').map((r) => Number(r.value) || 0)),
              video_plays: sorted.filter((r) => r.event_type === 'video_play').length,
              clicks: sorted.filter((r) => r.event_type === 'click').map((r) => r.label).slice(0, 20),
              event_count: sorted.length,
            }
          })
          .sort((a, b) => String(b.started_at).localeCompare(String(a.started_at)))
          .slice(0, limit)
        return json(req, { window_days: days, session_count: sessions.length, sessions })
      }

      case '/heatmap': {
        const rows = await fetchEvents(days, path, includeApp)
        const clicks = rows.filter((r) => r.event_type === 'click')
        const points = clicks
          .map((r) => {
            const coords = r.metadata?.click_coordinates
            const viewport = r.metadata?.viewport
            if (typeof coords?.x !== 'number' || typeof coords?.y !== 'number') return null
            return {
              x: coords.x,
              y: coords.y,
              viewport: { width: viewport?.width ?? 0, height: viewport?.height ?? 0 },
              selector: r.metadata?.selector ?? null,
              path: r.path,
            }
          })
          .filter(Boolean)
        return json(req, { window_days: days, path: path ?? 'all', click_count: points.length, points })
      }

      case '/video-retention': {
        const rows = await fetchEvents(days, path, includeApp)
        const plays = new Set(rows.filter((r) => r.event_type === 'video_play').map((r) => r.session_id))
        const progress = new Map<number, Set<string>>()
        for (const r of rows) {
          if (r.event_type !== 'video_progress') continue
          const m = r.metadata?.milestone
          if (typeof m !== 'number') continue
          if (!progress.has(m)) progress.set(m, new Set())
          if (r.session_id) progress.get(m)!.add(r.session_id)
        }
        const milestones = [25, 50, 75, 95]
        return json(req, {
          window_days: days,
          path: path ?? 'all',
          total_plays: plays.size,
          retention: milestones.map((m) => ({
            milestone: `${m}%`,
            sessions: progress.get(m)?.size ?? 0,
            rate_pct: plays.size ? Math.round(((progress.get(m)?.size ?? 0) / plays.size) * 100) : 0,
          })),
        })
      }

      case '/plans': {
        const rows = await fetchEvents(days, undefined, includeApp)
        const map = new Map<string, { pageviews: number; clicks: number; sessions: Set<string> }>()
        for (const r of rows) {
          const plan = r.plan_type || 'anonymous'
          if (!map.has(plan)) map.set(plan, { pageviews: 0, clicks: 0, sessions: new Set() })
          const p = map.get(plan)!
          if (r.event_type === 'pageview') {
            p.pageviews++
            if (r.session_id) p.sessions.add(r.session_id)
          }
          if (r.event_type === 'click') p.clicks++
        }
        const plans = Array.from(map.entries())
          .map(([plan, stats]) => ({ plan, pageviews: stats.pageviews, clicks: stats.clicks, sessions: stats.sessions.size }))
          .sort((a, b) => b.pageviews - a.pageviews)
        return json(req, { window_days: days, plans })
      }

      case '/schema':
        return json(req, {
          description: 'Read-only page analytics for saassuite.ai marketing pages. All endpoints are GET.',
          auth: 'Authorization: Bearer <PAGE_ANALYTICS_API_KEY>',
          endpoints: [
            { path: '/overview', params: ['days', 'include_app'], returns: 'site-wide totals, top pages, device/country mix, paid vs unattributed traffic' },
            { path: '/pages', params: ['days', 'include_app'], returns: 'per-page pageviews, sessions, time on page, scroll depth, bounce rate' },
            { path: '/page', params: ['path (required)', 'days', 'include_app'], returns: 'deep stats for one page including referrers, campaigns and clicked elements' },
            { path: '/timeseries', params: ['days', 'path', 'include_app'], returns: 'daily pageviews and unique sessions' },
            { path: '/attribution', params: ['days', 'include_app'], returns: 'traffic grouped by utm source/medium/campaign plus fbclid/gclid counts' },
            { path: '/sessions', params: ['days', 'path', 'limit', 'include_app'], returns: 'individual visitor journeys (no IPs or emails)' },
            { path: '/heatmap', params: ['days', 'path', 'include_app'], returns: 'click coordinates and element selectors for heatmap rendering' },
            { path: '/video-retention', params: ['days', 'path', 'include_app'], returns: 'video play and milestone retention funnel' },
            { path: '/plans', params: ['days', 'include_app'], returns: 'engagement grouped by subscription plan' },
          ],
          notes: [
            'App/admin routes are excluded by default — marketing pages only. Pass include_app=true to include them.',
            'days defaults to 30 (max 365); limit defaults to 50 (max 500).',
            'IP addresses and user emails are never returned.',
          ],
        })

      default:
        return json(req, { error: `Unknown route ${route}. GET /schema for the endpoint list.` }, 404)
    }
  } catch (e) {
    console.error('page-analytics-api error', e)
    return json(req, { error: String(e) }, 500)
  }
})

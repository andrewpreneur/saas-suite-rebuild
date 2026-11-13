import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors'
import { moduleCompletionUserIds } from '../_shared/moduleCompletionIds.ts'

// Public endpoint (verify_jwt = false). Authenticated by an agency-issued API key
// in the Authorization: Bearer <key> header. Scopes everything to that agency_id.

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

const admin = createClient(SUPABASE_URL, SERVICE_ROLE, {
  auth: { persistSession: false },
})

async function sha256Hex(input: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input))
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

function normalizePhone(p: string) {
  return p.replace(/[^\d]/g, '')
}

const NUMBER_WORDS: Record<string, string> = {
  zero: '0', oh: '0', one: '1', two: '2', three: '3', four: '4',
  five: '5', six: '6', seven: '7', eight: '8', nine: '9',
}

const DOMAIN_FIXES: Record<string, string> = {
  'gmail.co': 'gmail.com', 'gmail.con': 'gmail.com', 'gmail.cm': 'gmail.com',
  'gmail.calm': 'gmail.com', 'gmail.come': 'gmail.com', 'gmai.com': 'gmail.com',
  'gmial.com': 'gmail.com', 'gemail.com': 'gmail.com', 'jmail.com': 'gmail.com',
  'yahoo.co': 'yahoo.com', 'yaho.com': 'yahoo.com', 'yahooo.com': 'yahoo.com',
  'hotmail.co': 'hotmail.com', 'hotmial.com': 'hotmail.com',
  'outlook.co': 'outlook.com', 'outlook.con': 'outlook.com',
  'iclould.com': 'icloud.com', 'icloud.co': 'icloud.com',
}

const FILLERS = [
  'my name is', 'his name is', 'her name is', 'their name is', 'the name is',
  'name is', 'this is', "it's", 'it is', "i'm", 'i am', 'the customer',
  'the user', 'my email is', 'the email is', 'email is', 'spelled',
  "that's", 'thats', 'okay', 'uh', 'um',
]

function stripFillers(s: string): string {
  let out = ' ' + s.trim() + ' '
  for (const f of FILLERS) out = out.split(' ' + f + ' ').join(' ')
  return out.replace(/\s{2,}/g, ' ').trim()
}

/**
 * Voice transcripts mangle emails: "andrew at dna dash media dot net",
 * "Andrew@DNA-Media.net.", "andrew (at) dna media . net", "cassandra at gmail dot con".
 */
function normalizeSpokenEmail(input: string): string {
  let s = stripFillers(String(input || '').toLowerCase().replace(/[\u201C\u201D\u2018\u2019"']/g, ''))
  s = ' ' + s + ' '
  s = s.replace(/\s*\(?\s*\b(at sign|atsign|at)\b\s*\)?\s*/g, '@')
  s = s.replace(/\s*\b(dot|period|point)\b\s*/g, '.')
  s = s.replace(/\s*\b(dash|hyphen|minus)\b\s*/g, '-')
  s = s.replace(/\s*\b(underscore|under score)\b\s*/g, '_')
  s = s.replace(/\s*\b(plus)\b\s*/g, '+')
  s = s.replace(/\b(all one word|no spaces|no space|one word)\b/g, ' ')
  if (s.includes('@')) {
    s = s.replace(/\b(zero|oh|one|two|three|four|five|six|seven|eight|nine)\b/g, (m) => NUMBER_WORDS[m] ?? m)
    s = s.replace(/\s+/g, '')
  }
  s = s.trim().replace(/^[.,;:@-]+|[.,;:!?]+$/g, '')
  // "gmailcom" -> "gmail.com"
  s = s.replace(/(gmail|yahoo|hotmail|outlook|icloud|aol|live|me)(com|net|org)$/, '$1.$2')
  const at = s.lastIndexOf('@')
  if (at > 0) {
    const local = s.slice(0, at)
    let domain = s.slice(at + 1)
    if (DOMAIN_FIXES[domain]) domain = DOMAIN_FIXES[domain]
    s = `${local}@${domain}`
  }
  return s
}

/** Names keep their spaces — spoken punctuation words must NOT be rewritten here. */
function normalizeSpokenName(input: string): string {
  let s = stripFillers(String(input || '').toLowerCase().replace(/[\u201C\u201D\u2018\u2019"']/g, ' '))
  s = s.replace(/[^a-z0-9'\-\s]/g, ' ')
  return s.replace(/\s{2,}/g, ' ').trim()
}

function looksLikeEmail(raw: string): boolean {
  const s = String(raw || '').toLowerCase()
  if (s.includes('@')) return true
  if (/\b(at|at sign)\b/.test(s) && /\b(dot|period|point)\b/.test(s)) return true
  return /\b(gmail|yahoo|hotmail|outlook|icloud|\.com|\.net|\.org|\.io|\.ai)\b/.test(s)
}

function tokenize(s: string): string[] {
  return s.split(/[\s._+\-]+/).filter(Boolean)
}

function levenshtein(a: string, b: string): number {
  if (a === b) return 0
  if (!a.length) return b.length
  if (!b.length) return a.length
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i)
  for (let i = 1; i <= a.length; i++) {
    const cur = [i]
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(
        prev[j] + 1,
        cur[j - 1] + 1,
        prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
      )
    }
    prev = cur
  }
  return prev[b.length]
}

function similarity(a: string, b: string): number {
  if (!a || !b) return 0
  const max = Math.max(a.length, b.length)
  return 1 - levenshtein(a, b) / max
}

/** Email match that tolerates a misheard domain but trusts the local part. */
function emailScore(email: string, ident: string): number {
  if (!email || !ident) return 0
  if (email === ident) return 1
  const ca = email.replace(/[^a-z0-9]/g, '')
  const cb = ident.replace(/[^a-z0-9]/g, '')
  if (ca && ca === cb) return 0.99
  let best = similarity(email, ident)
  const local = email.split('@')[0]
  const identLocal = ident.includes('@') ? ident.split('@')[0] : ident
  if (local && identLocal) {
    const hasAt = ident.includes('@')
    if (local === identLocal) best = Math.max(best, hasAt ? 0.97 : 0.93)
    else best = Math.max(best, similarity(local, identLocal) * (hasAt ? 0.95 : 0.85))
    const la = local.replace(/[^a-z0-9]/g, '')
    const lb = identLocal.replace(/[^a-z0-9]/g, '')
    if (la && la === lb) best = Math.max(best, 0.96)
  }
  return best
}

/** Token-aware name match: first name only, last name only, reversed order, typos. */
function nameScore(name: string, ident: string): number {
  if (!name || !ident) return 0
  if (name === ident) return 1
  const a = tokenize(name)
  const b = tokenize(ident)
  if (!a.length || !b.length) return 0
  if (a.slice().sort().join(' ') === b.slice().sort().join(' ')) return 0.98
  const tokenHit = (x: string, t: string) =>
    x === t ||
    (t.length > 2 && (x.startsWith(t) || t.startsWith(x))) ||
    (Math.min(x.length, t.length) > 3 && similarity(x, t) >= 0.85)
  if (b.every((t) => a.some((x) => tokenHit(x, t)))) return b.length >= 2 ? 0.95 : 0.88
  if (name.includes(ident) || ident.includes(name)) return 0.87
  if (b.some((t) => a.some((x) => x === t || (Math.min(x.length, t.length) > 3 && similarity(x, t) >= 0.88)))) return 0.8
  return similarity(name, ident)
}

/** Score a candidate user row against the normalized identifier(s). 0..1 */
function scoreRow(row: any, identEmail: string, identName: string, emailish: boolean): number {
  const email = String(row.email || '').toLowerCase()
  const name = String(row.name || '').toLowerCase()
  let best = 0
  if (email) {
    best = Math.max(best, emailScore(email, identEmail))
    // someone may say a name while we only hold an email — compare against the local part
    if (!emailish) best = Math.max(best, nameScore(email.split('@')[0].replace(/[._-]+/g, ' '), identName) * 0.9)
  }
  if (name) {
    best = Math.max(best, nameScore(name, emailish ? identEmail : identName))
  }
  return best
}

/** Back-compat wrapper used by the search endpoint. */
function scoreCandidate(row: any, ident: string): number {
  return scoreRow(row, normalizeSpokenEmail(ident), normalizeSpokenName(ident), looksLikeEmail(ident))
}

async function authenticate(req: Request) {
  const auth = req.headers.get('authorization') || req.headers.get('Authorization') || ''
  const m = auth.match(/^Bearer\s+(.+)$/i)
  if (!m) return { error: 'Missing Authorization: Bearer <api_key> header' as const }
  const apiKey = m[1].trim()
  const hash = await sha256Hex(apiKey)
  const { data, error } = await admin
    .from('agency_api_keys')
    .select('id, agency_id, revoked_at')
    .eq('key_hash', hash)
    .maybeSingle()
  if (error || !data) return { error: 'Invalid API key' as const }
  if (data.revoked_at) return { error: 'API key has been revoked' as const }
  // fire-and-forget last_used_at update
  admin.from('agency_api_keys').update({ last_used_at: new Date().toISOString() }).eq('id', data.id).then(() => {})
  return { agencyId: data.agency_id as string }
}

/**
 * Resolve the set of agency_ids that should be considered "this agency" by also
 * pulling in any of the owner's old/original agency IDs (so changing an agency_id
 * doesn't lose old users — same logic as the in-app Users tab).
 */
async function resolveAgencyIdSet(agencyId: string): Promise<string[]> {
  const ids = new Set<string>([agencyId])
  const cols =
    'agency_id, agency_id_basic, agency_id_advanced, agency_id_elite, original_agency_id, original_agency_id_basic, original_agency_id_advanced, original_agency_id_elite'
  // find any saas_suite_users row that references this agency_id in any slot
  const { data: owners } = await admin
    .from('saas_suite_users')
    .select(cols)
    .or(
      [
        `agency_id.eq.${agencyId}`,
        `agency_id_basic.eq.${agencyId}`,
        `agency_id_advanced.eq.${agencyId}`,
        `agency_id_elite.eq.${agencyId}`,
        `original_agency_id.eq.${agencyId}`,
        `original_agency_id_basic.eq.${agencyId}`,
        `original_agency_id_advanced.eq.${agencyId}`,
        `original_agency_id_elite.eq.${agencyId}`,
      ].join(','),
    )
  for (const row of owners || []) {
    for (const v of Object.values(row)) {
      if (typeof v === 'string' && v) ids.add(v)
    }
  }
  return Array.from(ids)
}

async function fetchUsersForAgency(agencyIds: string[]) {
  const { data: progress } = await admin
    .from('user_progress')
    .select('id, name, email, agency_id, approval, last_accessed, created_at')
    .in('agency_id', agencyIds)
    .limit(5000)
  return progress || []
}

/**
 * Resolve an identifier (possibly a mangled voice transcript) to the set of
 * user_progress rows for that one person. A person can be split across rows
 * (a legacy name-only row plus an email row), so we return every row that
 * belongs to them and merge their progress downstream.
 */
async function resolveUserRows(
  agencyIds: string[],
  identifier: string,
  mode: 'email' | 'name' | 'auto',
): Promise<{ rows: any[]; matched_on: string; score: number; suggestions: any[]; ambiguous?: any[]; normalized?: any }> {
  const identEmail = normalizeSpokenEmail(identifier)
  const identName = normalizeSpokenName(identifier)
  const emailish = mode === 'email' || (mode === 'auto' && looksLikeEmail(identifier))
  const all = await fetchUsersForAgency(agencyIds)

  const pool = all.filter((u: any) =>
    mode === 'email' ? !!u.email : mode === 'name' ? !!u.name : true,
  )

  const scored = pool
    .map((u: any) => ({ u, s: scoreRow(u, identEmail, identName, emailish) }))
    .sort((a, b) => b.s - a.s)

  const top = scored[0]
  const normalized = {
    input: identifier,
    as_email: identEmail,
    as_name: identName,
    treated_as: emailish ? 'email' : 'name',
  }
  console.log('voice-api lookup', JSON.stringify({
    mode,
    ...normalized,
    pool: pool.length,
    top_score: top?.s ?? 0,
    top: top ? { name: top.u.name, email: top.u.email } : null,
  }))

  if (!top || top.s < 0.62) {
    return {
      rows: [],
      matched_on: 'none',
      score: top?.s ?? 0,
      normalized,
      suggestions: scored.slice(0, 5).filter((c) => c.s > 0.28).map((c) => ({
        name: c.u.name,
        email: c.u.email,
        confidence: Math.round(c.s * 100) / 100,
      })),
    }
  }

  // Two or more different people scored within a hair of each other (e.g. only a
  // first name was given and two customers share it) — ask instead of guessing.
  const personKey = (u: any) => String(u.email || u.name || u.id).toLowerCase()
  const near = new Map<string, any>()
  for (const c of scored) {
    if (c.s < top.s - 0.03) break
    if (!near.has(personKey(c.u))) {
      near.set(personKey(c.u), {
        name: c.u.name,
        email: c.u.email,
        confidence: Math.round(c.s * 100) / 100,
      })
    }
  }
  if (near.size > 1 && top.s < 0.97) {
    return {
      rows: [],
      matched_on: 'ambiguous',
      score: Math.round(top.s * 100) / 100,
      suggestions: [],
      ambiguous: Array.from(near.values()).slice(0, 8),
      normalized,
    }
  }


  // Collect every row belonging to the same person (email OR name equality)
  const email = String(top.u.email || '').toLowerCase()
  const name = String(top.u.name || '').toLowerCase()
  const rows = all.filter((u: any) => {
    const e = String(u.email || '').toLowerCase()
    const n = String(u.name || '').toLowerCase()
    return (email && e === email) || (name && n === name)
  })

  // Second pass: those rows may carry the counterpart identifier, pull in
  // rows linked through it too (name row -> email row and vice versa).
  const emails = new Set(rows.map((r: any) => String(r.email || '').toLowerCase()).filter(Boolean))
  const names = new Set(rows.map((r: any) => String(r.name || '').toLowerCase()).filter(Boolean))
  for (const u of all) {
    const e = String(u.email || '').toLowerCase()
    const n = String(u.name || '').toLowerCase()
    if ((e && emails.has(e)) || (n && names.has(n))) {
      if (!rows.includes(u)) rows.push(u)
    }
  }

  return {
    rows,
    matched_on: top.s === 1 ? 'exact' : 'fuzzy',
    score: Math.round(top.s * 100) / 100,
    suggestions: [],
    normalized,
  }
}

async function buildUserDetail(
  agencyIds: string[],
  identifier: string,
  mode: 'email' | 'name' | 'auto' = 'auto',
) {
  const resolved = await resolveUserRows(agencyIds, identifier, mode)
  if (resolved.rows.length === 0) {
    return {
      not_found: true as const,
      matched_on: resolved.matched_on,
      suggestions: resolved.suggestions,
      ambiguous: resolved.ambiguous,
      normalized: resolved.normalized,
    }
  }
  const progressRows = resolved.rows
  // Merged identity: prefer whichever row actually has each field
  const mergedEmail = progressRows.find((r: any) => r.email)?.email ?? null
  const mergedName = progressRows.find((r: any) => r.name)?.name ?? null
  const mergedAgency = progressRows.find((r: any) => r.agency_id)?.agency_id ?? null
  const mergedApproval = progressRows.find((r: any) => r.approval)?.approval ?? null
  const firstSeen = progressRows
    .map((r: any) => r.created_at)
    .filter(Boolean)
    .sort()[0] ?? null
  const lastAccessed = progressRows
    .map((r: any) => r.last_accessed)
    .filter(Boolean)
    .sort()
    .slice(-1)[0] ?? null

  const lower = String(mergedEmail || '').toLowerCase()
  const identifiers = [lower, String(mergedName || '').toLowerCase()].filter(Boolean)

  const userIds = moduleCompletionUserIds(progressRows.map((r: any) => r.id))
  const modules = userIds.length
    ? (
        await admin
          .from('module_completion')
          .select('module_id, category_id, completed, completed_at, user_id')
          .in('user_id', userIds)
      ).data
    : []

  let tickets: any[] = []
  if (lower) {
    const { data } = await admin
      .from('support_tickets')
      .select('id, ticket_number, issue_category, request_text, status, created_at, customer_name, customer_email')
      .in('agency_id', agencyIds)
      .ilike('customer_email', lower)
      .order('created_at', { ascending: false })
    tickets = data || []
  }

  // checklist completion keys on an arbitrary identifier string (email OR name),
  // so query every identifier this person is known by and merge.
  let checklist: any[] = []
  if (identifiers.length > 0) {
    const { data } = await admin
      .from('user_onboarding_checklist_completion')
      .select('checklist_item_id, completed_at, user_identifier')
      .in('agency_id', agencyIds)
      .or(identifiers.map((i) => `user_identifier.ilike.${i}`).join(','))
    checklist = data || []
  }

  const uniqueModules = Array.from(
    new Map(
      (modules || []).map((m: any) => [`${m.category_id}:${m.module_id}`, m]),
    ).values(),
  )

  return {
    match: { matched_on: resolved.matched_on, confidence: resolved.score, merged_records: progressRows.length },
    user: {
      name: mergedName,
      email: mergedEmail,
      agency_id: mergedAgency,
      approval: mergedApproval,
      first_seen_at: firstSeen,
      last_accessed_at: lastAccessed,
    },
    videos_watched: uniqueModules.map((m: any) => ({
      module_id: m.module_id,
      category_id: m.category_id,
      completed: m.completed,
      completed_at: m.completed_at,
    })),
    videos_watched_count: uniqueModules.filter((m: any) => m.completed).length,
    onboarding_checklist_completed: checklist,
    onboarding_checklist_completed_count: checklist.length,
    support_tickets: tickets,
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const auth = await authenticate(req)
    if ('error' in auth) return json({ error: auth.error }, 401)

    const url = new URL(req.url)
    // path inside the function: strip the function name prefix
    const path = url.pathname.replace(/^.*\/agency-voice-api/, '') || '/'
    const segments = path.split('/').filter(Boolean)

    const agencyIds = await resolveAgencyIdSet(auth.agencyId)

    // GET /  -> info
    if (segments.length === 0) {
      return json({
        ok: true,
        agency_id: auth.agencyId,
        endpoints: {
          'GET /users': 'List all users for this agency',
          'GET /users/search?query=...': 'Search users by name, email, or phone',
          'GET /users/lookup?q=...': 'Best endpoint for voice: raw spoken name OR email, spaces are fine',
          'POST /users/lookup {"query":"..."}': 'Same as above but the identifier travels in the body',
          'GET /users/by-email/:email': 'Get full detail by email (also accepts ?email=...)',
          'GET /users/by-name/:name': 'Get full detail by name (also accepts ?name=...)',
          'GET /users/:identifier': 'Get full detail (auto-detect email or name)',
          'GET /training-doc': 'Get training doc URL for this agency and plan',
          'GET /agency-info': 'Get agency configuration (welcome, checklist, support, AI, etc.)',
        },
        notes: [
          'Spoken identifiers are normalized: "andrew at dna dash media dot net" -> andrew@dna-media.net',
          'A first name alone works. If two customers share it, the response is 200 with needs_clarification=true and a candidates list to ask about.',
          'A miss returns 404 with suggestions[] — read those back to the caller instead of saying "not found".',
        ],
      })
    }

    // Identifier can arrive as a path segment, a query param, or a JSON body —
    // voice transcripts contain spaces, which path segments handle badly.
    let bodyIdent = ''
    if (req.method === 'POST') {
      try {
        const b = await req.json()
        bodyIdent = String(b?.query ?? b?.identifier ?? b?.email ?? b?.name ?? b?.q ?? '')
      } catch { /* no body */ }
    }
    const paramIdent = (
      url.searchParams.get('q') ||
      url.searchParams.get('query') ||
      url.searchParams.get('identifier') ||
      url.searchParams.get('email') ||
      url.searchParams.get('name') ||
      ''
    ).trim()

    const respondDetail = (detail: any, label: string) => {
      if ('not_found' in detail) {
        if (detail.matched_on === 'ambiguous') {
          return json({
            needs_clarification: true,
            message: `More than one customer matches that. Ask which one: ${(detail.ambiguous || [])
              .map((c: any) => c.name || c.email)
              .join(', ')}`,
            candidates: detail.ambiguous,
            normalized: detail.normalized,
          })
        }
        return json({
          error: `User not found ${label} in this agency`,
          message: (detail.suggestions || []).length
            ? `No exact match. Closest customers: ${(detail.suggestions || [])
                .map((c: any) => c.name || c.email)
                .join(', ')}. Ask the caller to confirm one of these or spell their email.`
            : 'No match at all. Ask the caller to spell their email one letter at a time.',
          suggestions: detail.suggestions,
          normalized: detail.normalized,
        }, 404)
      }
      return json(detail)
    }

    // GET /users
    // GET /users/search?query=...
    // GET /users/lookup?q=...
    // GET /users/:email
    if (segments[0] === 'users') {
      if (segments.length === 1) {
        const ident = paramIdent || bodyIdent
        if (ident) {
          const mode = url.searchParams.get('email')
            ? 'email'
            : url.searchParams.get('name')
              ? 'name'
              : 'auto'
          return respondDetail(await buildUserDetail(agencyIds, ident, mode as any), 'by identifier')
        }
        const users = await fetchUsersForAgency(agencyIds)
        return json({ count: users.length, users })
      }
      if (segments[1] === 'lookup') {
        const ident = paramIdent || bodyIdent || (segments[2] ? decodeURIComponent(segments[2]) : '')
        if (!ident) return json({ error: 'q (or query/email/name) parameter required' }, 400)
        return respondDetail(await buildUserDetail(agencyIds, ident, 'auto'), 'by identifier')
      }
      if (segments[1] === 'search') {
        const q = (url.searchParams.get('query') || paramIdent || bodyIdent || '').trim()
        if (!q) return json({ error: 'query parameter required' }, 400)
        const all = await fetchUsersForAgency(agencyIds)
        const asName = normalizeSpokenName(q)
        const asEmail = normalizeSpokenEmail(q)
        const phoneQ = normalizePhone(q)
        const matches = all.filter((u: any) => {
          const name = (u.name || '').toLowerCase()
          const email = (u.email || '').toLowerCase()
          return (
            (asName && (name.includes(asName) || email.includes(asName))) ||
            (asEmail && email.includes(asEmail)) ||
            (phoneQ.length >= 7 && name.includes(phoneQ))
          )
        })
        if (matches.length > 0) {
          return json({ count: matches.length, users: matches, matched_on: 'contains' })
        }
        // fall back to fuzzy scoring so voice transcripts still find someone
        const scored = all
          .map((u: any) => ({ ...u, confidence: Math.round(scoreCandidate(u, q) * 100) / 100 }))
          .filter((u: any) => u.confidence > 0.45)
          .sort((a: any, b: any) => b.confidence - a.confidence)
          .slice(0, 10)
        console.log('voice-api search', JSON.stringify({ q, asName, asEmail, hits: scored.length }))
        return json({
          count: scored.length,
          users: scored,
          matched_on: 'fuzzy',
          normalized_query: { as_name: asName, as_email: asEmail },
        })
      }
      // /users/by-email/:email  (or ?email=)
      if (segments[1] === 'by-email') {
        const email = segments[2] ? decodeURIComponent(segments[2]) : paramIdent || bodyIdent
        if (!email) return json({ error: 'email required (path segment or ?email=)' }, 400)
        return respondDetail(await buildUserDetail(agencyIds, email, 'email'), 'by email')
      }
      // /users/by-name/:name  (or ?name=)
      if (segments[1] === 'by-name') {
        const name = segments[2] ? decodeURIComponent(segments[2]) : paramIdent || bodyIdent
        if (!name) return json({ error: 'name required (path segment or ?name=)' }, 400)
        return respondDetail(await buildUserDetail(agencyIds, name, 'name'), 'by name')
      }
      // /users/:identifier  (auto)
      const ident = decodeURIComponent(segments.slice(1).join(' ')) || paramIdent || bodyIdent
      return respondDetail(await buildUserDetail(agencyIds, ident, 'auto'), '')
    }

    // GET /training-doc
    if (segments[0] === 'training-doc') {
      const tier = (url.searchParams.get('tier') || 'basic').toLowerCase()

      const { data } = await admin
        .from('v2_home_settings')
        .select('prompt_training_doc')
        .eq('agency_id', auth.agencyId)
        .maybeSingle()

      const docUrl = data?.prompt_training_doc || null

      // Fetch raw document content from URL if present
      let docContent: string | null = null
      let docFetchError: string | null = null
      if (docUrl) {
        try {
          const r = await fetch(docUrl)
          if (r.ok) {
            docContent = await r.text()
          } else {
            docFetchError = `Failed to fetch doc: ${r.status} ${r.statusText}`
          }
        } catch (e) {
          docFetchError = `Fetch error: ${String((e as Error).message || e)}`
        }
      }

      // Pull custom video transcriptions visible to this tier
      const { data: customVideos } = await admin
        .from('custom_onboarding_videos')
        .select('title, transcription, transcription_status, tiers')
        .eq('agency_id', auth.agencyId)
        .eq('transcription_status', 'success')

      const videoTranscriptions = (customVideos || [])
        .filter(
          (v: any) =>
            v.transcription &&
            v.transcription.trim() &&
            (!v.tiers || (v.tiers as string[]).includes(tier)),
        )
        .map((v: any) => ({ title: v.title, transcription: v.transcription }))

      // Platform-wide AI support knowledge base (admin-curated Q/A pairs)
      const { data: kbRows } = await admin
        .from('ai_support_kb')
        .select('question, answer')
        .eq('active', true)
        .order('updated_at', { ascending: false })
        .limit(500)

      const kbEntries = (kbRows || []).filter((k: any) => k.question && k.answer)

      // Build a single combined formatted text document
      const sections: string[] = []
      if (docContent && docContent.trim()) {
        sections.push(`# Training Document\n\n${docContent.trim()}`)
      }
      if (videoTranscriptions.length > 0) {
        sections.push(`# Custom Video Transcriptions\n`)
        for (const v of videoTranscriptions) {
          sections.push(`## ${v.title}\n${v.transcription}`)
        }
      }
      if (kbEntries.length > 0) {
        sections.push(`# Platform AI Support Knowledge Base (verified answers — prefer these)\n`)
        for (const k of kbEntries) {
          sections.push(`Q: ${k.question}\nA: ${k.answer}`)
        }
      }
      const combined = sections.join('\n\n')

      return json({
        agency_id: auth.agencyId,
        tier,
        training_doc_url: docUrl,
        training_doc_content: docContent,
        training_doc_fetch_error: docFetchError,
        custom_video_transcriptions: videoTranscriptions,
        support_kb: kbEntries,
        combined_text: combined || null,
        combined_length: combined.length,
      })

    }

    // GET /agency-info
    if (segments[0] === 'agency-info') {
      const { data: home } = await admin
        .from('v2_home_settings')
        .select('*')
        .eq('agency_id', auth.agencyId)
        .maybeSingle()

      const { data: checklist } = await admin
        .from('agency_onboarding_checklist')
        .select('item_order, title, description, link_to, link_url, linked_video')
        .eq('agency_id', auth.agencyId)
        .order('item_order', { ascending: true })

      const { data: dailyChecklist } = await admin
        .from('agency_daily_checklist')
        .select('item_1, item_2, item_3')
        .eq('agency_id', auth.agencyId)
        .maybeSingle()

      // Find owner record for plan-level features (support ticketing, AI support, branding)
      const { data: owner } = await admin
        .from('saas_suite_users')
        .select(
          'plan, agency_name, support_ticketing_enabled, custom_ai_general_help_enabled, branded_ai_support, ai_embed_code, tips_bot_enabled, login_enabled, language',
        )
        .or(
          [
            `agency_id.eq.${auth.agencyId}`,
            `agency_id_basic.eq.${auth.agencyId}`,
            `agency_id_advanced.eq.${auth.agencyId}`,
            `agency_id_elite.eq.${auth.agencyId}`,
          ].join(','),
        )
        .maybeSingle()

      return json({
        agency_id: auth.agencyId,
        agency_name: owner?.agency_name || null,
        plan: owner?.plan || null,
        language: owner?.language || null,
        welcome: {
          enabled: home?.welcome_enabled ?? null,
          headline: home?.welcome_headline ?? null,
          subheadline: home?.welcome_subheadline ?? null,
          video_enabled: home?.welcome_video_enabled ?? null,
          video_url: home?.welcome_video_url ?? null,
        },
        announcements: {
          enabled: home?.announcements_enabled ?? null,
          headline: home?.announcements_headline ?? null,
          paragraph: home?.announcements_paragraph ?? null,
        },
        custom_links: {
          enabled: home?.custom_links_enabled ?? null,
          links: [
            home?.custom_link_1_text && { text: home.custom_link_1_text, url: home.custom_link_1_url },
            home?.custom_link_2_text && { text: home.custom_link_2_text, url: home.custom_link_2_url },
            home?.custom_link_3_text && { text: home.custom_link_3_text, url: home.custom_link_3_url },
          ].filter(Boolean),
        },
        ai_chat: {
          enabled: home?.ai_chat_enabled ?? null,
          type: home?.ai_chat_type ?? null,
          has_training_doc: Boolean(home?.prompt_training_doc),
        },
        ai_support: {
          custom_ai_general_help_enabled: owner?.custom_ai_general_help_enabled ?? null,
          branded_ai_support: owner?.branded_ai_support ?? null,
          has_embed_code: Boolean(owner?.ai_embed_code),
        },
        support_ticketing_enabled: owner?.support_ticketing_enabled ?? null,
        tips_bot_enabled: owner?.tips_bot_enabled ?? null,
        login_enabled: owner?.login_enabled ?? null,
        tabs: {
          home: home?.tab_name_home ?? null,
          education: home?.tab_name_education ?? null,
          support: home?.tab_name_support ?? null,
        },
        daily_checklist: {
          enabled: home?.daily_checklist_enabled ?? null,
          title: home?.checklist_title ?? null,
          items: dailyChecklist
            ? [dailyChecklist.item_1, dailyChecklist.item_2, dailyChecklist.item_3].filter(Boolean)
            : [],
        },
        onboarding_checklist: checklist || [],
      })
    }

    return json({ error: 'Not found', path }, 404)
  } catch (e) {
    console.error('agency-voice-api error', e)
    return json({ error: 'Internal error', details: String((e as Error).message || e) }, 500)
  }
})

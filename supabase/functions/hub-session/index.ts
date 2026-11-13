// Portal sign-in. Runs the sign-in writes server-side (create/assign user,
// last-accessed, guest creation) and issues a signed hub session pass that
// every later server write uses as the customer's identity.
//
// User-limit blocks return status "limit" plus reason "user_limit_reached"
// so the hub (a separate app) can explain the seat. The owner's own visit
// and preview/test visits do not take a seat. A blocked visitor also writes
// one in-app platform event per agency per day. This function does not send email.
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { serviceClient } from '../_shared/supportAlert.ts';
import { signHubToken, cleanEmail, cleanName } from '../_shared/hubSession.ts';
import {
  HUB_LIMIT_NOTIFY_WINDOW_MS,
  HUB_USER_LIMIT_EVENT,
  hubLimitResponse,
  normalizeEmail,
  shouldNotifyHubLimit,
  visitorWithinLimit,
} from '../_shared/hubUserLimit.ts';

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

// Non-agency pages that use the hub without an agency row.
const SPECIAL_AGENCIES = new Set(['get-started', 'software-onboarding', 'lite']);

async function agencyExists(sb: ReturnType<typeof serviceClient>, agencyId: string) {
  if (SPECIAL_AGENCIES.has(agencyId)) return true;
  const { data } = await sb.rpc('get_agency_info', { lookup_agency_id: agencyId } as any);
  return Array.isArray(data) && data.length > 0;
}

async function agencyAccount(sb: ReturnType<typeof serviceClient>, agencyId: string) {
  const { data } = await sb.from('saas_suite_users')
    .select('email, full_name, agency_name, plan, premium_support, max_onboarding_users')
    .or(`agency_id.eq.${agencyId},agency_id_basic.eq.${agencyId},agency_id_advanced.eq.${agencyId},agency_id_elite.eq.${agencyId}`)
    .limit(1)
    .maybeSingle();
  return data as {
    email?: string | null;
    full_name?: string | null;
    agency_name?: string | null;
    plan?: string | null;
    premium_support?: boolean | null;
    max_onboarding_users?: number | null;
  } | null;
}

async function ownerEmailsForAgency(sb: ReturnType<typeof serviceClient>, ownerEmail: string | null) {
  const emails = new Set<string>();
  const owner = normalizeEmail(ownerEmail);
  if (owner) emails.add(owner);
  if (!owner) return [...emails];
  const [{ data: admins }, { data: aliases }] = await Promise.all([
    sb.from('account_admins').select('admin_email').ilike('owner_email', ownerEmail!),
    sb.from('onboarding_owner_aliases').select('alias_email').ilike('owner_email', ownerEmail!),
  ]);
  for (const row of admins || []) {
    const email = normalizeEmail((row as { admin_email?: string }).admin_email);
    if (email) emails.add(email);
  }
  for (const row of aliases || []) {
    const email = normalizeEmail((row as { alias_email?: string }).alias_email);
    if (email) emails.add(email);
  }
  return [...emails];
}

async function notifyOwnerOfLimit(sb: ReturnType<typeof serviceClient>, input: {
  agencyId: string;
  ownerEmail: string | null;
  ownerName: string | null;
  agencyName: string | null;
  plan: string | null;
  planName: string;
  limit: number | null;
  current: number;
  blockedEmail: string | null;
}) {
  const since = new Date(Date.now() - HUB_LIMIT_NOTIFY_WINDOW_MS).toISOString();
  const { data: recent } = await sb.from('platform_events')
    .select('created_at')
    .eq('agency_id', input.agencyId)
    .eq('trigger_type', HUB_USER_LIMIT_EVENT)
    .gte('created_at', since)
    .order('created_at', { ascending: false })
    .limit(1);
  const last = (recent || [])[0] as { created_at?: string } | undefined;
  if (!shouldNotifyHubLimit(last?.created_at)) {
    console.info('hub-session user limit already notified', JSON.stringify({ agency_id: input.agencyId }));
    return;
  }
  const { error } = await sb.from('platform_events').insert({
    agency_id: input.agencyId,
    user_email: input.ownerEmail,
    user_name: input.ownerName,
    trigger_type: HUB_USER_LIMIT_EVENT,
    metadata: {
      reason: 'user_limit_reached',
      plan: input.plan,
      plan_name: input.planName,
      limit: input.limit,
      current: input.current,
      blocked_email: input.blockedEmail,
      agency_name: input.agencyName,
    },
  });
  if (error) console.error('hub-session limit notify failed', error);
  else console.info('hub-session user limit notified', JSON.stringify({ agency_id: input.agencyId }));
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  let body: any;
  try { body = await req.json(); } catch { return json({ error: 'Invalid JSON' }, 400); }

  const agencyId = typeof body?.agency_id === 'string' ? body.agency_id.trim() : '';
  if (!agencyId || agencyId.length > 200 || !/^[A-Za-z0-9_.-]+$/.test(agencyId)) {
    return json({ error: 'Invalid agency_id' }, 400);
  }

  const sb = serviceClient();
  try {
    if (!(await agencyExists(sb, agencyId))) return json({ error: 'Unknown agency' }, 404);

    // Guest sign-in: create the guest row server-side, then sign them in.
    if (body.action === 'guest') {
      const { data: guestName, error } = await sb.rpc('create_guest_user', { p_agency_id: agencyId } as any);
      if (error || !guestName) return json({ status: 'unavailable' });
      body = { ...body, action: 'start', email: null, name: guestName };
    }

    if (body.action !== 'start') return json({ error: 'Unknown action' }, 400);

    const email = body.email == null || body.email === '' ? null : cleanEmail(body.email);
    const name = body.name == null || body.name === '' ? null : cleanName(body.name);
    if ((body.email && !email) || (body.name && !name)) return json({ error: 'Invalid email or name' }, 400);
    if (!email && !name) return json({ error: 'email or name required' }, 400);
    const identifier = (email || name)!;

    const { data: banned } = await sb.rpc('is_user_banned', { p_agency_id: agencyId, p_user_identifier: identifier } as any);
    if (banned) return json({ status: 'banned' });

    if (body.check_limit === true) {
      const account = SPECIAL_AGENCIES.has(agencyId) ? null : await agencyAccount(sb, agencyId);
      const ownerEmails = await ownerEmailsForAgency(sb, account?.email || null);
      const limit = account?.max_onboarding_users ?? null;
      let rows: Array<{ email?: string | null; name?: string | null; created_at?: string | null }> = [];
      if (limit != null) {
        const { data } = await sb.from('user_progress').select('email, name, created_at').eq('agency_id', agencyId);
        rows = data || [];
      }
      const decision = visitorWithinLimit({
        email,
        name,
        preview: body.preview === true || body.test === true,
        ownerEmails,
        rows,
        limit,
      });
      if (!decision.allowed) {
        const payload = hubLimitResponse({
          plan: account?.plan,
          premiumSupport: account?.premium_support,
          limit,
          current: decision.used,
          agencyName: account?.agency_name,
        });
        await notifyOwnerOfLimit(sb, {
          agencyId,
          ownerEmail: account?.email || null,
          ownerName: account?.full_name || null,
          agencyName: account?.agency_name || null,
          plan: payload.plan,
          planName: payload.plan_name,
          limit: payload.limit,
          current: payload.current,
          blockedEmail: email,
        });
        return json(payload);
      }
    }

    const { data: userId, error: createErr } = await sb.rpc('create_user_progress_safe_with_name', {
      user_email: email, user_name: name,
    } as any);
    if (createErr || !userId) {
      console.error('create_user_progress_safe_with_name failed:', createErr);
      return json({ error: 'Could not start session' }, 500);
    }

    const { data: row } = await sb.from('user_progress').select('approval').eq('id', userId).maybeSingle();
    const approval = (row as any)?.approval ?? null;
    // v2+ blocks 'denied'; the v1 hub additionally blocks 'NO' on its side (unchanged behavior).
    if (approval === 'denied') return json({ status: 'denied', approval });

    if (body.assign !== false) {
      const { error } = await sb.rpc('update_user_agency_assignment_with_name', {
        agency_id: agencyId, user_email: email, user_name: name,
      } as any);
      if (error) console.error('agency assignment failed:', error);
    }
    await sb.rpc('update_user_last_accessed', { user_email: email, user_name: name } as any);

    const { data: completed } = await sb.from('module_completion')
      .select('category_id, module_id, completed_at').eq('user_id', userId);

    const token = await signHubToken({ a: agencyId, u: String(userId), e: email, n: name });
    return json({ status: 'ok', token, user_id: userId, name, email, approval, completed: completed ?? [] });
  } catch (err) {
    console.error('[hub-session] error', err);
    return json({ error: 'unexpected_error' }, 500);
  }
});

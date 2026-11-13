// All customer-scoped reads and writes for the portal. Identity comes only
// from the signed hub session pass; every query is pinned to that customer's
// user_progress row and agency.
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { serviceClient } from '../_shared/supportAlert.ts';
import { claimsFromRequest, hubIdentifier, signHubToken, cleanEmail, cleanName, type HubClaims } from '../_shared/hubSession.ts';
import { educationVideoCompletedEvent, type VideoCompletedEvent } from '../_shared/educationVideoEvent.ts';

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

const id = (v: unknown, max = 200) =>
  typeof v === 'string' && v.length > 0 && v.length <= max && /^[A-Za-z0-9_:.-]+$/.test(v) ? v : null;
const uuid = (v: unknown) =>
  typeof v === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v) ? v : null;
const iso = (v: unknown) => (typeof v === 'string' && !Number.isNaN(Date.parse(v)) ? new Date(v).toISOString() : null);

const PROFILE_COLS = 'name, email, phone, approval, checklist_minimized, avatar_url';

// Education marks a video done through module_set and does not call
// fire-platform-event. Await the same function onboarding calls so the row
// exists before that client sends its own follow-up, which is then ignored.
async function emitVideoCompleted(event: VideoCompletedEvent) {
  const base = Deno.env.get('SUPABASE_URL');
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  if (!base || !key) {
    console.error('video_completed dispatch skipped: function credentials missing');
    return;
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 4000);
  try {
    const res = await fetch(`${base}/functions/v1/fire-platform-event`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${key}`,
        apikey: key,
      },
      body: JSON.stringify(event),
      signal: controller.signal,
    });
    if (!res.ok) {
      console.error('video_completed dispatch failed', res.status, await res.text().catch(() => ''));
    }
  } catch (err) {
    console.error('video_completed dispatch failed', err);
  } finally {
    clearTimeout(timer);
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  let body: any;
  try { body = await req.json(); } catch { return json({ error: 'Invalid JSON' }, 400); }

  const c: HubClaims | null = await claimsFromRequest(req, body);
  if (!c) return json({ error: 'invalid_session' }, 401);
  // The pass is bound to one agency; a request for another agency is refused.
  if (body.agency_id && body.agency_id !== c.a) return json({ error: 'agency_mismatch' }, 403);

  const sb = serviceClient();
  const who = hubIdentifier(c);
  const p = body.payload ?? {};
  const mine = () => sb.from('user_progress');

  try {
    switch (body.action) {
      // ---------- profile ----------
      case 'profile_get': {
        const { data } = await mine().select(PROFILE_COLS).eq('id', c.u).maybeSingle();
        return json({ profile: data ?? null });
      }
      case 'profile_update': {
        const email = p.email ? cleanEmail(p.email) : null;
        const name = p.name ? cleanName(p.name) : null;
        const phone = typeof p.phone === 'string' && p.phone.trim().length <= 40 ? p.phone.trim() || null : null;
        if ((p.email && !email) || (p.name && !name)) return json({ error: 'Invalid email or name' }, 400);
        if (!email && !name) return json({ error: 'name or email required' }, 400);
        const { error } = await mine().update({ name, email, phone }).eq('id', c.u).eq('agency_id', c.a);
        if (error) throw error;
        const token = await signHubToken({ a: c.a, u: c.u, e: email ?? c.e, n: name ?? c.n });
        return json({ ok: true, token });
      }
      case 'fill_missing': {
        // Adds a name or email only when the customer's row doesn't have one yet.
        const field = p.field === 'name' ? 'name' : p.field === 'email' ? 'email' : null;
        const value = field === 'email' ? cleanEmail(p.value) : cleanName(p.value);
        if (!field || !value) return json({ error: 'Invalid value' }, 400);
        await sb.rpc('update_user_progress_missing_field', {
          identifier_value: who, identifier_type: c.e ? 'email' : 'name', new_field_type: field, new_field_value: value,
        } as any);
        return json({ ok: true });
      }
      case 'set_captured_name': {
        const name = cleanName(p.name);
        if (!name) return json({ error: 'Invalid name' }, 400);
        let q = mine().update({ name }).eq('id', c.u).eq('agency_id', c.a);
        // Name-only sign-ins: only replace an auto-generated guest name.
        if (!c.e) q = q.like('name', 'Guest User #%');
        await q;
        return json({ ok: true });
      }
      case 'avatar_set': {
        const url = typeof p.url === 'string' ? p.url : '';
        const prefix = `${Deno.env.get('SUPABASE_URL')}/storage/v1/object/public/chat-screenshots/hub-avatars/${c.a}/`;
        if (!url.startsWith(prefix) || url.length > 500) return json({ error: 'Invalid photo' }, 400);
        await mine().update({ avatar_url: url } as any).eq('id', c.u);
        return json({ ok: true });
      }
      case 'checklist_minimized_set': {
        await mine().update({ checklist_minimized: p.minimized === true }).eq('id', c.u);
        return json({ ok: true });
      }

      // ---------- progress ----------
      case 'modules_list': {
        const { data } = await sb.from('module_completion')
          .select('category_id, module_id, completed_at').eq('user_id', c.u);
        return json({ completed: data ?? [] });
      }
      case 'module_set': {
        const categoryId = id(p.category_id);
        const moduleId = id(p.module_id);
        if (!categoryId || !moduleId) return json({ error: 'Invalid module' }, 400);
        if (p.completed === true) {
          const { data: existingRows, error: lookupError } = await sb.from('module_completion')
            .select('completed')
            .eq('user_id', c.u)
            .eq('category_id', categoryId)
            .eq('module_id', moduleId)
            .limit(1);
          if (lookupError) throw lookupError;
          const existing = existingRows?.[0] ?? null;
          const { error } = await sb.from('module_completion')
            .upsert({ user_id: c.u, category_id: categoryId, module_id: moduleId });
          if (error) throw error;
          const event = educationVideoCompletedEvent({
            markingComplete: true,
            existing: existing ? { completed: existing.completed ?? null } : null,
            agencyId: c.a,
            categoryId,
            moduleId,
            userEmail: c.e,
            userName: c.n,
            title: typeof p.title === 'string' ? p.title : null,
          });
          if (event) await emitVideoCompleted(event);
        } else {
          const { error } = await sb.from('module_completion').delete()
            .eq('user_id', c.u).eq('category_id', categoryId).eq('module_id', moduleId);
          if (error) throw error;
        }
        return json({ ok: true });
      }
      case 'touch': {
        await sb.rpc('update_user_last_accessed', { user_email: c.e, user_name: c.e ? null : c.n } as any);
        return json({ ok: true });
      }

      // ---------- onboarding checklist ----------
      case 'checklist_completed': {
        const { data } = await sb.rpc('get_user_completed_checklist_items', { p_user_identifier: who, p_agency_id: c.a } as any);
        return json({ items: data ?? [] });
      }
      case 'checklist_toggle': {
        const itemId = uuid(p.item_id);
        if (!itemId) return json({ error: 'Invalid item' }, 400);
        // Only items that belong to this agency's checklist.
        const { data: item } = await sb.from('agency_onboarding_checklist').select('id').eq('id', itemId).eq('agency_id', c.a).maybeSingle();
        if (!item) return json({ error: 'Unknown item' }, 404);
        const { error } = await sb.rpc('toggle_onboarding_checklist_item', {
          p_user_identifier: who, p_agency_id: c.a, p_checklist_item_id: itemId,
        } as any);
        if (error) throw error;
        return json({ ok: true });
      }

      // ---------- live chat ----------
      case 'chat_history': {
        const days = Math.min(Math.max(Number(p.days_back) || 90, 1), 365);
        const [ai, owner] = await Promise.all([
          sb.rpc('get_ai_chat_messages', { p_agency_id: c.a, p_user_identifier: who, p_days_back: days } as any),
          sb.from('agency_owner_messages').select('*').eq('agency_id', c.a).eq('user_identifier', who).order('created_at', { ascending: true }),
        ]);
        return json({ ai: ai.data ?? [], owner: owner.data ?? [] });
      }
      case 'chat_poll': {
        const aiSince = iso(p.ai_since) ?? new Date(Date.now() - 60_000).toISOString();
        const ownerSince = iso(p.owner_since) ?? new Date(Date.now() - 60_000).toISOString();
        const [ai, owner] = await Promise.all([
          sb.from('ai_chat_messages').select('*').eq('agency_id', c.a).eq('user_identifier', who)
            .gt('created_at', aiSince).order('created_at', { ascending: true }).limit(100),
          sb.from('agency_owner_messages').select('*').eq('agency_id', c.a).eq('user_identifier', who)
            .eq('sender_type', 'agency_owner').gt('created_at', ownerSince).order('created_at', { ascending: true }).limit(100),
        ]);
        return json({ ai: ai.data ?? [], owner: owner.data ?? [] });
      }
      case 'chat_save': {
        const role = p.role === 'user' || p.role === 'assistant' ? p.role : null;
        const content = typeof p.content === 'string' ? p.content : '';
        if (!role || !content.trim() || content.length > 50_000) return json({ error: 'Invalid message' }, 400);
        const { error } = await sb.rpc('save_ai_chat_message', {
          p_agency_id: c.a, p_user_identifier: who, p_role: role, p_content: content,
        } as any);
        if (error) throw error;
        return json({ ok: true });
      }

      default:
        return json({ error: 'Unknown action' }, 400);
    }
  } catch (err) {
    console.error('[hub-data]', body?.action, err);
    return json({ error: 'unexpected_error' }, 500);
  }
});

// Client-facing entry point for chat handover alerts. Enriches the existing
// webhook payload with get_support_alert_context (service role) and, when
// asked, marks the chat thread as handed over.
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { postSupportAlert, serviceClient, humanChatEnabled } from '../_shared/supportAlert.ts';
import { claimsFromRequest, hubIdentifier } from '../_shared/hubSession.ts';

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

const str = (v: unknown, max = 4000) => (typeof v === 'string' ? v.slice(0, max) : v == null ? null : String(v).slice(0, max));

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  let body: any;
  try { body = await req.json(); } catch { return json({ error: 'Invalid JSON' }, 400); }

  // Identity and agency come only from the signed hub session pass.
  const claims = await claimsFromRequest(req, body);
  if (!claims) return json({ error: 'invalid_session' }, 401);
  if (body?.agency_id && body.agency_id !== claims.a) return json({ error: 'agency_mismatch' }, 403);
  const agencyId = claims.a;
  const userIdentifier = hubIdentifier(claims);
  if (!userIdentifier) return json({ error: 'invalid_session' }, 401);

  const sb = serviceClient();

  // Human chat off: never hand over (no thread flag, no webhook).
  if (!(await humanChatEnabled(sb, agencyId))) return json({ ok: true, skipped: 'human_chat_disabled' });

  if (body?.mark_handover === true) {
    const now = new Date().toISOString();
    const { error } = await sb.from('chat_threads').upsert(
      { agency_id: agencyId, user_identifier: userIdentifier, handover_requested_at: now, handover_resolved_at: null },
      { onConflict: 'agency_id,user_identifier' },
    );
    if (error) console.error('mark handover failed:', error);
  }

  if (body?.notify === false) return json({ ok: true });

  // Only pass through a bounded set of plain fields from the client payload.
  const raw = body?.payload && typeof body.payload === 'object' ? body.payload : {};
  const base: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(raw).slice(0, 30)) {
    if (/^[a-z_]{1,40}$/.test(k)) base[k] = typeof v === 'object' && v !== null ? v : str(v);
  }
  base.agency_id = agencyId;
  const { data: thread } = await sb.from('chat_threads').select('category')
    .eq('agency_id', agencyId).eq('user_identifier', userIdentifier.toLowerCase()).maybeSingle();
  base.chat_category = (thread as any)?.category ?? 'Other';

  // Final intake. This sends the global handover even when the earlier chat or
  // workflow call set defer_global_handover. issue_description is the real issue.
  await postSupportAlert(base, agencyId, userIdentifier, sb);
  return json({ ok: true });
});

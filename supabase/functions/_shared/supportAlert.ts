// Shared helpers for SaaS Suite "support_alert" handover notifications.
// get_support_alert_context is service-role only, so callers must pass a
// service-role client.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { handoverInputFromSupportAlert, notifyGlobalHandoverFromEnv, withSupportAlertEnvelope } from './globalHandoverWebhook.ts';
import { deliverPlatformSupportAlert, readPlatformSupportExclusion } from './platformSupportExcluded.ts';

export const HANDOVER_WEBHOOK_URL =
  'https://services.leadconnectorhq.com/hooks/T69cI1milcirIORef4Ib/webhook-trigger/f8f632ef-674a-45b2-929d-5342c0b42ba9';

export const serviceClient = () =>
  createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

type Json = Record<string, any>;

// Read the first non-empty value among candidate keys (flat or nested).
const pick = (obj: Json | null | undefined, ...paths: string[]): string | null => {
  for (const p of paths) {
    const v = p.split('.').reduce<any>((o, k) => (o == null ? o : o[k]), obj);
    if (v !== undefined && v !== null && v !== '') return typeof v === 'string' ? v : String(v);
  }
  return null;
};

export async function getSupportAlertFields(
  sb: ReturnType<typeof createClient>,
  agencyId: string,
  userIdentifier: string | null | undefined,
  fallback: { userName?: string | null; userEmail?: string | null } = {},
): Promise<Json> {
  let ctx: Json = {};
  try {
    const { data, error } = await sb.rpc('get_support_alert_context', {
      p_agency_id: agencyId,
      p_user_identifier: userIdentifier || '',
    } as any);
    if (error) {
      console.error('get_support_alert_context error:', error);
    } else {
      ctx = (data as Json) || {};
    }
  } catch (e) {
    console.error('get_support_alert_context failed:', e);
  }

  let mode = pick(ctx, 'human_chat_mode', 'chat_mode');
  if (!mode) {
    const { data } = await sb.rpc('get_agency_chat_config', { p_agency_id: agencyId } as any);
    const row = Array.isArray(data) ? data[0] : data;
    mode = row?.human_chat_mode || null;
  }
  mode = mode === 'self' ? 'self' : 'managed';
  const assigned = {
    name: pick(ctx, 'assigned_to_name', 'assigned_to.name', 'assignment.assigned_to_name'),
    email: pick(ctx, 'assigned_to_email', 'assigned_to.email', 'assignment.assigned_to_email'),
    phone: pick(ctx, 'assigned_to_phone', 'assigned_to.phone', 'assignment.assigned_to_phone'),
  };
  const owner = {
    name: pick(ctx, 'account_owner_name', 'account_owner.name', 'owner_name', 'owner.name'),
    email: pick(ctx, 'account_owner_email', 'account_owner.email', 'owner_email', 'owner.email'),
    phone: pick(ctx, 'account_owner_phone', 'account_owner.phone', 'owner_phone', 'owner.phone'),
  };
  // Managed mode always goes to SaaS Suite.
  const saas = { name: 'SaaSSuite', email: 'team@yoursoftwareonboarding.com', phone: null as string | null };

  // Recipient: managed -> SaaS Suite; self -> assigned person, else the owner.
  const hasAssigned = !!(assigned.name || assigned.email);
  const recipient = mode === 'managed' ? saas : hasAssigned ? assigned : owner;
  const target = mode === 'managed' ? 'saas_suite' : hasAssigned ? 'assigned' : 'owner';

  return {
    notification_type: 'support_alert',
    event_type: 'chat_handover',
    contact_name: pick(ctx, 'contact_name', 'contact.name') || fallback.userName || null,
    contact_email: pick(ctx, 'contact_email', 'contact.email') || fallback.userEmail || null,
    human_chat_mode: mode,
    handled_by: pick(ctx, 'handled_by') || target,
    notify_target: pick(ctx, 'notify_target') || target,
    assigned_default: typeof ctx.assigned_default === 'boolean' ? ctx.assigned_default : null,
    recipient_name: recipient.name,
    recipient_email: recipient.email,
    recipient_phone: recipient.phone,
    assigned_to_name: assigned.name,
    assigned_to_email: assigned.email,
    assigned_to_phone: assigned.phone,
    account_owner_name: owner.name,
    account_owner_email: owner.email,
    account_owner_phone: owner.phone,
  };
}

// Enrich an existing payload (keys untouched) and post it to the webhook.
export async function postSupportAlert(
  base: Json,
  agencyId: string,
  userIdentifier: string | null | undefined,
  sb = serviceClient(),
  options?: { skipGlobalHandover?: boolean; surface?: 'hub' | 'copilot'; threadId?: string | null },
): Promise<'sent' | 'failed' | 'skipped'> {
  // Fail closed: excluded agencies, and a failed lookup, send no LeadConnector ping
  // and no global handover. The chat and the agency's own webhook are untouched.
  const exclusion = await readPlatformSupportExclusion(sb, agencyId);
  const extra = exclusion === 'allowed' ? await getSupportAlertFields(sb, agencyId, userIdentifier, {
    userName: base.user_name ?? null,
    userEmail: base.user_email ?? null,
  }) : null;
  let leadDelivered = false;
  const outcome = await deliverPlatformSupportAlert({
    exclusion,
    postLeadConnector: async () => {
      // Base keys win, except the envelope keys which must be present as specified.
      const payload = withSupportAlertEnvelope(extra, base);
      try {
        const response = await fetch(HANDOVER_WEBHOOK_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
          signal: AbortSignal.timeout(3000),
        });
        leadDelivered = response.ok;
        if (!response.ok) console.error('Support alert webhook rejected', response.status);
      } catch (e) {
        console.error('Support alert webhook error:', e);
      }
    },
    postGlobal: async () => {
      // A deferred handover (the word "help" before the real issue is known) skips the
      // global POST. The LeadConnector alert above still goes out. support-handover-alert
      // sends the global event at the final intake step.
      if (options?.skipGlobalHandover) return;

      // Separate global webhook. Prefer the real email. v2-native passes a rate-limit
      // id (`email:…` / `name:…`); the hub and the dispatcher use the plain email,
      // and both must share one claim.
      try {
        await notifyGlobalHandoverFromEnv(
          handoverInputFromSupportAlert(base, agencyId, userIdentifier, options),
          sb,
        );
      } catch (e) {
        console.error('global handover webhook failed', e);
      }
    },
  });
  if (outcome === 'skipped') {
    console.info('support alert skipped: platform support excluded', agencyId, exclusion);
  }
  return outcome === 'skipped' ? 'skipped' : leadDelivered ? 'sent' : 'failed';
}

const SAAS_EMAIL = 'team@yoursoftwareonboarding.com';

// End-user facing name: SaaS Suite's team is always shown as "Support".
export async function getAssignedName(
  sb: ReturnType<typeof createClient>,
  agencyId: string,
  userIdentifier: string | null | undefined,
): Promise<string | null> {
  if (!userIdentifier) return null;
  const display = (name?: string | null, email?: string | null) => {
    if ((email || '').toLowerCase() === SAAS_EMAIL || /^saas\s?suite$/i.test(name || '')) return 'Support';
    return name || null;
  };
  try {
    const { data } = await sb.rpc('get_chat_assignment', {
      p_agency_id: agencyId,
      p_user_identifier: userIdentifier,
    } as any);
    const row = Array.isArray(data) ? data[0] : data;
    if (row?.assigned_to_name || row?.assigned_to_email) return display(row.assigned_to_name, row.assigned_to_email);
    // No explicit assignment: use SaaS Suite's default (e.g. Advanced -> SaaS Suite team).
    const { data: ctx } = await sb.rpc('get_support_alert_context', {
      p_agency_id: agencyId,
      p_user_identifier: userIdentifier,
    } as any);
    const c = (ctx as Json) || {};
    return display(c.assigned_to_name, c.assigned_to_email);
  } catch {
    return null;
  }
}

// Server-side guard: human chat must be enabled for any handover.
export async function humanChatEnabled(sb: ReturnType<typeof createClient>, agencyId: string): Promise<boolean> {
  try {
    const { data, error } = await sb.rpc('get_agency_chat_config', { p_agency_id: agencyId } as any);
    if (error) return true;
    const row = Array.isArray(data) ? data[0] : data;
    return row?.human_chat_enabled ?? true;
  } catch {
    return true;
  }
}

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { supportExtraFields } from '../_shared/support-context.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface SupportTicketPayload {
  event_type: 'ticket_created' | 'ticket_status_updated';
  ticket: {
    id: string;
    ticket_number: number;
    agency_id: string;
    customer_name: string;
    customer_email: string;
    issue_category: string;
    request_text: string;
    status: string;
    created_at: string;
    updated_at: string;
  };
  previous_status?: string;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const payload: SupportTicketPayload = await req.json();
    
    console.log('Received support ticket webhook request:', payload);

    // Initialize Supabase client to look up the webhook URL
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Find the user by agency_id to get their webhook URLs
    const { data: userData, error: userError } = await supabase
      .from('saas_suite_users')
      .select('support_webhook_url, support_updates_webhook_url')
      .or(`agency_id.eq.${payload.ticket.agency_id},agency_id_basic.eq.${payload.ticket.agency_id},agency_id_advanced.eq.${payload.ticket.agency_id},agency_id_elite.eq.${payload.ticket.agency_id}`)
      .maybeSingle();

    if (userError) {
      console.error('Error fetching user webhook URL:', userError);
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'Failed to fetch webhook URL' 
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const primaryUrl = (userData?.support_webhook_url || '').trim();
    const updatesUrl = (userData?.support_updates_webhook_url || '').trim();
    const isUpdate = payload.event_type !== 'ticket_created';

    // Ticket creation always goes to the primary webhook.
    // Updates (status changes, replies, new messages) go to the updates webhook when one exists,
    // otherwise they fall back to the primary webhook.
    const targets = isUpdate
      ? (updatesUrl ? [updatesUrl] : (primaryUrl ? [primaryUrl] : []))
      : (primaryUrl ? [primaryUrl] : []);

    if (!targets.length) {
      console.log('No webhook URL configured for this agency');
      return new Response(JSON.stringify({ 
        success: true, 
        message: 'No webhook URL configured' 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let outPayload: Record<string, unknown> = payload as unknown as Record<string, unknown>;
    try {
      let assignedTo: string | null = null;
      if (payload.ticket?.id) {
        const { data: t } = await supabase.from('support_tickets').select('assigned_to').eq('id', payload.ticket.id).maybeSingle();
        assignedTo = t?.assigned_to ?? null;
      }
      const extra = await supportExtraFields(supabase, payload.ticket.agency_id, { ticketAssignedTo: assignedTo });
      outPayload = { ...outPayload, ...extra };
    } catch (e) {
      console.error('extra fields failed:', e);
    }

    const results: { url: string; ok: boolean; status?: number; error?: string }[] = [];
    for (const webhookUrl of targets) {
      console.log('Sending webhook to:', webhookUrl);
      try {
        const webhookResponse = await fetch(webhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(outPayload),
        });
        if (!webhookResponse.ok) {
          console.error('Webhook call failed:', await webhookResponse.text());
        }
        results.push({ url: webhookUrl, ok: webhookResponse.ok, status: webhookResponse.status });
      } catch (err) {
        console.error('Webhook call threw:', err);
        results.push({ url: webhookUrl, ok: false, error: err instanceof Error ? err.message : String(err) });
      }
    }

    const anyOk = results.some((r) => r.ok);
    return new Response(JSON.stringify({ success: anyOk, results }), {
      status: anyOk ? 200 : 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in notify-support-webhook:', error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

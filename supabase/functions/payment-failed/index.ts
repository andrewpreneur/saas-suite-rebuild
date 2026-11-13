import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'jsr:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const GRACE_DAYS = 14;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body = await req.json().catch(() => ({}));
    const { user_email, webhook_secret } = body as { user_email?: string; webhook_secret?: string };

    const expectedSecret = Deno.env.get('WEBHOOK_SECRET');
    if (expectedSecret && webhook_secret !== expectedSecret) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!user_email || typeof user_email !== 'string') {
      return new Response(JSON.stringify({ error: 'Invalid user_email parameter' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const normalizedEmail = user_email.trim().toLowerCase();
    console.log('[PAYMENT-FAILED] Starting/extending grace for:', normalizedEmail);

    const { data, error } = await supabase.rpc('start_payment_grace', {
      user_email: normalizedEmail,
      grace_days: GRACE_DAYS,
    });

    if (error) {
      console.error('[PAYMENT-FAILED] RPC error:', error);
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const result = data as {
      success: boolean;
      skipped?: boolean;
      reason?: string;
      already_in_grace?: boolean;
      grace_until?: string;
      failure_count?: number;
      error?: string;
    };

    console.log('[PAYMENT-FAILED] Result:', result);
    // Note: the "update your card" email is fired from the GHL workflow itself,
    // not from this function. Do not POST a webhook here.

    return new Response(JSON.stringify({ ...result, grace_days: GRACE_DAYS }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('[PAYMENT-FAILED] Error:', error);
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
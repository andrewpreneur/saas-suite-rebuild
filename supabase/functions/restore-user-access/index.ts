import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'jsr:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { user_email, webhook_secret, plan } = await req.json();

    // Optional: Validate webhook secret
    const expectedSecret = Deno.env.get('WEBHOOK_SECRET');
    if (expectedSecret && webhook_secret !== expectedSecret) {
      console.error('Invalid webhook secret');
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }), 
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!user_email || typeof user_email !== 'string') {
      console.error('Invalid user_email:', user_email);
      return new Response(
        JSON.stringify({ error: 'Invalid user_email parameter' }), 
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Default to ADVANCED if no plan specified (backwards compatible)
    const userPlan = plan || 'ADVANCED';
    console.log('Restoring access for user:', user_email, 'with plan:', userPlan);

    // Call the restore_user_access function with plan
    const { data, error } = await supabase.rpc('restore_user_access', {
      user_email: user_email,
      user_plan: userPlan
    });

    if (error) {
      console.error('Error restoring user access:', error);
      return new Response(
        JSON.stringify({ error: error.message }), 
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!data) {
      console.warn('User not found:', user_email);
      return new Response(
        JSON.stringify({ success: false, message: 'User not found' }), 
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Successfully restored access for:', user_email, 'plan:', userPlan);

    return new Response(
      JSON.stringify({ success: true, message: 'User access restored successfully', plan: userPlan }), 
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in restore-user-access function:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'An unexpected error occurred' }), 
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

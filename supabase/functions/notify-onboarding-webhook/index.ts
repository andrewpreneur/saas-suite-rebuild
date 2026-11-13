import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { logCustomerMessage } from "../_shared/journey-log.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { user_id, email, onboarding_completed } = await req.json();
    
    console.log('Received onboarding completion notification:', { user_id, email, onboarding_completed });

    // Call the external webhook
    const webhookResponse = await fetch(
      'https://services.leadconnectorhq.com/hooks/T69cI1milcirIORef4Ib/webhook-trigger/c80002d8-3a02-4e62-8f41-19256fdc1414',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          user_id,
          email,
          onboarding_completed
        })
      }
    );

    if (!webhookResponse.ok) {
      console.error('Webhook call failed:', await webhookResponse.text());
      await logCustomerMessage({
        userEmail: email,
        channel: "webhook",
        templateKey: "onboarding_completed",
        provider: "ghl",
        status: "failed",
        source: "notify-onboarding-webhook",
        detail: `http_${webhookResponse.status}`,
      });
      throw new Error(`Webhook failed with status: ${webhookResponse.status}`);
    }

    await logCustomerMessage({
      userEmail: email,
      channel: "webhook",
      templateKey: "onboarding_completed",
      provider: "ghl",
      status: "sent",
      source: "notify-onboarding-webhook",
    });
    console.log('Webhook called successfully');

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error in notify-onboarding-webhook:', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
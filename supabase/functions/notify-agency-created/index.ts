import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

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
    const { email, agency_id } = await req.json();
    console.log('Notifying webhook for new agency:', { email, agency_id });

    if (!email || !agency_id) {
      throw new Error('Email and agency_id are required');
    }

    // Construct the custom agency URL
    const agencyUrl = `${Deno.env.get('SITE_URL') || 'https://localhost:8080'}/${agency_id}`;

    // Post to the webhook
    const webhookResponse = await fetch('https://services.leadconnectorhq.com/hooks/T69cI1milcirIORef4Ib/webhook-trigger/d6651ea1-5344-42d4-a295-2aefd823cf46', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: email,
        custom_agency_url: agencyUrl,
        agency_id: agency_id,
        timestamp: new Date().toISOString()
      })
    });

    if (!webhookResponse.ok) {
      throw new Error(`Webhook call failed: ${webhookResponse.status} ${webhookResponse.statusText}`);
    }

    console.log('Successfully notified webhook for agency:', agency_id);

    return new Response(
      JSON.stringify({ 
        success: true, 
        agency_id, 
        agency_url: agencyUrl 
      }), 
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  } catch (error) {
    console.error('Error in notify-agency-created function:', error);
    return new Response(
      JSON.stringify({ 
        error: error.message 
      }), 
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
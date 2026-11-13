import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { logCustomerMessage } from "../_shared/journey-log.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const WEBHOOK_URL = 'https://services.leadconnectorhq.com/hooks/T69cI1milcirIORef4Ib/webhook-trigger/5fc964e8-0648-4c66-82ba-40ab19cd4863';

// Delay helper for throttling
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { recipients, subject, body, from_email } = await req.json();
    
    console.log('Sending admin emails via webhook:', { 
      recipientCount: recipients?.length, 
      subject, 
      from_email 
    });

    if (!recipients || !Array.isArray(recipients) || recipients.length === 0) {
      throw new Error('Recipients are required');
    }

    if (!subject || !body) {
      throw new Error('Subject and body are required');
    }

    const results = {
      success: 0,
      failed: 0,
      errors: [] as string[]
    };

    // Send individual webhook request for each recipient with throttling
    for (let i = 0; i < recipients.length; i++) {
      const recipient = recipients[i];
      
      try {
        console.log(`Sending email ${i + 1}/${recipients.length} to: ${recipient}`);
        
        const webhookResponse = await fetch(WEBHOOK_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            recipient: recipient,
            subject,
            body,
            ...(from_email ? { from_email } : {}),
            sent_at: new Date().toISOString()
          })
        });

        await logCustomerMessage({
          userEmail: typeof recipient === "string" ? recipient : null,
          channel: "webhook",
          templateKey: "admin_email",
          subject,
          provider: "ghl",
          status: webhookResponse.ok ? "sent" : "failed",
          source: "send-admin-email",
          detail: webhookResponse.ok ? null : `http_${webhookResponse.status}`,
        });
        if (!webhookResponse.ok) {
          const errorText = await webhookResponse.text();
          console.error(`Webhook failed for ${recipient}:`, errorText);
          results.failed++;
          results.errors.push(`${recipient}: ${webhookResponse.status}`);
        } else {
          console.log(`Email sent successfully to: ${recipient}`);
          results.success++;
        }
      } catch (err) {
        console.error(`Error sending to ${recipient}:`, err);
        results.failed++;
        results.errors.push(`${recipient}: ${err instanceof Error ? err.message : 'Unknown error'}`);
        await logCustomerMessage({
          userEmail: typeof recipient === "string" ? recipient : null,
          channel: "webhook",
          templateKey: "admin_email",
          subject,
          provider: "ghl",
          status: "failed",
          source: "send-admin-email",
          detail: "request_failed",
        });
      }

      // Throttle: wait 500ms between requests to avoid overwhelming the webhook
      if (i < recipients.length - 1) {
        await delay(500);
      }
    }

    console.log('Email batch completed:', results);

    return new Response(JSON.stringify({ 
      success: true, 
      message: `Sent ${results.success} email(s), ${results.failed} failed`,
      details: results
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error in send-admin-email:', error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

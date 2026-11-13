import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const anthropicApiKey = Deno.env.get('ANTHROPIC_API_KEY');
const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const PLAN_CONTEXT: Record<string, string> = {
  STARTER: `The Starter plan is the entry-level SaaSSuite plan. Users get:
- White-labeled onboarding portal with training videos and checklist
- Client Hub for managing end-users
- AI Chat Support (GHL-powered)
- Video Library with curated training content
- Mobile-friendly interface
- Basic branding (colors only)
- Up to 3 onboarding users
Starter users do NOT have: Marketing Tool, Email Warmup, Free Leads, Branding Tool, Support Ticketing, Advanced AI features, or custom onboarding videos.`,

  BASIC: `The Basic plan is the mid-tier SaaSSuite plan. Users get everything in Starter, plus:
- Marketing Tool (AI-powered ad copy, offer creation, and cold email sequence generator)
- Support Ticketing system for their clients
- Custom onboarding videos (upload their own training content)
- Branded AI Support with custom training docs
- Daily Checklist for their agency users
- Custom Links on the home dashboard
- Announcements panel
- Welcome video on home screen
- Up to 10 onboarding users
- Full branding customization
Basic users do NOT have: Email Warmup, Free Leads, or the standalone Branding Tool.`,

  ADVANCED: `The Advanced plan is the top-tier SaaSSuite plan. Users get everything in Basic, plus:
- Email Warmup service (guaranteed inbox placement)
- Free Leads tool (get targeted business leads)
- Login Tracking (see when clients log in)
- Client Hub with chat intervention
- Tips Bot (automated tips for their users)
- Unlimited onboarding users
- Priority support
- All branding and customization features
- Dynamic CSS/JS installation (Push to GHL)
- Menu link removal and auto-navigation
- Custom AI personality and training docs`
};

const RECENT_FEATURES = `Recent SaaSSuite updates and features (use these for feature release and notification emails):
1. Dynamic CSS Installation - Agencies can now install branding and menu config via a single URL instead of pasting code blocks. Push to GHL button makes it instant.
2. Branding Tool (standalone product) - Available as a separate purchase for non-SaaSSuite users. Generates custom CSS for GHL branding.
3. Email Warmup Service - 4-week automated warmup with completion tracking. Users see progress bar and get notified when ready to send.
4. AI Chat CoPilot - Contextual AI assistant that helps users navigate the platform with smart suggestions.
5. V2 Navigation - Redesigned mobile-first navigation with bottom tabs (Home, Education, Support).
6. Client Hub Enhancements - Chat intervention panel lets agency owners message their end-users directly.
7. Tips Bot - Automated tips system that shows contextual tips based on user behavior and feature usage.
8. Marketing Tool AI - Generate 6-email cold outreach sequences, AI ad copy, and offer creation all in one place.
9. Support Ticketing - Built-in ticket system for agencies to manage client support requests.
10. Custom Onboarding Videos - Upload custom training videos organized by module for different plan tiers.
11. Login Tracking - Track when end-users log in with detailed activity metrics.
12. Onboarding Checklist - Customizable step-by-step checklists with linked videos and external resources.
13. Daily Checklist - Editable 3-item daily task list for agency users.
14. Push to GHL Branding - One-click button to push branding colors and menu config live to GoHighLevel.
15. Affiliate Program - 30% recurring commissions + free SaaSSuite access for the first referral.`;

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    if (!anthropicApiKey) {
      throw new Error('ANTHROPIC_API_KEY is not configured');
    }

    const { plan, email_type, count = 1, save_to_db = false, week_label, created_at, topic_focus } = await req.json();

    if (!plan || !PLAN_CONTEXT[plan]) {
      throw new Error('Invalid plan. Must be STARTER, BASIC, or ADVANCED');
    }

    const validTypes = ['feature_release', 'feature_notification', 'helpful_tip'];
    if (email_type && !validTypes.includes(email_type)) {
      throw new Error('Invalid email_type. Must be feature_release, feature_notification, or helpful_tip');
    }

    const typeInstructions: Record<string, string> = {
      feature_release: "Write a feature release announcement email. Highlight a specific new feature, explain what it does, why it matters, and how to use it. Be excited but not over-the-top.",
      feature_notification: "Write a feature notification email that reminds users about an existing feature they might not be using. Explain the value and give a quick how-to.",
      helpful_tip: "Write a helpful tip email that shares a practical strategy or workflow tip for getting more value from SaaSSuite. Be specific and actionable."
    };

    const emails = [];

    for (let i = 0; i < count; i++) {
      const currentType = email_type || validTypes[i % validTypes.length];
      
      const systemPrompt = `You are Andrew, the founder of SaaSSuite. You write personal, conversational emails to your users — like a quick note from a friend who built something for them. 

TONE RULES:
- Write like a personal memo, NOT a marketing email
- Use first person ("I", "we")  
- Keep it casual but professional
- Short paragraphs, easy to scan
- No excessive emojis or ALL CAPS
- Sign off as "Andrew" or "Andrew from SaaSSuite"
- Feel genuine and helpful, not salesy
- Reference the user's specific plan features when relevant

${typeInstructions[currentType]}

PLAN CONTEXT (the user is on the ${plan} plan):
${PLAN_CONTEXT[plan]}

RECENT FEATURES AND UPDATES:
${RECENT_FEATURES}

${topic_focus ? `IMPORTANT - TOPIC FOCUS: Write this email specifically about: ${topic_focus}` : ''}

Respond with ONLY a raw JSON object (no markdown, no code blocks, no explanation):
{
  "subject": "...",
  "body": "...",
  "email_type": "${currentType}"
}`;

      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'x-api-key': anthropicApiKey,
          'anthropic-version': '2023-06-01',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 1024,
          system: systemPrompt,
          messages: [
            {
              role: 'user',
              content: `Generate a ${currentType.replace('_', ' ')} email for ${plan} plan users. Make it specific to features they actually have access to. The email body should use \\n for line breaks. Keep it under 200 words.`
            }
          ],
        }),
      });

      const data = await response.json();
      
      if (!response.ok) {
        console.error('Anthropic API error:', data);
        throw new Error(data.error?.message || `Anthropic API request failed (${response.status})`);
      }

      const content = data.content?.[0]?.text;
      if (!content) {
        throw new Error('No content in Anthropic response');
      }

      let parsed;
      try {
        parsed = JSON.parse(content);
      } catch {
        const match = content.match(/\{[\s\S]*\}/);
        if (match) {
          parsed = JSON.parse(match[0]);
        } else {
          throw new Error('Failed to parse AI response');
        }
      }

      emails.push(parsed);
    }

    // Optionally save to DB
    if (save_to_db) {
      const supabase = createClient(supabaseUrl, supabaseServiceKey);
      for (const email of emails) {
        await supabase.from('platform_emails').insert({
          plan,
          email_type: email.email_type,
          subject: email.subject,
          body: email.body,
          week_label: week_label || null,
          ...(created_at ? { created_at } : {}),
        });
      }
    }

    return new Response(JSON.stringify({ emails }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error:', error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

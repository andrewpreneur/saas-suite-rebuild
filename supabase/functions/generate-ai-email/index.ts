import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const openAIApiKey = Deno.env.get('OPENAI_API_KEY');

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
    const { targeting, situation, solution, includeContactCity = true } = await req.json();

    console.log('Generating AI emails with inputs:', { targeting, situation, solution, includeContactCity });

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { 
            role: 'system', 
            content: `You are an expert cold email copywriter. Create a 6-email cold outreach sequence that is compelling and professional.

CRITICAL RULES:
1. ${includeContactCity ? 'You must preserve ALL {{variable}} placeholders EXACTLY as shown ({{contact.city}}, {{contact.first_name}})' : 'You must preserve {{contact.first_name}} placeholder EXACTLY as shown. Remove ALL references to {{contact.city}}'}
2. DO NOT replace or remove the required placeholders
3. Replace [YOUR SERVICE], [OFFER STATEMENT], [SOLVE COMMON PROBLEM], [RESULT/CASE STUDY], [RELATED BUSINESS FUNCTION], [BENEFIT STATEMENT] with actual content based on the targeting, situation, and solution provided
4. ${includeContactCity ? 'Keep city references as provided in templates' : 'Remove all city-specific references and make emails location-agnostic'}
5. Respond with ONLY a raw JSON object (no markdown, no code blocks)

The JSON object must have this structure:
{
  "email1": { "subject": "...", "body": "..." },
  "email2": { "subject": "...", "body": "..." },
  "email3": { "subject": "...", "body": "..." },
  "email4": { "subject": "...", "body": "..." },
  "email5": { "subject": "...", "body": "..." },
  "email6": { "subject": "...", "body": "..." }
}

Follow this structure for each email:

${includeContactCity ? `Email 1:
Subject: Helping businesses in {{contact.city}} with [YOUR SERVICE]
Body: Hi {{contact.first_name}},\\n\\nI came across your business while looking at companies in the {{contact.city}} area.\\n\\nI work with local businesses to [OFFER STATEMENT]. Businesses like yours are often looking for ways to [SOLVE COMMON PROBLEM], and [YOUR SERVICE] is built exactly for that.\\n\\nWould you be open to a quick 10-minute conversation this week to see if this could help?\\n\\nThanks,

Email 2:
Subject: Worth a chat about [YOUR SERVICE]?
Body: Hi {{contact.first_name}},\\n\\nJust following up on my last note. We help businesses like yours [RESULT/CASE STUDY], and I'd love to learn more about what you're currently doing for [RELATED BUSINESS FUNCTION].\\n\\nIs this something you'd be interested in exploring?\\n\\nThanks,

Email 3:
Subject: Quick question for {{contact.city}} businesses
Body: Hi {{contact.first_name}},\\n\\nI wouldn't keep reaching out if I didn't believe [YOUR SERVICE] could help your business.\\n\\nWe've seen businesses in {{contact.city}} use it to [RESULT/CASE STUDY], saving time and driving more customers in the door.\\n\\nWould you have 15 minutes to see if this could apply to your business as well?\\n\\nThanks,

Email 4:
Subject: A simple way to [SOLVE COMMON PROBLEM]
Body: Hi {{contact.first_name}},\\n\\nOne of the biggest challenges businesses tell us about is [COMMON PROBLEM].\\n\\nOur clients use [YOUR SERVICE] to [RESULT/CASE STUDY]. It's a simple way to [BENEFIT STATEMENT] without adding more to your plate.\\n\\nDoes this sound worth a conversation?\\n\\nThanks,

Email 5:
Subject: Exploring [YOUR SERVICE] in {{contact.city}}
Body: Hi {{contact.first_name}},\\n\\nWe work with businesses internationally but are currently expanding into {{contact.city}}.\\n\\nIf [OFFER STATEMENT], I'd love to connect. Even if now isn't the perfect time, we can share a few insights on how other businesses are using [YOUR SERVICE] to grow.\\n\\nWould you like to set up a quick call?\\n\\nThanks,

Email 6:
Subject: Final check-in
Body: Hi {{contact.first_name}},\\n\\nThis will be my last email.\\n\\nAre you planning to explore [YOUR SERVICE] this year? Many of our clients waited and later said they wished they had started sooner.\\n\\nIf it's not a priority, no worries—I appreciate your time. But if you'd like to see how this could fit into your business, I'd be glad to chat.\\n\\nTake care,` : `Email 1:
Subject: Helping businesses with [YOUR SERVICE]
Body: Hi {{contact.first_name}},\\n\\nI came across your business and wanted to reach out.\\n\\nI work with businesses to [OFFER STATEMENT]. Companies like yours are often looking for ways to [SOLVE COMMON PROBLEM], and [YOUR SERVICE] is built exactly for that.\\n\\nWould you be open to a quick 10-minute conversation this week to see if this could help?\\n\\nThanks,

Email 2:
Subject: Worth a chat about [YOUR SERVICE]?
Body: Hi {{contact.first_name}},\\n\\nJust following up on my last note. We help businesses like yours [RESULT/CASE STUDY], and I'd love to learn more about what you're currently doing for [RELATED BUSINESS FUNCTION].\\n\\nIs this something you'd be interested in exploring?\\n\\nThanks,

Email 3:
Subject: Quick question about [YOUR SERVICE]
Body: Hi {{contact.first_name}},\\n\\nI wouldn't keep reaching out if I didn't believe [YOUR SERVICE] could help your business.\\n\\nWe've seen businesses use it to [RESULT/CASE STUDY], saving time and driving more customers.\\n\\nWould you have 15 minutes to see if this could apply to your business as well?\\n\\nThanks,

Email 4:
Subject: A simple way to [SOLVE COMMON PROBLEM]
Body: Hi {{contact.first_name}},\\n\\nOne of the biggest challenges businesses tell us about is [COMMON PROBLEM].\\n\\nOur clients use [YOUR SERVICE] to [RESULT/CASE STUDY]. It's a simple way to [BENEFIT STATEMENT] without adding more to your plate.\\n\\nDoes this sound worth a conversation?\\n\\nThanks,

Email 5:
Subject: Exploring [YOUR SERVICE]
Body: Hi {{contact.first_name}},\\n\\nWe work with businesses across multiple industries and regions.\\n\\nIf [OFFER STATEMENT], I'd love to connect. Even if now isn't the perfect time, we can share a few insights on how other businesses are using [YOUR SERVICE] to grow.\\n\\nWould you like to set up a quick call?\\n\\nThanks,

Email 6:
Subject: Final check-in
Body: Hi {{contact.first_name}},\\n\\nThis will be my last email.\\n\\nAre you planning to explore [YOUR SERVICE] this year? Many of our clients waited and later said they wished they had started sooner.\\n\\nIf it's not a priority, no worries—I appreciate your time. But if you'd like to see how this could fit into your business, I'd be glad to chat.\\n\\nTake care,`}`
          },
          { 
            role: 'user', 
            content: `Create a 6-email cold outreach sequence for:
Target audience: ${targeting}
Current situation: ${situation}
Service/solution: ${solution}

Remember: ${includeContactCity ? 'Keep {{contact.city}} and {{contact.first_name}} EXACTLY as is' : 'Keep {{contact.first_name}} EXACTLY as is and remove all {{contact.city}} references'}. Only replace the [BRACKETED] placeholders with relevant content.

Respond with raw JSON only - no markdown, no code blocks.`
          }
        ],
        temperature: 0.7,
        max_tokens: 2000,
      }),
    });

    const data = await response.json();
    
    if (!response.ok) {
      console.error('OpenAI API error:', data);
      throw new Error(data.error?.message || 'OpenAI API request failed');
    }

    const generatedContent = data.choices[0].message.content;
    console.log('Raw OpenAI response:', generatedContent);
    
    // Parse the JSON response - handle both raw JSON and markdown-wrapped JSON
    let parsedContent;
    try {
      // First try to parse as-is
      parsedContent = JSON.parse(generatedContent);
    } catch (parseError) {
      console.log('Direct JSON parse failed, trying to extract from markdown...');
      try {
        // Try to extract JSON from markdown code blocks
        const jsonMatch = generatedContent.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/);
        if (jsonMatch) {
          console.log('Found JSON in markdown, extracting...');
          parsedContent = JSON.parse(jsonMatch[1]);
        } else {
          // Try to find JSON object without markdown
          const jsonObjectMatch = generatedContent.match(/\{[\s\S]*\}/);
          if (jsonObjectMatch) {
            console.log('Found JSON object, parsing...');
            parsedContent = JSON.parse(jsonObjectMatch[0]);
          } else {
            throw new Error('No valid JSON found in response');
          }
        }
      } catch (secondParseError) {
        console.error('Failed to extract JSON from response:', secondParseError);
        throw new Error('Failed to parse email sequence from AI response');
      }
    }

    console.log('Generated email sequence:', parsedContent);

    return new Response(JSON.stringify(parsedContent), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error in generate-ai-email function:', error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

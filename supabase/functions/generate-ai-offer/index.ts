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
    const { targeting, situation, solution } = await req.json();

    console.log('Generating AI offer with inputs:', { targeting, situation, solution });

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
            content: `You are a marketing expert who creates compelling offer copy. You must respond with ONLY a raw JSON object (no markdown formatting, no code blocks) containing exactly these fields:
            - shortVersion: A one-sentence offer following this format: "I specialize in helping (X industry/subniche) in a (specific situation) get a (clear outcome) in (timeframe) using our (unique mechanism)"
            - longVersion: An expanded version following this format: "I specialize in helping (X industry/subniche) in a (specific situation) get a (clear outcome) in (timeframe) (without the thing that frustrates them the most) using our (unique mechanism)"
            - headline: A short, punchy headline (under 10 words)
            - subheadline: A compelling sub-headline (under 20 words)
            
            Be creative and specific. Don't just fill in templates - craft compelling, unique offers that truly resonate with the target audience. Focus on specific pain points, tangible outcomes, and compelling timeframes. Return ONLY the JSON object with no additional text or formatting.`
          },
          { 
            role: 'user', 
            content: `Create a compelling offer for:
            Target audience: ${targeting}
            Current situation: ${situation}
            Service/solution: ${solution}
            
            Respond with raw JSON only - no markdown, no code blocks, no additional text.`
          }
        ],
        temperature: 0.7,
        max_tokens: 500,
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
        console.error('Raw response content:', generatedContent);
        // Intelligent fallback using actual user inputs
        parsedContent = {
          shortVersion: `I specialize in helping ${targeting} who are ${situation} achieve remarkable results in 30 days using our ${solution}`,
          longVersion: `I specialize in helping ${targeting} who are ${situation} achieve remarkable results in 30 days without the frustration of traditional approaches using our ${solution}`,
          headline: "Transform Your Business Today",
          subheadline: "Get results fast with our proven solution"
        };
      }
    }

    console.log('Generated offer content:', parsedContent);

    return new Response(JSON.stringify(parsedContent), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error in generate-ai-offer function:', error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : 'Unknown error',
      shortVersion: "Error generating content",
      longVersion: "Error generating content", 
      headline: "Try Again",
      subheadline: "Please try generating your offer again"
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
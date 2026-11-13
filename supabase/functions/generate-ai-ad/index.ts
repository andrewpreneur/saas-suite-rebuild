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
    if (!openAIApiKey) {
      throw new Error('OpenAI API key is not configured');
    }

    const { content, type } = await req.json();
    
    if (!content) {
      throw new Error('Content is required');
    }

    console.log('Generating ad image for:', { content, type });

    // Create a dynamic prompt based on the content type
    let prompt = `Create a modern, professional advertisement image in 9:16 aspect ratio. `;
    
    if (type === "headline") {
      prompt += `Use this headline and subheadline text: "${content}"`;
    } else {
      prompt += `Use this offer text: "${content}"`;
    }
    
    prompt += `

Design requirements:
- Clean, modern aesthetic with subtle glow effects
- Incorporate the text prominently and readably
- Add a call-to-action button or text saying "Click to Learn More" at the bottom
- Use a gradient background with soft, professional colors
- Ensure text is highly readable with good contrast
- Keep the design simple and uncluttered
- Professional business/marketing style
- Subtle lighting effects and glows around text elements`;

    const response = await fetch('https://api.openai.com/v1/images/generations', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-image-1',
        prompt: prompt,
        n: 1,
        size: '1024x1536', // Fixed: 9:16 aspect ratio supported size
        quality: 'high',
        output_format: 'png'
      }),
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error('OpenAI API error:', errorData);
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    console.log('Successfully generated ad image');

    // OpenAI gpt-image-1 returns base64 data
    const imageData = data.data[0].b64_json;
    
    return new Response(JSON.stringify({ 
      imageUrl: `data:image/png;base64,${imageData}`,
      success: true 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in generate-ai-ad function:', error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : 'Unknown error',
      success: false 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
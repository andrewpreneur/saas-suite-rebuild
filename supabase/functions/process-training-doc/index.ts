import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const CHUNK_SIZE = 1000; // Characters per chunk
const CHUNK_OVERLAP = 200; // Overlap between chunks

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { agency_id, tier, training_doc_url, content: rawContent } = await req.json();

    if (!agency_id) {
      return new Response(
        JSON.stringify({ error: 'agency_id is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openaiApiKey) {
      throw new Error('OPENAI_API_KEY not configured');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const chunkTier = tier || 'basic';

    // First, delete existing chunks for this agency+tier
    let deleteQuery = supabase
      .from('training_doc_chunks')
      .delete()
      .eq('agency_id', agency_id)
      .eq('tier', chunkTier);
    const { error: deleteError } = await deleteQuery;

    if (deleteError) {
      console.error('Error deleting old chunks:', deleteError);
    }

    // Determine content source: raw content, URL, or neither
    let docContent = '';

    if (rawContent && rawContent.trim() !== '') {
      // Use raw content directly (e.g. compiled video transcriptions)
      docContent = rawContent;
      console.log(`Using raw content, length: ${docContent.length} characters`);
    } else if (training_doc_url && training_doc_url.trim() !== '') {
      // Fetch from URL
      console.log(`Fetching document from: ${training_doc_url}`);
      const docResponse = await fetch(training_doc_url);
      
      if (!docResponse.ok) {
        throw new Error(`Failed to fetch document: ${docResponse.status} ${docResponse.statusText}`);
      }

      docContent = await docResponse.text();
      console.log(`Document fetched, length: ${docContent.length} characters`);
    } else {
      // No content provided, just clear the chunks and return
      console.log(`Cleared training doc chunks for agency: ${agency_id}`);
      return new Response(
        JSON.stringify({ success: true, message: 'Training doc cleared', chunks_created: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Split into chunks with overlap
    const chunks: string[] = [];
    let start = 0;
    
    while (start < docContent.length) {
      const end = Math.min(start + CHUNK_SIZE, docContent.length);
      chunks.push(docContent.slice(start, end));
      start = end - CHUNK_OVERLAP;
      if (start >= docContent.length - CHUNK_OVERLAP) break;
    }

    console.log(`Created ${chunks.length} chunks`);

    // Generate embeddings and store chunks
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      
      // Generate embedding using OpenAI
      const embeddingResponse = await fetch('https://api.openai.com/v1/embeddings', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${openaiApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'text-embedding-3-small',
          input: chunk,
        }),
      });

      if (!embeddingResponse.ok) {
        const errorText = await embeddingResponse.text();
        throw new Error(`OpenAI embedding failed: ${errorText}`);
      }

      const embeddingData = await embeddingResponse.json();
      const embedding = embeddingData.data[0].embedding;

      // Store chunk with embedding
      const { error: insertError } = await supabase
        .from('training_doc_chunks')
        .insert({
          agency_id,
          tier: chunkTier,
          chunk_index: i,
          content: chunk,
          embedding: JSON.stringify(embedding),
        });

      if (insertError) {
        console.error(`Error inserting chunk ${i}:`, insertError);
        throw insertError;
      }

      console.log(`Stored chunk ${i + 1}/${chunks.length}`);
    }

    console.log(`Successfully processed training doc for agency: ${agency_id}`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Training doc processed successfully',
        chunks_created: chunks.length 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error processing training doc:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const FANBASIS_API_URL = 'https://www.fanbasis.com/public-api/checkout-sessions/embedded'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const FANBASIS_API_KEY = Deno.env.get('FANBASIS_API_KEY')
    if (!FANBASIS_API_KEY) {
      throw new Error('FANBASIS_API_KEY is not configured')
    }

    const { productId, attribution } = await req.json()
    if (!productId || typeof productId !== 'string') {
      return new Response(
        JSON.stringify({ error: 'product_id is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const attributionMeta: Record<string, string> = {}
    if (attribution && typeof attribution === 'object') {
      for (const [k, v] of Object.entries(attribution as Record<string, unknown>)) {
        if (typeof v === 'string' && v.trim()) attributionMeta[k] = v.slice(0, 500)
      }
    }

    const response = await fetch(FANBASIS_API_URL, {
      method: 'POST',
      headers: {
        'x-api-key': FANBASIS_API_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        product_id: productId,
        metadata: { source: 'saassuite_home', ...attributionMeta },
      }),
    })

    const data = await response.json()

    if (!response.ok) {
      console.error('FanBasis API error:', response.status, JSON.stringify(data))
      return new Response(
        JSON.stringify({ error: `FanBasis API error [${response.status}]`, details: data }),
        { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const checkoutSecret = data?.data?.checkout_session_secret
    if (!checkoutSecret) {
      console.error('Unexpected FanBasis response structure:', JSON.stringify(data))
      return new Response(
        JSON.stringify({ error: 'No checkout secret in FanBasis response' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    return new Response(
      JSON.stringify({ checkoutSecret }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('Error creating checkout session:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

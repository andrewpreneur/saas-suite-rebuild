const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const BASES: Record<string, string> = {
  production: "https://www.fanbasis.com",
  sandbox: "https://qa.dev-fan-basis.com",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const payload = await req.json().catch(() => null);
    if (!payload || typeof payload !== "object") {
      return json({ error: "Invalid JSON body" }, 400);
    }

    const { endpoint, method = "GET", body, apiKey, environment = "sandbox" } = payload as {
      endpoint?: string;
      method?: string;
      body?: unknown;
      apiKey?: string;
      environment?: string;
    };

    if (!endpoint || typeof endpoint !== "string" || !endpoint.startsWith("/")) {
      return json({ error: "endpoint is required and must start with '/'" }, 400);
    }
    const base = BASES[environment];
    if (!base) return json({ error: "environment must be 'sandbox' or 'production'" }, 400);

    const key = (typeof apiKey === "string" && apiKey.trim())
      ? apiKey.trim()
      : Deno.env.get("FANBASIS_API_KEY");
    if (!key) return json({ error: "No API key provided and FANBASIS_API_KEY is not configured" }, 400);

    const upperMethod = String(method).toUpperCase();
    if (!["GET", "POST", "PUT", "PATCH", "DELETE"].includes(upperMethod)) {
      return json({ error: `Unsupported method: ${method}` }, 400);
    }

    const url = `${base}${endpoint}`;
    const init: RequestInit = {
      method: upperMethod,
      headers: {
        "x-api-key": key,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
    };
    if (body !== undefined && body !== null && upperMethod !== "GET") {
      init.body = JSON.stringify(body);
    }

    const res = await fetch(url, init);
    const text = await res.text();
    let parsed: unknown = null;
    try {
      parsed = text ? JSON.parse(text) : null;
    } catch {
      parsed = { raw: text };
    }

    console.log(`[commas-proxy] ${upperMethod} ${url} -> ${res.status}`);

    return json(
      {
        ok: res.ok,
        status: res.status,
        url,
        method: upperMethod,
        data: parsed,
      },
      200,
    );
  } catch (error) {
    console.error("[commas-proxy] error", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return json({ ok: false, status: 500, error: message }, 200);
  }
});

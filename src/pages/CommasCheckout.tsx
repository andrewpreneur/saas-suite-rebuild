import { useEffect, useMemo, useState } from "react";
import { Helmet } from "react-helmet-async";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, ExternalLink, ShieldCheck, AlertTriangle, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type CommasProduct = {
  id: string;
  title: string;
  description: string | null;
  price: string;
  payment_link: string;
};

export default function CommasCheckout() {
  const [environment, setEnvironment] = useState<"production" | "sandbox">("production");
  const [products, setProducts] = useState<CommasProduct[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedId, setSelectedId] = useState<string>("");
  const [frameBlocked, setFrameBlocked] = useState(false);

  const selected = useMemo(() => products.find((p) => p.id === selectedId), [products, selectedId]);

  const loadProducts = async (env = environment) => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("commas-proxy", {
        body: { endpoint: "/public-api/products?page=1&limit=50", method: "GET", environment: env },
      });
      if (error) throw error;
      const outer = data as Record<string, any>;
      const rows: CommasProduct[] = outer?.data?.data?.data ?? [];
      if (!Array.isArray(rows) || rows.length === 0) throw new Error("No live products returned by Commas");
      setProducts(rows);
      setSelectedId(rows[0].id);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not load Commas products");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProducts("production");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!selected) return;
    setFrameBlocked(false);
    const t = setTimeout(() => setFrameBlocked(true), 4000);
    return () => clearTimeout(t);
  }, [selected?.id]);

  return (
    <div className="min-h-screen bg-background py-10">
      <Helmet>
        <title>Commas Live Checkout | SaaSSuite</title>
        <meta name="robots" content="noindex,nofollow" />
      </Helmet>

      <div className="mx-auto w-full max-w-5xl space-y-6 px-4">
        <header className="space-y-2 text-center">
          <h1 className="text-3xl font-bold">Commas Live Checkout</h1>
          <p className="text-sm text-muted-foreground">
            Pulls your real Commas products through the server-side proxy and loads the live hosted checkout.
          </p>
        </header>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-3">
            <CardTitle className="text-base">Live products</CardTitle>
            <div className="flex items-center gap-2">
              {(["production", "sandbox"] as const).map((env) => (
                <Button
                  key={env}
                  size="sm"
                  variant={environment === env ? "default" : "outline"}
                  onClick={() => {
                    setEnvironment(env);
                    loadProducts(env);
                  }}
                >
                  {env}
                </Button>
              ))}
              <Button size="sm" variant="outline" disabled={loading} onClick={() => loadProducts()}>
                {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
              </Button>
            </div>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2">
            {products.map((p) => (
              <button
                key={p.id}
                onClick={() => setSelectedId(p.id)}
                className={`rounded-lg border p-3 text-left transition ${
                  p.id === selectedId ? "border-primary bg-primary/5" : "hover:bg-muted/50"
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium">{p.title}</span>
                  <Badge variant="secondary">${p.price}</Badge>
                </div>
                <p className="mt-1 line-clamp-2 whitespace-pre-line text-xs text-muted-foreground">
                  {p.description || "No description"}
                </p>
                <p className="mt-1 font-mono text-[10px] text-muted-foreground">{p.id}</p>
              </button>
            ))}
            {!loading && products.length === 0 && (
              <p className="text-sm text-muted-foreground">No products loaded yet.</p>
            )}
          </CardContent>
        </Card>

        {selected && (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2">
              <CardTitle className="text-base">
                Checkout — {selected.title} (${selected.price})
              </CardTitle>
              <Button size="sm" asChild>
                <a href={selected.payment_link} target="_blank" rel="noreferrer">
                  <ExternalLink className="mr-1.5 h-3.5 w-3.5" /> Pay now (new tab)
                </a>
              </Button>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="break-all font-mono text-[11px] text-muted-foreground">{selected.payment_link}</p>
              <div className="overflow-hidden rounded-lg border bg-white">
                <iframe
                  key={selected.id}
                  title="Commas checkout"
                  src={selected.payment_link}
                  className="h-[900px] w-full"
                  allow="payment *"
                  onLoad={() => setFrameBlocked(false)}
                />
              </div>
              {frameBlocked && (
                <div className="flex items-start gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-xs">
                  <AlertTriangle className="mt-0.5 h-4 w-4 text-amber-600" />
                  <span>
                    If the frame is blank, Commas’ <code>frame-ancestors</code> policy does not include
                    saassuite.ai yet. Ask Commas to whitelist <code>https://saassuite.ai</code> (and the
                    preview domain) to embed it inline — meanwhile “Pay now” opens the same live checkout.
                  </span>
                </div>
              )}
              <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <ShieldCheck className="h-3.5 w-3.5" /> API key stays server-side in the commas-proxy function.
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

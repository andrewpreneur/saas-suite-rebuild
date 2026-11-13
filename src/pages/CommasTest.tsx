import { useCallback, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Settings, ShoppingCart, Webhook, Tag, Users, RefreshCw, Package, CreditCard,
  Loader2, Copy, ChevronDown, ChevronRight, Plus, Trash2, ExternalLink,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

/* ------------------------------------------------------------------ */
/* Types & constants                                                   */
/* ------------------------------------------------------------------ */

type Env = "sandbox" | "production";

type ApiResult = {
  ok: boolean;
  status: number;
  url?: string;
  method?: string;
  data?: unknown;
  error?: string;
};

const SECTIONS = [
  { id: "config", label: "Config", icon: Settings },
  { id: "checkout", label: "Checkout Sessions", icon: ShoppingCart },
  { id: "webhooks", label: "Webhooks", icon: Webhook },
  { id: "discounts", label: "Discount Codes", icon: Tag },
  { id: "customers", label: "Customers & Subscribers", icon: Users },
  { id: "subscriptions", label: "Subscriptions", icon: RefreshCw },
  { id: "products", label: "Products", icon: Package },
  { id: "transactions", label: "Transactions", icon: CreditCard },
] as const;

type SectionId = (typeof SECTIONS)[number]["id"];

const WEBHOOK_EVENTS = [
  "payment.succeeded", "payment.failed", "payment.expired", "payment.canceled",
  "product.purchased", "subscription.created", "subscription.renewed",
  "subscription.completed", "subscription.canceled", "dispute.created",
  "dispute.updated", "refund.created",
];

const BASE_URLS: Record<Env, string> = {
  production: "https://www.fanbasis.com",
  sandbox: "https://qa.dev-fan-basis.com",
};

/* ------------------------------------------------------------------ */
/* Small building blocks                                               */
/* ------------------------------------------------------------------ */

const Panel = ({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) => (
  <section className="rounded-xl border border-border bg-card/60 p-5 space-y-4">
    <header className="space-y-1">
      <h3 className="text-sm font-semibold tracking-tight text-foreground">{title}</h3>
      {description && <p className="text-xs text-muted-foreground">{description}</p>}
    </header>
    {children}
  </section>
);

const Field = ({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) => (
  <div className="space-y-1.5">
    <Label className="text-xs text-muted-foreground">{label}</Label>
    {children}
    {hint && <p className="text-[11px] text-muted-foreground/70">{hint}</p>}
  </div>
);

const JsonViewer = ({ result, endpointHint }: { result?: ApiResult | null; endpointHint?: string }) => {
  const [open, setOpen] = useState(true);
  if (!result) {
    return endpointHint ? (
      <p className="font-mono text-[11px] text-muted-foreground/60">{endpointHint}</p>
    ) : null;
  }
  const badge = result.ok
    ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30"
    : "bg-destructive/15 text-destructive border-destructive/30";
  return (
    <div className="rounded-lg border border-border bg-background/70">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-2 px-3 py-2 text-left"
      >
        {open ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
        <span className={cn("rounded border px-1.5 py-0.5 text-[10px] font-semibold", badge)}>
          {result.status || (result.ok ? 200 : "ERR")}
        </span>
        <span className="truncate font-mono text-[11px] text-muted-foreground">
          {result.method} {result.url ?? endpointHint ?? ""}
        </span>
      </button>
      {open && (
        <pre className="max-h-80 overflow-auto border-t border-border px-3 py-2 font-mono text-[11px] leading-relaxed text-foreground/90">
          {JSON.stringify(result.error ? { error: result.error } : result.data, null, 2)}
        </pre>
      )}
    </div>
  );
};

const CopyButton = ({ value, label = "Copy" }: { value: string; label?: string }) => (
  <Button
    type="button"
    variant="outline"
    size="sm"
    onClick={async () => {
      try {
        await navigator.clipboard.writeText(value);
        toast.success("Copied to clipboard");
      } catch {
        toast.error("Copy failed");
      }
    }}
  >
    <Copy className="mr-1.5 h-3.5 w-3.5" /> {label}
  </Button>
);

const Spin = ({ loading, children }: { loading: boolean; children: React.ReactNode }) => (
  <>
    {loading && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
    {children}
  </>
);

const DataTable = ({ columns, rows, onRowClick, empty = "No records" }: {
  columns: { key: string; label: string; render?: (row: Record<string, unknown>) => React.ReactNode }[];
  rows: Record<string, unknown>[];
  onRowClick?: (row: Record<string, unknown>) => void;
  empty?: string;
}) => {
  if (!rows.length) return <p className="text-xs text-muted-foreground">{empty}</p>;
  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="w-full text-left text-xs">
        <thead className="bg-muted/40 text-muted-foreground">
          <tr>{columns.map((c) => <th key={c.key} className="px-3 py-2 font-medium">{c.label}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr
              key={i}
              onClick={() => onRowClick?.(row)}
              className={cn("border-t border-border/60", onRowClick && "cursor-pointer hover:bg-muted/30")}
            >
              {columns.map((c) => (
                <td key={c.key} className="px-3 py-2 align-top font-mono text-[11px]">
                  {c.render ? c.render(row) : String(row?.[c.key] ?? "—")}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

const toCents = (dollars: string) => Math.round(parseFloat(dollars || "0") * 100);
// Commas returns integers in cents, but some endpoints (e.g. products) return
// decimal dollar strings like "199.00" — detect and format accordingly.
const fmtMoney = (value: unknown) => {
  if (value === null || value === undefined || value === "") return "—";
  const raw = String(value);
  const n = parseFloat(raw);
  if (!isFinite(n)) return "—";
  const isDollars = raw.includes(".");
  return `$${(isDollars ? n : n / 100).toFixed(2)}`;
};

const listFrom = (data: unknown): Record<string, unknown>[] => {
  if (Array.isArray(data)) return data as Record<string, unknown>[];
  const d = data as Record<string, unknown> | null;
  if (!d) return [];
  for (const key of ["data", "items", "results", "records"]) {
    const v = d[key];
    if (Array.isArray(v)) return v as Record<string, unknown>[];
    if (v && typeof v === "object") {
      for (const k2 of ["data", "items", "results"]) {
        const v2 = (v as Record<string, unknown>)[k2];
        if (Array.isArray(v2)) return v2 as Record<string, unknown>[];
      }
    }
  }
  return [];
};

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

const CommasTest = () => {
  const [section, setSection] = useState<SectionId>("config");
  const [env, setEnv] = useState<Env>("sandbox");
  const [apiKey, setApiKey] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [results, setResults] = useState<Record<string, ApiResult | null>>({});

  const call = useCallback(
    async (key: string, endpoint: string, method = "GET", body?: unknown): Promise<ApiResult> => {
      setBusy(key);
      try {
        const { data, error } = await supabase.functions.invoke("commas-proxy", {
          body: { endpoint, method, body, apiKey, environment: env },
        });
        if (error) throw error;
        const res = (data ?? {}) as ApiResult;
        const final: ApiResult = { ...res, url: res.url ?? `${BASE_URLS[env]}${endpoint}`, method: res.method ?? method };
        setResults((r) => ({ ...r, [key]: final }));
        if (final.ok) toast.success(`${method} ${endpoint} → ${final.status}`);
        else toast.error(`${method} ${endpoint} → ${final.status ?? "error"}`);
        return final;
      } catch (e) {
        const message = e instanceof Error ? e.message : "Request failed";
        const final: ApiResult = { ok: false, status: 0, error: message, url: `${BASE_URLS[env]}${endpoint}`, method };
        setResults((r) => ({ ...r, [key]: final }));
        toast.error(message);
        return final;
      } finally {
        setBusy(null);
      }
    },
    [apiKey, env],
  );

  const R = (key: string) => results[key] ?? null;
  const isBusy = (key: string) => busy === key;

  return (
    <div className="dark min-h-screen bg-background text-foreground">
      <div className="flex min-h-screen">
        {/* Sidebar */}
        <aside className="hidden w-60 shrink-0 border-r border-border bg-card/40 p-4 md:block">
          <div className="mb-6 px-2">
            <p className="text-sm font-semibold tracking-tight">Commas API Lab</p>
            <p className="text-[11px] text-muted-foreground">formerly FanBasis</p>
          </div>
          <nav className="space-y-1">
            {SECTIONS.map((s) => (
              <button
                key={s.id}
                onClick={() => setSection(s.id)}
                className={cn(
                  "flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs transition-colors",
                  section === s.id
                    ? "bg-primary/15 text-primary"
                    : "text-muted-foreground hover:bg-muted/40 hover:text-foreground",
                )}
              >
                <s.icon className="h-4 w-4" />
                {s.label}
              </button>
            ))}
          </nav>
        </aside>

        <main className="flex-1 min-w-0">
          {/* Topbar */}
          <div className="sticky top-0 z-20 flex flex-wrap items-center gap-3 border-b border-border bg-background/90 px-4 py-3 backdrop-blur">
            <h1 className="text-sm font-semibold">
              {SECTIONS.find((s) => s.id === section)?.label}
            </h1>
            <span
              className={cn(
                "rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
                env === "production"
                  ? "border-emerald-500/40 bg-emerald-500/15 text-emerald-400"
                  : "border-amber-500/40 bg-amber-500/15 text-amber-400",
              )}
            >
              {env}
            </span>
            <span className="font-mono text-[11px] text-muted-foreground">{BASE_URLS[env]}</span>
            <span className="ml-auto text-[11px] text-muted-foreground">
              {apiKey ? "API key set (in-memory)" : "Using server FANBASIS_API_KEY"}
            </span>
          </div>

          {/* Mobile section picker */}
          <div className="flex gap-2 overflow-x-auto border-b border-border px-4 py-2 md:hidden">
            {SECTIONS.map((s) => (
              <button
                key={s.id}
                onClick={() => setSection(s.id)}
                className={cn(
                  "whitespace-nowrap rounded-full border px-3 py-1 text-[11px]",
                  section === s.id ? "border-primary/50 bg-primary/15 text-primary" : "border-border text-muted-foreground",
                )}
              >
                {s.label}
              </button>
            ))}
          </div>

          <div className="mx-auto max-w-4xl space-y-5 p-4 md:p-6">
            {section === "config" && (
              <ConfigSection {...{ env, setEnv, apiKey, setApiKey, call, R, isBusy }} />
            )}
            {section === "checkout" && <CheckoutSection {...{ call, R, isBusy }} />}
            {section === "webhooks" && <WebhooksSection {...{ call, R, isBusy }} />}
            {section === "discounts" && <DiscountsSection {...{ call, R, isBusy }} />}
            {section === "customers" && <CustomersSection {...{ call, R, isBusy }} />}
            {section === "subscriptions" && <SubscriptionsSection {...{ call, R, isBusy }} />}
            {section === "products" && <ProductsSection {...{ call, R, isBusy }} />}
            {section === "transactions" && <TransactionsSection {...{ call, R, isBusy }} />}
          </div>
        </main>
      </div>
    </div>
  );
};

type SectionProps = {
  call: (key: string, endpoint: string, method?: string, body?: unknown) => Promise<ApiResult>;
  R: (key: string) => ApiResult | null;
  isBusy: (key: string) => boolean;
};

/* ------------------------------ Config ---------------------------- */

const ConfigSection = ({
  env, setEnv, apiKey, setApiKey, call, R, isBusy,
}: SectionProps & {
  env: Env; setEnv: (e: Env) => void; apiKey: string; setApiKey: (k: string) => void;
}) => (
  <>
    <Panel title="Environment" description="Nothing here is persisted — state resets on reload.">
      <div className="flex items-center justify-between rounded-lg border border-border bg-background/60 px-4 py-3">
        <div>
          <p className="text-xs font-medium">Production mode</p>
          <p className="text-[11px] text-muted-foreground">Off = Sandbox (qa.dev-fan-basis.com)</p>
        </div>
        <Switch checked={env === "production"} onCheckedChange={(v) => setEnv(v ? "production" : "sandbox")} />
      </div>
      <Field label="Base URL in use">
        <Input readOnly value={BASE_URLS[env]} className="font-mono text-xs" />
      </Field>
      <Field
        label="API Key (x-api-key)"
        hint="Leave blank to use the FANBASIS_API_KEY secret stored server-side."
      >
        <Input type="password" value={apiKey} onChange={(e) => setApiKey(e.target.value)} placeholder="sk_..." />
      </Field>
      <Button size="sm" disabled={isBusy("test")} onClick={() => call("test", "/public-api/products")}>
        <Spin loading={isBusy("test")}>Test Connection</Spin>
      </Button>
      <JsonViewer result={R("test")} endpointHint="GET /public-api/products" />
    </Panel>
  </>
);

/* --------------------------- Checkout ----------------------------- */

const CheckoutSection = ({ call, R, isBusy }: SectionProps) => {
  const [title, setTitle] = useState("Test Product");
  const [description, setDescription] = useState("Created from the Commas API Lab");
  const [amount, setAmount] = useState("27.00");
  const [type, setType] = useState<"one_time" | "subscription">("one_time");
  const [frequency, setFrequency] = useState("30");
  const [trial, setTrial] = useState("0");
  const [successUrl, setSuccessUrl] = useState("https://saassuite.ai/success");
  const [meta, setMeta] = useState<{ k: string; v: string }[]>([{ k: "source", v: "commas_api_lab" }]);
  const [sessionId, setSessionId] = useState("");
  const [txSessionId, setTxSessionId] = useState("");
  const [page, setPage] = useState(1);

  const created = R("create") ;
  const paymentLink = useMemo(() => {
    const d = created?.data as Record<string, unknown> | undefined;
    const inner = (d?.data ?? d) as Record<string, unknown> | undefined;
    const link = inner?.payment_link ?? inner?.paymentLink ?? inner?.checkout_url;
    return typeof link === "string" ? link : "";
  }, [created]);

  const submit = () => {
    const metadata: Record<string, string> = {};
    meta.forEach(({ k, v }) => { if (k.trim()) metadata[k.trim()] = v; });
    const body: Record<string, unknown> = {
      title,
      description,
      amount: toCents(amount),
      type,
      success_url: successUrl,
      metadata,
    };
    if (type === "subscription") {
      body.frequency_days = Number(frequency) || 30;
      body.free_trial_days = Number(trial) || 0;
    }
    call("create", "/public-api/checkout-sessions", "POST", body);
  };

  const txRows = listFrom(R("sessionTx")?.data);

  return (
    <>
      <Panel title="Create checkout session" description="Amount is entered in dollars and sent in cents.">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Product title"><Input value={title} onChange={(e) => setTitle(e.target.value)} /></Field>
          <Field label="Amount (USD)"><Input value={amount} onChange={(e) => setAmount(e.target.value)} /></Field>
          <div className="sm:col-span-2">
            <Field label="Description"><Textarea rows={2} value={description} onChange={(e) => setDescription(e.target.value)} /></Field>
          </div>
          <Field label="Type">
            <div className="flex gap-2">
              {(["one_time", "subscription"] as const).map((t) => (
                <Button key={t} type="button" size="sm" variant={type === t ? "default" : "outline"} onClick={() => setType(t)}>
                  {t === "one_time" ? "One-time" : "Subscription"}
                </Button>
              ))}
            </div>
          </Field>
          <Field label="Success URL"><Input value={successUrl} onChange={(e) => setSuccessUrl(e.target.value)} /></Field>
          {type === "subscription" && (
            <>
              <Field label="Frequency (days)"><Input value={frequency} onChange={(e) => setFrequency(e.target.value)} /></Field>
              <Field label="Free trial (days)"><Input value={trial} onChange={(e) => setTrial(e.target.value)} /></Field>
            </>
          )}
        </div>

        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground">Metadata</Label>
          {meta.map((row, i) => (
            <div key={i} className="flex gap-2">
              <Input placeholder="key" value={row.k}
                onChange={(e) => setMeta((m) => m.map((r, j) => (j === i ? { ...r, k: e.target.value } : r)))} />
              <Input placeholder="value" value={row.v}
                onChange={(e) => setMeta((m) => m.map((r, j) => (j === i ? { ...r, v: e.target.value } : r)))} />
              <Button type="button" variant="outline" size="icon" aria-label="Delete" onClick={() => setMeta((m) => m.filter((_, j) => j !== i))}>
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))}
          <Button type="button" variant="outline" size="sm" onClick={() => setMeta((m) => [...m, { k: "", v: "" }])}>
            <Plus className="mr-1.5 h-3.5 w-3.5" /> Add row
          </Button>
        </div>

        <Button size="sm" disabled={isBusy("create")} onClick={submit}>
          <Spin loading={isBusy("create")}>Create session</Spin>
        </Button>

        {paymentLink && (
          <div className="space-y-2 rounded-lg border border-primary/30 bg-primary/10 p-3">
            <p className="text-xs font-medium text-primary">Payment link</p>
            <p className="break-all font-mono text-[11px]">{paymentLink}</p>
            <div className="flex gap-2">
              <Button size="sm" asChild><a href={paymentLink} target="_blank" rel="noreferrer">
                <ExternalLink className="mr-1.5 h-3.5 w-3.5" /> Open checkout</a></Button>
              <CopyButton value={paymentLink} label="Copy link" />
            </div>
          </div>
        )}
        <JsonViewer result={created} endpointHint="POST /public-api/checkout-sessions" />
      </Panel>

      <Panel title="Look up / delete session">
        <Field label="Checkout session ID"><Input value={sessionId} onChange={(e) => setSessionId(e.target.value)} /></Field>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" disabled={!sessionId || isBusy("getSession")}
            onClick={() => call("getSession", `/public-api/checkout-sessions/${sessionId}`)}>
            <Spin loading={isBusy("getSession")}>Get session</Spin>
          </Button>
          <Button size="sm" variant="destructive" disabled={!sessionId || isBusy("delSession")}
            onClick={() => call("delSession", `/public-api/checkout-sessions/${sessionId}`, "DELETE")}>
            <Spin loading={isBusy("delSession")}>Delete session</Spin>
          </Button>
        </div>
        <JsonViewer result={R("getSession")} />
        <JsonViewer result={R("delSession")} />
      </Panel>

      <Panel title="Session transactions">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Checkout session ID"><Input value={txSessionId} onChange={(e) => setTxSessionId(e.target.value)} /></Field>
          <Field label="Page"><Input value={String(page)} onChange={(e) => setPage(Number(e.target.value) || 1)} /></Field>
        </div>
        <Button size="sm" variant="outline" disabled={!txSessionId || isBusy("sessionTx")}
          onClick={() => call("sessionTx", `/public-api/checkout-sessions/${txSessionId}/transactions?page=${page}&limit=20`)}>
          <Spin loading={isBusy("sessionTx")}>Load transactions</Spin>
        </Button>
        <DataTable
          rows={txRows}
          columns={[
            { key: "id", label: "ID" },
            { key: "amount", label: "Amount", render: (r) => fmtMoney(r.amount) },
            { key: "status", label: "Status" },
            { key: "created_at", label: "Created" },
          ]}
        />
        <JsonViewer result={R("sessionTx")} />
      </Panel>
    </>
  );
};

/* --------------------------- Webhooks ----------------------------- */

const WebhooksSection = ({ call, R, isBusy }: SectionProps) => {
  const [url, setUrl] = useState("");
  const [events, setEvents] = useState<string[]>([]);
  const [delId, setDelId] = useState("");
  const [testId, setTestId] = useState("");
  const [testEvent, setTestEvent] = useState(WEBHOOK_EVENTS[0]);

  const created = R("whCreate");
  const secret = useMemo(() => {
    const d = created?.data as Record<string, unknown> | undefined;
    const inner = (d?.data ?? d) as Record<string, unknown> | undefined;
    const s = inner?.secret_key ?? inner?.secret;
    return typeof s === "string" ? s : "";
  }, [created]);

  const rows = listFrom(R("whList")?.data);

  return (
    <>
      <Panel title="Webhook subscriptions">
        <Button size="sm" variant="outline" disabled={isBusy("whList")}
          onClick={() => call("whList", "/public-api/webhooks")}>
          <Spin loading={isBusy("whList")}>Refresh list</Spin>
        </Button>
        <DataTable
          rows={rows}
          columns={[
            { key: "id", label: "ID" },
            { key: "url", label: "URL" },
            { key: "events", label: "Events", render: (r) => Array.isArray(r.events) ? (r.events as string[]).join(", ") : String(r.events ?? "—") },
            { key: "is_active", label: "Active", render: (r) => String(r.is_active ?? r.active ?? "—") },
          ]}
        />
        <JsonViewer result={R("whList")} endpointHint="GET /public-api/webhooks" />
      </Panel>

      <Panel title="Create subscription">
        <Field label="Webhook URL"><Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://..." /></Field>
        <div className="grid gap-2 sm:grid-cols-2">
          {WEBHOOK_EVENTS.map((ev) => (
            <label key={ev} className="flex items-center gap-2 text-xs text-muted-foreground">
              <Checkbox
                checked={events.includes(ev)}
                onCheckedChange={(c) => setEvents((prev) => (c ? [...prev, ev] : prev.filter((e) => e !== ev)))}
              />
              <span className="font-mono">{ev}</span>
            </label>
          ))}
        </div>
        <Button size="sm" disabled={!url || !events.length || isBusy("whCreate")}
          onClick={() => call("whCreate", "/public-api/webhooks", "POST", { url, events })}>
          <Spin loading={isBusy("whCreate")}>Create webhook</Spin>
        </Button>
        {secret && (
          <div className="space-y-2 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3">
            <p className="text-xs font-semibold text-amber-400">Save this — it's only shown once!</p>
            <p className="break-all font-mono text-[11px]">{secret}</p>
            <CopyButton value={secret} label="Copy secret" />
          </div>
        )}
        <JsonViewer result={created} />
      </Panel>

      <Panel title="Delete webhook">
        <Field label="Webhook ID"><Input value={delId} onChange={(e) => setDelId(e.target.value)} /></Field>
        <Button size="sm" variant="destructive" disabled={!delId || isBusy("whDelete")}
          onClick={() => call("whDelete", `/public-api/webhooks/${delId}`, "DELETE")}>
          <Spin loading={isBusy("whDelete")}>Delete</Spin>
        </Button>
        <JsonViewer result={R("whDelete")} />
      </Panel>

      <Panel title="Send test event">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Subscription ID"><Input value={testId} onChange={(e) => setTestId(e.target.value)} /></Field>
          <Field label="Event type">
            <select
              value={testEvent}
              onChange={(e) => setTestEvent(e.target.value)}
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-xs"
            >
              {WEBHOOK_EVENTS.map((ev) => <option key={ev} value={ev}>{ev}</option>)}
            </select>
          </Field>
        </div>
        <Button size="sm" variant="outline" disabled={!testId || isBusy("whTest")}
          onClick={() => call("whTest", `/public-api/webhooks/${testId}/test`, "POST", { event: testEvent })}>
          <Spin loading={isBusy("whTest")}>Send test</Spin>
        </Button>
        <JsonViewer result={R("whTest")} />
      </Panel>
    </>
  );
};

/* --------------------------- Discounts ---------------------------- */

const DiscountsSection = ({ call, R, isBusy }: SectionProps) => {
  const [search, setSearch] = useState("");
  const [form, setForm] = useState({
    code: "", description: "", discount_type: "percentage" as "percentage" | "fixed",
    value: "10", duration: "once" as "once" | "multiple_months" | "forever",
    months: "3", expires_at: "", limited: false, max_uses: "100",
    one_per_customer: false, service_ids: "",
  });
  const [codeId, setCodeId] = useState("");
  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => setForm((f) => ({ ...f, [k]: v }));

  const buildBody = () => {
    const body: Record<string, unknown> = {
      code: form.code,
      description: form.description,
      discount_type: form.discount_type,
      value: form.discount_type === "fixed" ? toCents(form.value) : Number(form.value),
      duration: form.duration,
      one_time_per_customer: form.one_per_customer,
      limited_redemptions: form.limited,
    };
    if (form.duration === "multiple_months") body.duration_in_months = Number(form.months) || 1;
    if (form.expires_at) body.expires_at = form.expires_at;
    if (form.limited) body.max_redemptions = Number(form.max_uses) || 1;
    const ids = form.service_ids.split(",").map((s) => s.trim()).filter(Boolean);
    if (ids.length) body.service_ids = ids;
    return body;
  };

  const rows = listFrom(R("dcList")?.data).filter((r) => {
    if (!search.trim()) return true;
    return JSON.stringify(r).toLowerCase().includes(search.toLowerCase());
  });

  return (
    <>
      <Panel title="Discount codes">
        <div className="flex gap-2">
          <Input placeholder="Search codes..." value={search} onChange={(e) => setSearch(e.target.value)} />
          <Button size="sm" variant="outline" disabled={isBusy("dcList")}
            onClick={() => call("dcList", "/public-api/discount-codes")}>
            <Spin loading={isBusy("dcList")}>Load</Spin>
          </Button>
        </div>
        <DataTable
          rows={rows}
          onRowClick={(r) => setCodeId(String(r.id ?? ""))}
          columns={[
            { key: "id", label: "ID" },
            { key: "code", label: "Code" },
            { key: "discount_type", label: "Type" },
            { key: "value", label: "Value" },
            { key: "times_used", label: "Used" },
          ]}
        />
        <JsonViewer result={R("dcList")} endpointHint="GET /public-api/discount-codes" />
      </Panel>

      <Panel title="Create / update code">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Code"><Input value={form.code} onChange={(e) => set("code", e.target.value)} /></Field>
          <Field label="Description"><Input value={form.description} onChange={(e) => set("description", e.target.value)} /></Field>
          <Field label="Discount type">
            <div className="flex gap-2">
              {(["percentage", "fixed"] as const).map((t) => (
                <Button key={t} size="sm" variant={form.discount_type === t ? "default" : "outline"} onClick={() => set("discount_type", t)}>{t}</Button>
              ))}
            </div>
          </Field>
          <Field label={form.discount_type === "fixed" ? "Value (USD)" : "Value (%)"}>
            <Input value={form.value} onChange={(e) => set("value", e.target.value)} />
          </Field>
          <Field label="Duration">
            <select value={form.duration} onChange={(e) => set("duration", e.target.value as typeof form.duration)}
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-xs">
              <option value="once">once</option>
              <option value="multiple_months">multiple_months</option>
              <option value="forever">forever</option>
            </select>
          </Field>
          {form.duration === "multiple_months" && (
            <Field label="Months"><Input value={form.months} onChange={(e) => set("months", e.target.value)} /></Field>
          )}
          <Field label="Expiry date"><Input type="date" value={form.expires_at} onChange={(e) => set("expires_at", e.target.value)} /></Field>
          <Field label="Product/Service IDs from Commas dashboard">
            <Input value={form.service_ids} onChange={(e) => set("service_ids", e.target.value)} placeholder="id1, id2" />
          </Field>
        </div>
        <div className="flex flex-wrap gap-6">
          <label className="flex items-center gap-2 text-xs text-muted-foreground">
            <Switch checked={form.limited} onCheckedChange={(v) => set("limited", v)} /> Limited redemptions
          </label>
          {form.limited && (
            <Input className="w-32" value={form.max_uses} onChange={(e) => set("max_uses", e.target.value)} placeholder="max uses" />
          )}
          <label className="flex items-center gap-2 text-xs text-muted-foreground">
            <Switch checked={form.one_per_customer} onCheckedChange={(v) => set("one_per_customer", v)} /> One-time per customer
          </label>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" disabled={!form.code || isBusy("dcCreate")}
            onClick={() => call("dcCreate", "/public-api/discount-codes", "POST", buildBody())}>
            <Spin loading={isBusy("dcCreate")}>Create</Spin>
          </Button>
          <Button size="sm" variant="outline" disabled={!codeId || isBusy("dcUpdate")}
            onClick={() => call("dcUpdate", `/public-api/discount-codes/${codeId}`, "PUT", buildBody())}>
            <Spin loading={isBusy("dcUpdate")}>Update selected</Spin>
          </Button>
        </div>
        <JsonViewer result={R("dcCreate")} />
        <JsonViewer result={R("dcUpdate")} />
      </Panel>

      <Panel title="Single code (get / delete)">
        <Field label="Discount code ID"><Input value={codeId} onChange={(e) => setCodeId(e.target.value)} /></Field>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" disabled={!codeId || isBusy("dcGet")}
            onClick={() => call("dcGet", `/public-api/discount-codes/${codeId}`)}>
            <Spin loading={isBusy("dcGet")}>Get code</Spin>
          </Button>
          <Button size="sm" variant="destructive" disabled={!codeId || isBusy("dcDel")}
            onClick={() => call("dcDel", `/public-api/discount-codes/${codeId}`, "DELETE")}>
            <Spin loading={isBusy("dcDel")}>Delete</Spin>
          </Button>
        </div>
        <JsonViewer result={R("dcGet")} />
        <JsonViewer result={R("dcDel")} />
      </Panel>
    </>
  );
};

/* --------------------------- Customers ---------------------------- */

const CustomersSection = ({ call, R, isBusy }: SectionProps) => {
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState<Record<string, unknown> | null>(null);
  const [chargeOpen, setChargeOpen] = useState(false);
  const [charge, setCharge] = useState({ payment_method_id: "", service_id: "", amount: "27.00", description: "" });
  const [subFilters, setSubFilters] = useState({ product_id: "", customer_id: "", status: "" });

  const customers = listFrom(R("custList")?.data);
  const subs = listFrom(R("subsList")?.data);

  const loadSubs = () => {
    const p = new URLSearchParams();
    Object.entries(subFilters).forEach(([k, v]) => { if (v.trim()) p.set(k, v.trim()); });
    call("subsList", `/public-api/subscribers${p.toString() ? `?${p}` : ""}`);
  };

  return (
    <>
      <Panel title="Customers">
        <div className="flex gap-2">
          <Input placeholder="Search by name or email" value={q} onChange={(e) => setQ(e.target.value)} />
          <Button size="sm" variant="outline" disabled={isBusy("custList")}
            onClick={() => call("custList", `/public-api/customers${q.trim() ? `?search=${encodeURIComponent(q.trim())}` : ""}`)}>
            <Spin loading={isBusy("custList")}>Search</Spin>
          </Button>
        </div>
        <DataTable
          rows={customers}
          onRowClick={(row) => {
            setSelected(row);
            const id = String(row.id ?? row.customer_id ?? "");
            if (id) call("custPm", `/public-api/customers/${id}/payment-methods`);
          }}
          columns={[
            { key: "id", label: "ID" },
            { key: "name", label: "Name" },
            { key: "email", label: "Email" },
          ]}
        />
        {selected && (
          <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-background/60 p-3">
            <span className="text-xs text-muted-foreground">Selected:</span>
            <span className="font-mono text-[11px]">{String(selected.email ?? selected.id)}</span>
            <Button size="sm" className="ml-auto" onClick={() => setChargeOpen(true)}>Charge customer</Button>
          </div>
        )}
        <JsonViewer result={R("custList")} endpointHint="GET /public-api/customers" />
        <JsonViewer result={R("custPm")} />
      </Panel>

      <Panel title="Subscribers">
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Product ID"><Input value={subFilters.product_id} onChange={(e) => setSubFilters((f) => ({ ...f, product_id: e.target.value }))} /></Field>
          <Field label="Customer ID"><Input value={subFilters.customer_id} onChange={(e) => setSubFilters((f) => ({ ...f, customer_id: e.target.value }))} /></Field>
          <Field label="Status">
            <select value={subFilters.status} onChange={(e) => setSubFilters((f) => ({ ...f, status: e.target.value }))}
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-xs">
              <option value="">any</option>
              <option value="active">active</option>
              <option value="cancelled">cancelled</option>
              <option value="expired">expired</option>
            </select>
          </Field>
        </div>
        <Button size="sm" variant="outline" disabled={isBusy("subsList")} onClick={loadSubs}>
          <Spin loading={isBusy("subsList")}>Load subscribers</Spin>
        </Button>
        <DataTable
          rows={subs}
          columns={[
            { key: "id", label: "ID" },
            { key: "customer_email", label: "Customer", render: (r) => String(r.customer_email ?? r.email ?? r.customer_id ?? "—") },
            { key: "status", label: "Status" },
            { key: "amount", label: "Amount", render: (r) => fmtMoney(r.amount) },
          ]}
        />
        <JsonViewer result={R("subsList")} />
      </Panel>

      <Dialog open={chargeOpen} onOpenChange={setChargeOpen}>
        <DialogContent className="dark">
          <DialogHeader><DialogTitle>Charge customer</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <Field label="Payment method ID"><Input value={charge.payment_method_id} onChange={(e) => setCharge((c) => ({ ...c, payment_method_id: e.target.value }))} /></Field>
            <Field label="Service ID"><Input value={charge.service_id} onChange={(e) => setCharge((c) => ({ ...c, service_id: e.target.value }))} /></Field>
            <Field label="Amount (USD)"><Input value={charge.amount} onChange={(e) => setCharge((c) => ({ ...c, amount: e.target.value }))} /></Field>
            <Field label="Description"><Input value={charge.description} onChange={(e) => setCharge((c) => ({ ...c, description: e.target.value }))} /></Field>
          </div>
          <DialogFooter>
            <Button size="sm" disabled={isBusy("charge")}
              onClick={async () => {
                const customerId = String(selected?.id ?? selected?.customer_id ?? "");
                await call("charge", "/public-api/customers/charge", "POST", {
                  customer_id: customerId,
                  payment_method_id: charge.payment_method_id,
                  service_id: charge.service_id,
                  amount: toCents(charge.amount),
                  description: charge.description,
                });
                setChargeOpen(false);
              }}>
              <Spin loading={isBusy("charge")}>Charge</Spin>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <JsonViewer result={R("charge")} />
    </>
  );
};

/* ------------------------- Subscriptions -------------------------- */

const SubscriptionsSection = ({ call, R, isBusy }: SectionProps) => {
  const [cancel, setCancel] = useState({ checkoutSessionId: "", subscriptionId: "" });
  const [extend, setExtend] = useState({ checkoutSessionId: "", userId: "", days: "30" });
  const [upgradeSubId, setUpgradeSubId] = useState("");
  const [billingMode, setBillingMode] = useState<"immediate" | "next_cycle">("immediate");
  const [refund, setRefund] = useState({ transactionId: "", amount: "" });

  const upgrades = listFrom(R("upgradeList")?.data);

  return (
    <>
      <Panel title="Cancel subscription">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Checkout session ID"><Input value={cancel.checkoutSessionId} onChange={(e) => setCancel((c) => ({ ...c, checkoutSessionId: e.target.value }))} /></Field>
          <Field label="Subscription ID"><Input value={cancel.subscriptionId} onChange={(e) => setCancel((c) => ({ ...c, subscriptionId: e.target.value }))} /></Field>
        </div>
        <Button size="sm" variant="destructive" disabled={!cancel.subscriptionId || isBusy("cancelSub")}
          onClick={() => call("cancelSub", "/public-api/subscriptions/cancel", "POST", cancel)}>
          <Spin loading={isBusy("cancelSub")}>Cancel</Spin>
        </Button>
        <JsonViewer result={R("cancelSub")} />
      </Panel>

      <Panel title="Extend subscription">
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Checkout session ID"><Input value={extend.checkoutSessionId} onChange={(e) => setExtend((c) => ({ ...c, checkoutSessionId: e.target.value }))} /></Field>
          <Field label="User ID"><Input value={extend.userId} onChange={(e) => setExtend((c) => ({ ...c, userId: e.target.value }))} /></Field>
          <Field label="Days"><Input value={extend.days} onChange={(e) => setExtend((c) => ({ ...c, days: e.target.value }))} /></Field>
        </div>
        <Button size="sm" disabled={!extend.userId || isBusy("extendSub")}
          onClick={() => call("extendSub", "/public-api/subscriptions/extend", "POST", { ...extend, days: Number(extend.days) || 0 })}>
          <Spin loading={isBusy("extendSub")}>Extend</Spin>
        </Button>
        <JsonViewer result={R("extendSub")} />
      </Panel>

      <Panel title="Upgrade flow (proration)">
        <Field label="Subscription ID"><Input value={upgradeSubId} onChange={(e) => setUpgradeSubId(e.target.value)} /></Field>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" disabled={!upgradeSubId || isBusy("upgradeList")}
            onClick={() => call("upgradeList", `/public-api/subscriptions/${upgradeSubId}/upgrades`)}>
            <Spin loading={isBusy("upgradeList")}>Fetch available upgrades</Spin>
          </Button>
          <Button size="sm" variant="outline" disabled={!upgradeSubId || isBusy("upgradePreview")}
            onClick={() => call("upgradePreview", `/public-api/subscriptions/${upgradeSubId}/upgrade/preview`, "POST", { billing_mode: billingMode })}>
            <Spin loading={isBusy("upgradePreview")}>Preview upgrade</Spin>
          </Button>
          <select value={billingMode} onChange={(e) => setBillingMode(e.target.value as typeof billingMode)}
            className="h-9 rounded-md border border-input bg-background px-3 text-xs">
            <option value="immediate">immediate</option>
            <option value="next_cycle">next_cycle</option>
          </select>
          <Button size="sm" disabled={!upgradeSubId || isBusy("upgradeProcess")}
            onClick={() => call("upgradeProcess", `/public-api/subscriptions/${upgradeSubId}/upgrade`, "POST", { billing_mode: billingMode })}>
            <Spin loading={isBusy("upgradeProcess")}>Process upgrade</Spin>
          </Button>
        </div>
        {!!upgrades.length && (
          <div className="grid gap-3 sm:grid-cols-2">
            {upgrades.map((u, i) => (
              <div key={i} className="rounded-lg border border-border bg-background/60 p-3 text-xs">
                <p className="font-medium">{String(u.current_tier ?? u.from ?? "current")} → {String(u.target_tier ?? u.to ?? "target")}</p>
                <p className="text-muted-foreground">Amount due: {fmtMoney(u.amount_due)}</p>
                <p className="text-muted-foreground">Days remaining: {String(u.days_remaining ?? "—")}</p>
              </div>
            ))}
          </div>
        )}
        <JsonViewer result={R("upgradeList")} />
        <JsonViewer result={R("upgradePreview")} />
        <JsonViewer result={R("upgradeProcess")} />
      </Panel>

      <Panel title="Refund transaction">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Transaction ID"><Input value={refund.transactionId} onChange={(e) => setRefund((r) => ({ ...r, transactionId: e.target.value }))} /></Field>
          <Field label="Partial amount (USD, optional)"><Input value={refund.amount} onChange={(e) => setRefund((r) => ({ ...r, amount: e.target.value }))} /></Field>
        </div>
        <Button size="sm" variant="destructive" disabled={!refund.transactionId || isBusy("refund")}
          onClick={() => call("refund", "/public-api/refunds", "POST", {
            transaction_id: refund.transactionId,
            ...(refund.amount.trim() ? { amount: toCents(refund.amount) } : {}),
          })}>
          <Spin loading={isBusy("refund")}>Refund</Spin>
        </Button>
        <JsonViewer result={R("refund")} />
      </Panel>
    </>
  );
};

/* --------------------------- Products ----------------------------- */

const ProductsSection = ({ call, R, isBusy }: SectionProps) => {
  const rows = listFrom(R("products")?.data);
  return (
    <Panel title="Products">
      <Button size="sm" variant="outline" disabled={isBusy("products")} onClick={() => call("products", "/public-api/products")}>
        <Spin loading={isBusy("products")}>Load products</Spin>
      </Button>
      <DataTable
        rows={rows}
        columns={[
          { key: "title", label: "Title", render: (r) => String(r.title ?? r.name ?? "—") },
          { key: "amount", label: "Price", render: (r) => fmtMoney(r.amount ?? r.price) },
          { key: "payment_link", label: "Payment link", render: (r) => String(r.payment_link ?? r.paymentLink ?? "—") },
          {
            key: "copy", label: "", render: (r) => {
              const link = String(r.payment_link ?? r.paymentLink ?? "");
              return link ? <CopyButton value={link} label="Copy Link" /> : "—";
            },
          },
        ]}
      />
      <JsonViewer result={R("products")} endpointHint="GET /public-api/products" />
    </Panel>
  );
};

/* ------------------------- Transactions --------------------------- */

const TransactionsSection = ({ call, R, isBusy }: SectionProps) => {
  const [filters, setFilters] = useState({ product_id: "", customer_id: "" });
  const [page, setPage] = useState(1);
  const [detail, setDetail] = useState<Record<string, unknown> | null>(null);
  const rows = listFrom(R("txList")?.data);

  const load = (p = page) => {
    const params = new URLSearchParams({ page: String(p), limit: "20" });
    Object.entries(filters).forEach(([k, v]) => { if (v.trim()) params.set(k, v.trim()); });
    setPage(p);
    call("txList", `/public-api/transactions?${params}`);
  };

  return (
    <>
      <Panel title="Transactions">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Product ID"><Input value={filters.product_id} onChange={(e) => setFilters((f) => ({ ...f, product_id: e.target.value }))} /></Field>
          <Field label="Customer ID"><Input value={filters.customer_id} onChange={(e) => setFilters((f) => ({ ...f, customer_id: e.target.value }))} /></Field>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" disabled={isBusy("txList")} onClick={() => load(1)}>
            <Spin loading={isBusy("txList")}>Load</Spin>
          </Button>
          <Button size="sm" variant="ghost" disabled={page <= 1 || isBusy("txList")} onClick={() => load(page - 1)}>Prev</Button>
          <span className="text-xs text-muted-foreground">Page {page}</span>
          <Button size="sm" variant="ghost" disabled={isBusy("txList")} onClick={() => load(page + 1)}>Next</Button>
        </div>
        <DataTable
          rows={rows}
          onRowClick={setDetail}
          columns={[
            { key: "id", label: "ID" },
            { key: "amount", label: "Amount", render: (r) => fmtMoney(r.amount) },
            { key: "status", label: "Status" },
            { key: "customer_email", label: "Customer", render: (r) => String(r.customer_email ?? r.email ?? "—") },
            { key: "created_at", label: "Created" },
          ]}
        />
        <JsonViewer result={R("txList")} endpointHint="GET /public-api/transactions" />
      </Panel>

      {detail && (
        <Panel title="Transaction detail">
          <pre className="max-h-96 overflow-auto rounded-lg border border-border bg-background/70 p-3 font-mono text-[11px]">
            {JSON.stringify(detail, null, 2)}
          </pre>
          <Button size="sm" variant="outline" onClick={() => setDetail(null)}>Close</Button>
        </Panel>
      )}
    </>
  );
};

export default CommasTest;

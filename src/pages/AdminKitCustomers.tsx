import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ArrowLeft, RefreshCw, Search } from "lucide-react";
import { KitStagePill } from "@/components/dashboard/KitOnboardingGuide";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { isPlatformAdminEmail } from "@/lib/platformAdmins";
import {
  filterKitCustomers,
  kitAddonTitles,
  kitCustomerProgress,
  kitCustomerProgressStage,
  parseKitCustomerDirectory,
  sortKitCustomers,
  type KitCustomerRecord,
  type KitCustomerSortKey,
} from "@/lib/kitCustomers";
import { platformMockEnabled } from "@/lib/platformMock";
import { cn } from "@/lib/utils";

type Gate = "loading" | "in" | "out";
type SortDir = "asc" | "desc";

function formatWhen(iso: string | null): string {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function migrationMissing(message: string): boolean {
  return /admin_kit_customers|PGRST202|schema cache|does not exist|404/i.test(message);
}

function SortHeader({
  label,
  column,
  active,
  direction,
  onSort,
}: {
  label: string;
  column: KitCustomerSortKey;
  active: KitCustomerSortKey;
  direction: SortDir;
  onSort: (column: KitCustomerSortKey) => void;
}) {
  const selected = active === column;
  return (
    <TableHead aria-sort={selected ? (direction === "asc" ? "ascending" : "descending") : "none"}>
      <button
        type="button"
        className="inline-flex items-center gap-1 font-medium text-purple-950 hover:text-purple-700 dark:text-purple-100"
        onClick={() => onSort(column)}
      >
        {label}
        <span aria-hidden="true" className="text-xs text-muted-foreground">
          {selected ? (direction === "asc" ? "↑" : "↓") : "↕"}
        </span>
      </button>
    </TableHead>
  );
}

function CustomerDetail({ row, onBack }: { row: KitCustomerRecord; onBack: () => void }) {
  const progress = kitCustomerProgress(row);
  const addons = kitAddonTitles(row.purchasedLineIds);
  const stage = kitCustomerProgressStage(progress.percent);
  return (
    <div className="space-y-4" data-testid="kit-customer-detail">
      <Button type="button" variant="outline" size="sm" className="gap-1" onClick={onBack}>
        <ArrowLeft className="h-4 w-4" />
        All kit customers
      </Button>
      <Card className="border-2 border-purple-200 dark:border-purple-800">
        <CardHeader>
          <CardTitle className="text-2xl text-purple-950 dark:text-purple-50">
            {row.name || row.email}
          </CardTitle>
          <CardDescription className="text-sm text-foreground">
            {row.email}
            {row.agencyName ? ` · ${row.agencyName}` : ""}
            {row.agencyId ? ` · ${row.agencyId}` : ""}
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Purchase date
            </p>
            <p className="mt-1 text-sm">{formatWhen(row.purchaseAt)}</p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Last activity
            </p>
            <p className="mt-1 text-sm">{formatWhen(row.lastActivity)}</p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              How they got access
            </p>
            <div className="mt-1 flex flex-wrap gap-1">
              {row.access.includes("purchase") ? <KitStagePill stage="Purchased" /> : null}
              {row.access.includes("signup") ? (
                <span className="inline-flex items-center rounded-full bg-purple-100 px-2.5 py-0.5 text-xs font-semibold text-purple-900 dark:bg-purple-950 dark:text-purple-100">
                  Kit signup
                </span>
              ) : null}
              {row.access.length === 0 ? <span className="text-sm">Kit customer</span> : null}
            </div>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Dashboard
            </p>
            <p className="mt-1 text-sm text-green-800 dark:text-green-200">
              Every kit item is unlocked
            </p>
            {row.comped ? (
              <p className="text-xs text-muted-foreground">Includes a comped line</p>
            ) : null}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg text-purple-800 dark:text-purple-200">
            Add-ons they bought
          </CardTitle>
          <CardDescription>
            These are the lines on the purchase record. The dashboard still opens the full kit.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          {addons.length === 0 ? (
            <p className="text-sm text-muted-foreground">No add-on purchases on file.</p>
          ) : (
            addons.map((title) => (
              <span
                key={title}
                className="inline-flex items-center rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-semibold text-green-900 dark:bg-green-950 dark:text-green-100"
              >
                {title}
              </span>
            ))
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <CardTitle className="text-lg text-purple-800 dark:text-purple-200">
              Kit progress
            </CardTitle>
            <KitStagePill stage={stage} />
          </div>
          <CardDescription>
            {progress.label} complete · {progress.percent}%. Marks saved on the account, plus
            install, landing page, and ad requests.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div
            className="h-2.5 w-full overflow-hidden rounded-full bg-purple-100 dark:bg-purple-950"
            data-kit-customer-progress={progress.percent}
          >
            <div
              className="h-full bg-green-600 dark:bg-green-400"
              style={{ width: `${progress.percent}%` }}
            />
          </div>
          <p className="text-sm">
            Landing page:{" "}
            {row.landingPageUrl ? (
              <a
                href={row.landingPageUrl}
                className="font-medium text-purple-800 underline decoration-purple-400 underline-offset-4 dark:text-purple-200"
                target="_blank"
                rel="noreferrer"
              >
                {row.landingPageUrl}
              </a>
            ) : (
              <span className="text-muted-foreground">Not saved yet</span>
            )}
          </p>
          <ol className="space-y-2" data-testid="kit-customer-steps">
            {progress.steps.map((step, index) => (
              <li
                key={step.id}
                className={cn(
                  "flex items-center justify-between gap-3 rounded-lg border px-3 py-2",
                  step.status === "open"
                    ? "border-purple-200 dark:border-purple-800"
                    : "border-green-600 dark:border-green-400",
                )}
                data-kit-customer-step={step.id}
                data-kit-customer-step-status={step.status}
              >
                <span className="text-sm">
                  <span className="mr-2 text-muted-foreground">{index + 1}.</span>
                  {step.title}
                </span>
                <KitStagePill
                  stage={
                    step.status === "confirmed"
                      ? "Confirmed"
                      : step.status === "marked"
                        ? "Marked done"
                        : "Not started"
                  }
                />
              </li>
            ))}
          </ol>
        </CardContent>
      </Card>
    </div>
  );
}

export default function AdminKitCustomers() {
  const [gate, setGate] = useState<Gate>("loading");
  const [rows, setRows] = useState<KitCustomerRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState("");
  const [query, setQuery] = useState("");
  const [sortKey, setSortKey] = useState<KitCustomerSortKey>("purchased");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedEmail = searchParams.get("customer")?.trim().toLowerCase() || "";

  useEffect(() => {
    if (platformMockEnabled) {
      setGate("in");
      return;
    }
    void supabase.auth.getSession().then(({ data }) => {
      const email = data.session?.user?.email?.toLowerCase() ?? "";
      setGate(isPlatformAdminEmail(email) ? "in" : "out");
    });
  }, []);

  const load = async () => {
    setLoading(true);
    setNotice("");
    const { data, error } = await supabase.rpc("admin_kit_customers");
    if (error) {
      setRows([]);
      setNotice(
        migrationMissing(error.message)
          ? "The customer list is in the app. It stays empty until the kit customer migration is applied. That migration does not change anyone's plan."
          : error.message,
      );
      setLoading(false);
      return;
    }
    setRows(parseKitCustomerDirectory(data));
    setLoading(false);
  };

  useEffect(() => {
    if (gate !== "in") return;
    void load();
  }, [gate]);

  const visible = useMemo(
    () => sortKitCustomers(filterKitCustomers(rows, query), sortKey, sortDir),
    [rows, query, sortKey, sortDir],
  );
  const selected = rows.find((row) => row.email === selectedEmail) ?? null;

  const onSort = (column: KitCustomerSortKey) => {
    if (sortKey === column) {
      setSortDir((current) => (current === "asc" ? "desc" : "asc"));
      return;
    }
    setSortKey(column);
    setSortDir(column === "name" || column === "email" || column === "agency" ? "asc" : "desc");
  };

  if (gate === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background text-muted-foreground">
        Checking admin access…
      </div>
    );
  }

  if (gate === "out") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle>Platform admin only</CardTitle>
            <CardDescription>
              Sign in as the platform admin to see One Feature Kit customers.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild>
              <Link to="/admin">Open admin sign-in</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b bg-card">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-4">
          <div>
            <h1 className="text-xl font-bold text-purple-950 dark:text-purple-50">
              One Feature Kit customers
            </h1>
            <p className="text-sm text-muted-foreground">
              Kit purchases and kit signups. Every open SaaSSuite account can use the full kit in the
              dashboard.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
              <RefreshCw className={cn("mr-2 h-4 w-4", loading && "animate-spin")} />
              Refresh
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link to="/admin">Admin</Link>
            </Button>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl space-y-4 px-4 py-6" data-testid="kit-customers">
        {selected ? (
          <CustomerDetail
            row={selected}
            onBack={() => {
              const next = new URLSearchParams(searchParams);
              next.delete("customer");
              setSearchParams(next, { replace: true });
            }}
          />
        ) : (
          <>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-muted-foreground">
                {visible.length} of {rows.length} customers
              </p>
              <div className="relative w-full sm:max-w-sm">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search name, email, agency, add-on"
                  aria-label="Search kit customers"
                  className="pl-9"
                />
              </div>
            </div>
            {notice ? (
              <p className="rounded-lg border border-purple-300 bg-purple-50 px-4 py-3 text-sm text-purple-950 dark:border-purple-700 dark:bg-purple-950 dark:text-purple-100">
                {notice}
              </p>
            ) : null}
            <Card className="overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <SortHeader
                      label="Name"
                      column="name"
                      active={sortKey}
                      direction={sortDir}
                      onSort={onSort}
                    />
                    <SortHeader
                      label="Email"
                      column="email"
                      active={sortKey}
                      direction={sortDir}
                      onSort={onSort}
                    />
                    <SortHeader
                      label="Agency"
                      column="agency"
                      active={sortKey}
                      direction={sortDir}
                      onSort={onSort}
                    />
                    <SortHeader
                      label="Purchased"
                      column="purchased"
                      active={sortKey}
                      direction={sortDir}
                      onSort={onSort}
                    />
                    <SortHeader
                      label="Add-ons"
                      column="addons"
                      active={sortKey}
                      direction={sortDir}
                      onSort={onSort}
                    />
                    <SortHeader
                      label="Progress"
                      column="progress"
                      active={sortKey}
                      direction={sortDir}
                      onSort={onSort}
                    />
                    <SortHeader
                      label="Last activity"
                      column="activity"
                      active={sortKey}
                      direction={sortDir}
                      onSort={onSort}
                    />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {visible.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={7}
                        className="py-8 text-center text-sm text-muted-foreground"
                      >
                        {loading
                          ? "Loading kit customers…"
                          : "No One Feature Kit customers match this search."}
                      </TableCell>
                    </TableRow>
                  ) : (
                    visible.map((row) => {
                      const progress = kitCustomerProgress(row);
                      const addons = kitAddonTitles(row.purchasedLineIds);
                      return (
                        <TableRow
                          key={row.email}
                          data-testid="kit-customer-row"
                          className="cursor-pointer"
                          onClick={() => {
                            const next = new URLSearchParams(searchParams);
                            next.set("customer", row.email);
                            setSearchParams(next);
                          }}
                        >
                          <TableCell className="font-medium text-purple-950 dark:text-purple-100">
                            {row.name || "—"}
                          </TableCell>
                          <TableCell>{row.email}</TableCell>
                          <TableCell>{row.agencyName || row.agencyId || "—"}</TableCell>
                          <TableCell>{formatWhen(row.purchaseAt)}</TableCell>
                          <TableCell className="max-w-[16rem] text-sm">
                            {addons.length === 0 ? "—" : addons.join(", ")}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <KitStagePill stage={kitCustomerProgressStage(progress.percent)} />
                              <span className="text-sm tabular-nums">{progress.percent}%</span>
                            </div>
                          </TableCell>
                          <TableCell>{formatWhen(row.lastActivity)}</TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </Card>
          </>
        )}
      </div>
    </div>
  );
}

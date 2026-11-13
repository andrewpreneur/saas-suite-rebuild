import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, ArrowDown, ArrowUp, Plus, RefreshCw, Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

import { isPlatformAdminEmail } from "@/lib/platformAdmins";

const STATUSES = ["not_started", "in_progress", "done"] as const;
const SOURCES = [
  "ghl_affiliate",
  "slack",
  "dm",
  "email",
  "text",
  "existing_customer",
  "other",
] as const;

type SetupStatus = (typeof STATUSES)[number];
type SetupSource = (typeof SOURCES)[number];

type TrackerRow = {
  id: string;
  account_name: string;
  agency_name: string | null;
  contact_name: string | null;
  contact_email: string | null;
  source: string;
  ghl_agency_id: string | null;
  ghl_location_id: string | null;
  setup_status: string;
  status_detail: string | null;
  last_contact_at: string | null;
  last_contact_note: string | null;
  evidence: string | null;
  saas_suite_user_id: number | null;
  created_at: string;
  updated_at: string;
};

const STATUS_LABEL: Record<SetupStatus, string> = {
  not_started: "Not started",
  in_progress: "In progress",
  done: "Done",
};

const STATUS_CLASS: Record<SetupStatus, string> = {
  not_started: "bg-muted text-muted-foreground border-border",
  in_progress:
    "bg-amber-100 text-amber-950 border-amber-300 dark:bg-amber-950/40 dark:text-amber-100 dark:border-amber-800",
  done: "bg-emerald-100 text-emerald-900 border-emerald-300 dark:bg-emerald-950/40 dark:text-emerald-100 dark:border-emerald-800",
};

const SOURCE_LABEL: Record<SetupSource, string> = {
  ghl_affiliate: "GHL affiliate",
  slack: "Slack",
  dm: "DM",
  email: "Email",
  text: "Text",
  existing_customer: "Existing customer",
  other: "Other",
};

function isStatus(value: string): value is SetupStatus {
  return (STATUSES as readonly string[]).includes(value);
}

function isSource(value: string): value is SetupSource {
  return (SOURCES as readonly string[]).includes(value);
}

function statusLabel(value: string) {
  return isStatus(value) ? STATUS_LABEL[value] : value;
}

function sourceLabel(value: string) {
  return isSource(value) ? SOURCE_LABEL[value] : value;
}

function formatWhen(value: string | null) {
  if (!value) return "No contact yet";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "No contact yet";
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

const EMPTY_FORM = {
  account_name: "",
  agency_name: "",
  contact_name: "",
  contact_email: "",
  source: "existing_customer" as SetupSource,
  ghl_agency_id: "",
  ghl_location_id: "",
  setup_status: "not_started" as SetupStatus,
  status_detail: "",
  last_contact_note: "",
  evidence: "",
};

const AdminSetupTracker = () => {
  const [ready, setReady] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [rows, setRows] = useState<TrackerRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [sourceFilter, setSourceFilter] = useState<string>("all");
  const [contactSort, setContactSort] = useState<"desc" | "asc">("desc");
  const [addOpen, setAddOpen] = useState(false);
  const [savingAdd, setSavingAdd] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);

  useEffect(() => {
    let live = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!live) return;
      setIsAdmin(isPlatformAdminEmail(data.session?.user?.email));
      setReady(true);
    });
    return () => {
      live = false;
    };
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    const { data, error } = await supabase
      .from("setup_tracker_accounts")
      .select("*")
      .order("account_name", { ascending: true });
    if (error) {
      setLoadError(error.message);
      setRows([]);
    } else {
      setRows((data || []) as TrackerRow[]);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (isAdmin) void load();
  }, [isAdmin, load]);

  const counts = useMemo(() => {
    return {
      total: rows.length,
      not_started: rows.filter((row) => row.setup_status === "not_started").length,
      in_progress: rows.filter((row) => row.setup_status === "in_progress").length,
      done: rows.filter((row) => row.setup_status === "done").length,
    };
  }, [rows]);

  const visible = useMemo(() => {
    const query = search.trim().toLowerCase();
    const filtered = rows.filter((row) => {
      if (statusFilter !== "all" && row.setup_status !== statusFilter) return false;
      if (sourceFilter !== "all" && row.source !== sourceFilter) return false;
      if (!query) return true;
      const haystack = [
        row.account_name,
        row.agency_name,
        row.contact_name,
        row.contact_email,
        row.ghl_agency_id,
        row.ghl_location_id,
        row.status_detail,
        row.last_contact_note,
        row.evidence,
        sourceLabel(row.source),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(query);
    });
    const time = (value: string | null) => {
      if (!value) return null;
      const parsed = new Date(value).getTime();
      return Number.isNaN(parsed) ? null : parsed;
    };
    return filtered.sort((a, b) => {
      const left = time(a.last_contact_at);
      const right = time(b.last_contact_at);
      if (left == null && right == null) return a.account_name.localeCompare(b.account_name);
      if (left == null) return 1;
      if (right == null) return -1;
      return contactSort === "desc" ? right - left : left - right;
    });
  }, [rows, search, statusFilter, sourceFilter, contactSort]);

  async function patchRow(id: string, patch: Partial<TrackerRow>) {
    const previous = rows;
    setRows((current) =>
      current.map((row) =>
        row.id === id ? { ...row, ...patch, updated_at: new Date().toISOString() } : row,
      ),
    );
    const { error } = await supabase.from("setup_tracker_accounts").update(patch).eq("id", id);
    if (error) {
      setRows(previous);
      toast.error(error.message);
    }
  }

  function saveDetail(row: TrackerRow, value: string) {
    const next = value.trim();
    if (next === (row.status_detail || "").trim()) return;
    void patchRow(row.id, { status_detail: next || null });
  }

  function saveNote(row: TrackerRow, value: string) {
    const next = value.trim();
    if (next === (row.last_contact_note || "").trim()) return;
    void patchRow(row.id, {
      last_contact_note: next || null,
      ...(next ? { last_contact_at: new Date().toISOString() } : {}),
    });
  }

  async function addAccount() {
    const accountName = form.account_name.trim();
    if (!accountName) {
      toast.error("Account name is required");
      return;
    }
    setSavingAdd(true);
    const note = form.last_contact_note.trim();
    const { error } = await supabase.from("setup_tracker_accounts").insert({
      account_name: accountName,
      agency_name: form.agency_name.trim() || null,
      contact_name: form.contact_name.trim() || null,
      contact_email: form.contact_email.trim().toLowerCase() || null,
      source: form.source,
      ghl_agency_id: form.ghl_agency_id.trim() || null,
      ghl_location_id: form.ghl_location_id.trim() || null,
      setup_status: form.setup_status,
      status_detail: form.status_detail.trim() || null,
      last_contact_note: note || null,
      last_contact_at: note ? new Date().toISOString() : null,
      evidence: form.evidence.trim() || null,
    });
    setSavingAdd(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Account added");
    setForm(EMPTY_FORM);
    setAddOpen(false);
    await load();
  }

  if (!ready) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center text-muted-foreground">
        Loading…
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6 text-center">
        <div>
          <h1 className="text-2xl font-bold mb-2">Admin only</h1>
          <p className="text-muted-foreground mb-4">
            You need to be signed in as the platform admin to use the AI Studio Setup Tracker.
          </p>
          <Link to="/admin" className="text-sm text-primary hover:underline">
            Go to admin sign-in
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background" data-testid="setup-tracker">
      <div className="max-w-7xl mx-auto px-4 py-6 space-y-5">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="space-y-1">
            <Link
              to="/admin"
              className="text-sm text-muted-foreground hover:underline inline-flex items-center gap-1"
            >
              <ArrowLeft className="w-3.5 h-3.5" /> Admin
            </Link>
            <h1 className="text-xl md:text-2xl font-bold">AI Studio Setup Tracker</h1>
            <p className="text-sm text-muted-foreground max-w-3xl">
              Agencies that still need the GoHighLevel workflow “Remove Menu Links From Purchase +
              Assign Menu Link” on an AI Studio order. That workflow calls apply-menu-preset and
              assign-menu-link.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
              <RefreshCw className={cn("w-4 h-4 mr-1", loading && "animate-spin")} />
              Refresh
            </Button>
            <Button size="sm" onClick={() => setAddOpen(true)} data-testid="add-account">
              <Plus className="w-4 h-4 mr-1" />
              Add account
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <SummaryCard label="Total" value={counts.total} testId="summary-total" />
          <SummaryCard
            label="Not started"
            value={counts.not_started}
            tone="muted"
            testId="summary-not-started"
          />
          <SummaryCard
            label="In progress"
            value={counts.in_progress}
            tone="amber"
            testId="summary-in-progress"
          />
          <SummaryCard label="Done" value={counts.done} tone="green" testId="summary-done" />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="w-4 h-4 absolute left-2.5 top-2.5 text-muted-foreground" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search account, email, GHL id, notes"
              className="pl-8"
              data-testid="tracker-search"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[160px]" data-testid="status-filter">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              {STATUSES.map((status) => (
                <SelectItem key={status} value={status}>
                  {STATUS_LABEL[status]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={sourceFilter} onValueChange={setSourceFilter}>
            <SelectTrigger className="w-[180px]" data-testid="source-filter">
              <SelectValue placeholder="Source" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All sources</SelectItem>
              {SOURCES.map((source) => (
                <SelectItem key={source} value={source}>
                  {SOURCE_LABEL[source]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground" data-testid="visible-count">
            Showing {visible.length} of {rows.length}
          </p>
        </div>

        {loadError && (
          <div
            className="rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm"
            role="alert"
          >
            Could not load the tracker. If this database has not had the setup tracker migration
            applied yet, that is expected. {loadError}
          </div>
        )}

        <div className="rounded-md border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="min-w-[200px]">Account</TableHead>
                <TableHead className="min-w-[130px]">Source</TableHead>
                <TableHead className="min-w-[180px]">GHL agency / location</TableHead>
                <TableHead className="min-w-[150px]">Status</TableHead>
                <TableHead className="min-w-[260px]">Status detail</TableHead>
                <TableHead className="min-w-[220px]">
                  <button
                    type="button"
                    className="inline-flex items-center gap-1 font-medium"
                    onClick={() =>
                      setContactSort((current) => (current === "desc" ? "asc" : "desc"))
                    }
                    data-testid="sort-last-contact"
                  >
                    Last contact
                    {contactSort === "desc" ? (
                      <ArrowDown className="w-3.5 h-3.5" />
                    ) : (
                      <ArrowUp className="w-3.5 h-3.5" />
                    )}
                  </button>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visible.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-10">
                    {loading ? "Loading accounts…" : "No accounts match these filters."}
                  </TableCell>
                </TableRow>
              )}
              {visible.map((row) => (
                <TableRow key={row.id} data-testid="tracker-row">
                  <TableCell>
                    <div className="font-medium">{row.account_name}</div>
                    {row.agency_name && row.agency_name !== row.account_name && (
                      <div className="text-xs text-muted-foreground">{row.agency_name}</div>
                    )}
                    {(row.contact_name || row.contact_email) && (
                      <div className="text-xs text-muted-foreground">
                        {[row.contact_name, row.contact_email].filter(Boolean).join(" · ")}
                      </div>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="whitespace-nowrap">
                      {sourceLabel(row.source)}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="text-xs space-y-1">
                      <div>
                        <span className="text-muted-foreground">Agency </span>
                        <span className="font-mono break-all">{row.ghl_agency_id || "—"}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Location </span>
                        <span className="font-mono break-all">{row.ghl_location_id || "—"}</span>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Select
                      value={isStatus(row.setup_status) ? row.setup_status : "not_started"}
                      onValueChange={(value) => {
                        if (isStatus(value) && value !== row.setup_status)
                          void patchRow(row.id, { setup_status: value });
                      }}
                    >
                      <SelectTrigger
                        className={cn(
                          "h-8 w-[140px] text-xs",
                          isStatus(row.setup_status)
                            ? STATUS_CLASS[row.setup_status]
                            : STATUS_CLASS.not_started,
                        )}
                        data-testid={`status-${row.id}`}
                      >
                        <SelectValue>{statusLabel(row.setup_status)}</SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {STATUSES.map((status) => (
                          <SelectItem key={status} value={status}>
                            {STATUS_LABEL[status]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell>
                    <Textarea
                      key={`${row.id}-detail-${row.status_detail ?? ""}`}
                      defaultValue={row.status_detail || ""}
                      rows={3}
                      className="text-xs min-h-[72px]"
                      onBlur={(event) => saveDetail(row, event.target.value)}
                      aria-label={`Status detail for ${row.account_name}`}
                    />
                    {row.evidence && (
                      <p
                        className="text-[11px] text-muted-foreground mt-1 line-clamp-3"
                        title={row.evidence}
                      >
                        {row.evidence}
                      </p>
                    )}
                  </TableCell>
                  <TableCell>
                    <div
                      className="text-xs text-muted-foreground mb-1"
                      data-testid={`contact-date-${row.id}`}
                    >
                      {formatWhen(row.last_contact_at)}
                    </div>
                    <Textarea
                      key={`${row.id}-note-${row.last_contact_note ?? ""}`}
                      defaultValue={row.last_contact_note || ""}
                      rows={3}
                      className="text-xs min-h-[72px]"
                      placeholder="Last contact note"
                      onBlur={(event) => saveNote(row, event.target.value)}
                      aria-label={`Last contact note for ${row.account_name}`}
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add account</DialogTitle>
            <DialogDescription>
              This writes only to the setup tracker. It does not change the customer’s plan, access,
              or billing.
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Account name" className="sm:col-span-2">
              <Input
                value={form.account_name}
                onChange={(event) => setForm({ ...form, account_name: event.target.value })}
                data-testid="add-account-name"
              />
            </Field>
            <Field label="Agency name">
              <Input
                value={form.agency_name}
                onChange={(event) => setForm({ ...form, agency_name: event.target.value })}
              />
            </Field>
            <Field label="Contact name">
              <Input
                value={form.contact_name}
                onChange={(event) => setForm({ ...form, contact_name: event.target.value })}
              />
            </Field>
            <Field label="Contact email" className="sm:col-span-2">
              <Input
                type="email"
                value={form.contact_email}
                onChange={(event) => setForm({ ...form, contact_email: event.target.value })}
              />
            </Field>
            <Field label="Source">
              <Select
                value={form.source}
                onValueChange={(value) => {
                  if (isSource(value)) setForm({ ...form, source: value });
                }}
              >
                <SelectTrigger data-testid="add-source">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SOURCES.map((source) => (
                    <SelectItem key={source} value={source}>
                      {SOURCE_LABEL[source]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Status">
              <Select
                value={form.setup_status}
                onValueChange={(value) => {
                  if (isStatus(value)) setForm({ ...form, setup_status: value });
                }}
              >
                <SelectTrigger data-testid="add-status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUSES.map((status) => (
                    <SelectItem key={status} value={status}>
                      {STATUS_LABEL[status]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="GHL agency id">
              <Input
                value={form.ghl_agency_id}
                onChange={(event) => setForm({ ...form, ghl_agency_id: event.target.value })}
              />
            </Field>
            <Field label="GHL location id">
              <Input
                value={form.ghl_location_id}
                onChange={(event) => setForm({ ...form, ghl_location_id: event.target.value })}
              />
            </Field>
            <Field label="Status detail" className="sm:col-span-2">
              <Textarea
                value={form.status_detail}
                onChange={(event) => setForm({ ...form, status_detail: event.target.value })}
                rows={3}
              />
            </Field>
            <Field label="Last contact note" className="sm:col-span-2">
              <Textarea
                value={form.last_contact_note}
                onChange={(event) => setForm({ ...form, last_contact_note: event.target.value })}
                rows={2}
                data-testid="add-note"
              />
            </Field>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => void addAccount()} disabled={savingAdd} data-testid="add-save">
              {savingAdd ? "Saving…" : "Save account"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

function SummaryCard({
  label,
  value,
  tone,
  testId,
}: {
  label: string;
  value: number;
  tone?: "muted" | "amber" | "green";
  testId: string;
}) {
  const toneClass =
    tone === "amber"
      ? "text-amber-700 dark:text-amber-300"
      : tone === "green"
        ? "text-emerald-700 dark:text-emerald-300"
        : tone === "muted"
          ? "text-muted-foreground"
          : "text-foreground";
  return (
    <Card>
      <CardContent className="p-4">
        <p className={cn("text-2xl font-bold", toneClass)} data-testid={testId}>
          {value}
        </p>
        <p className="text-xs text-muted-foreground">{label}</p>
      </CardContent>
    </Card>
  );
}

function Field({
  label,
  children,
  className,
}: {
  label: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <Label>{label}</Label>
      {children}
    </div>
  );
}

export default AdminSetupTracker;

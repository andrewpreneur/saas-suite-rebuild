import LocationList from "@/components/highlevel/LocationList";
import { useGhl } from "@/components/highlevel/useGhl";
import { PageHeader } from "@/components/platform/PageHeader";
import { SectionCard } from "@/components/premium/SectionCard";
import { EditorPanel, SettingItem, SettingList } from "@/components/premium/SettingList";
import { StatStrip } from "@/components/premium/StatStrip";
import { MoreMenu } from "@/components/premium/MoreMenu";
import NumberTicker from "@/components/premium/21st/number-ticker";
import { EmptyState } from "@/components/premium/21st/empty-state";
import { Tag } from "@/components/ui/tag";
import { CircleHelp, UserPlus, Users } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { loadStripe } from "@stripe/stripe-js";
import { EmbeddedCheckoutProvider, EmbeddedCheckout } from "@stripe/react-stripe-js";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import AgencyProjectsBoard from "@/components/agency-projects/AgencyProjectsBoard";

import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Check,
  CheckCircle,
  ChevronsUpDown,
  Globe,
  Loader2,
  Lock,
  Minus,
  Pencil,
  Plus,
  ShoppingCart,
  Trash2,
  X,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useUser } from "@/contexts/UserContext";
import { useToast } from "@/hooks/use-toast";
import { LoadNotice } from "@/components/platform/LoadNotice";
import { LOAD_TIMEOUT_MESSAGE, armLoadDeadline, loadErrorText } from "@/lib/loadSettle";
import { AGENCY_FEATURES } from "@/constants/pricingPlans";
import { isNativeApp } from "@/utils/nativeApp";
import { initStoreBilling, loadStoreOfferings, purchaseStorePackage } from "@/lib/revenuecat";

const STRIPE_PK =
  "pk_live_51MjPyIGdZ9PRE3ZipiIrE9ZxAF9obgIObU1VX1MgwWuh3SpFaq0nTZH8VLPDzrs0N9JREHGq0hnyGm1Kpd20Ev1I00UQDvqjfC";

const UNIT_PRICE = 49;
const LOCK_DAYS = 30;

type SupportClient = {
  id: string;
  client_email: string;
  client_name: string | null;
  agency_id: string | null;
  active: boolean;
  source: string;
  assigned_at: string | null;
  created_at: string;
  client_phone: string | null;
  client_company: string | null;
  location_id: string | null;
  locked_until: string | null;
};

type AgencyClient = {
  user_id: string;
  user_name: string | null;
  user_email: string | null;
};

const normalizeEmail = (v: string) => v.trim().toLowerCase();
const isEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);

const cleanDomain = (v: string) =>
  v
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/\/.*$/, "");

const isLocked = (c: SupportClient) => !!c.locked_until && new Date(c.locked_until) > new Date();

const fmtDate = (v: string | null) =>
  v ? new Date(v).toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" }) : "—";

const AgencySupportManager = () => {
  const { email } = useUser();
  const ghlConn = useGhl();
  const { toast } = useToast();

  const [wallet, setWallet] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [clients, setClients] = useState<SupportClient[]>([]);
  const [agencyClients, setAgencyClients] = useState<AgencyClient[]>([]);
  const [pickerOpen, setPickerOpen] = useState(false);

  const [savedDomain, setSavedDomain] = useState<string | null>(null);
  const [domainInput, setDomainInput] = useState("");
  const [savingDomain, setSavingDomain] = useState(false);

  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    company: "",
    locationId: "",
  });
  const [adding, setAdding] = useState(false);
  const [confirmTarget, setConfirmTarget] = useState<SupportClient | null>(null);
  const [assigning, setAssigning] = useState(false);

  const [editTarget, setEditTarget] = useState<SupportClient | null>(null);
  const [editForm, setEditForm] = useState({ name: "", phone: "", company: "", locationId: "" });
  const [savingEdit, setSavingEdit] = useState(false);

  const [quantity, setQuantity] = useState(1);
  const [activeTab, setActiveTab] = useState("assign");
  const tabsRef = useRef<HTMLDivElement>(null);
  const [assignOpen, setAssignOpen] = useState(false);
  const [includedOpen, setIncludedOpen] = useState(false);
  // "purchase" used to be a third tab; it is now a side panel over whichever tab is showing.
  const buyOpen = activeTab === "purchase";
  const [tabBehind, setTabBehind] = useState("assign");
  const openBuy = () => setActiveTab("purchase");
  const openAssign = () => {
    // The form lives with the client list, so show that tab behind the panel.
    setTabBehind("assign");
    setActiveTab("assign");
    setAssignOpen(true);
  };
  const shownTab = buyOpen ? tabBehind : activeTab;
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [purchasingSeat, setPurchasingSeat] = useState(false);
  const sessionIdRef = useRef<string | null>(null);
  const native = isNativeApp();

  const stripePromise = useMemo(() => loadStripe(STRIPE_PK), []);

  const used = clients.filter((c) => c.active).length;
  const available = Math.max(0, wallet - used);

  const fetchWallet = useCallback(async () => {
    if (!email) {
      setLoading(false);
      setLoadError(null);
      return;
    }
    setLoading(true);
    setLoadError(null);
    const stop = armLoadDeadline(() => {
      setLoading(false);
      setLoadError(LOAD_TIMEOUT_MESSAGE);
    });
    try {
      const { data, error } = await supabase
        .from("saas_suite_users")
        .select("agency_support_wallet, white_label_domain")
        .ilike("email", email)
        .maybeSingle();
      if (error) throw error;
      setWallet(((data as any)?.agency_support_wallet as number) ?? 0);
      const dom = ((data as any)?.white_label_domain as string | null) ?? null;
      setSavedDomain(dom);
      setDomainInput(dom || "");
    } catch (error) {
      setLoadError(loadErrorText(error, "Couldn't load agency support."));
    } finally {
      stop();
      setLoading(false);
    }
  }, [email]);

  const fetchClients = useCallback(async () => {
    if (!email) return;
    const { data, error } = await supabase.rpc("get_agency_support_clients" as any, {
      _owner_email: normalizeEmail(email),
    });
    if (error) {
      console.error("[AgencySupport] load clients", error);
      return;
    }
    setClients(((data as any[]) ?? []) as SupportClient[]);
  }, [email]);

  const fetchAgencyClients = useCallback(async () => {
    if (!email) return;
    const { data: userData } = await supabase
      .from("saas_suite_users")
      .select("agency_id, agency_id_basic, agency_id_advanced, agency_id_elite")
      .ilike("email", email)
      .maybeSingle();
    if (!userData) return;
    const ids = [
      (userData as any).agency_id,
      (userData as any).agency_id_basic,
      (userData as any).agency_id_advanced,
      (userData as any).agency_id_elite,
    ].filter(Boolean) as string[];
    const map = new Map<string, AgencyClient>();
    for (const aid of Array.from(new Set(ids))) {
      const { data } = await supabase.rpc("get_agency_clients", { p_agency_id: aid });
      for (const c of (data as any[]) ?? []) {
        map.set(c.user_id, {
          user_id: c.user_id,
          user_name: c.user_name,
          user_email: c.user_email,
        });
      }
    }
    setAgencyClients(Array.from(map.values()));
  }, [email]);

  useEffect(() => {
    fetchWallet();
    fetchClients();
    fetchAgencyClients();
  }, [fetchWallet, fetchClients, fetchAgencyClients]);

  // Clean up the Stripe return params if the redirect path was used.
  useEffect(() => {
    const url = new URL(window.location.href);
    if (url.searchParams.get("agencySupportPurchase") === "true") {
      url.searchParams.delete("agencySupportPurchase");
      url.searchParams.delete("email");
      window.history.replaceState({}, "", url.pathname + url.search);
      fetchWallet();
    }
  }, [fetchWallet]);

  const fetchClientSecret = useCallback(async () => {
    const { data, error } = await supabase.functions.invoke("create-agency-support-checkout", {
      body: { email, quantity },
    });
    if (error) throw new Error(error.message);
    if (data?.error) throw new Error(data.error);
    sessionIdRef.current = data.sessionId;
    return data.clientSecret as string;
  }, [email, quantity]);

  const handleComplete = useCallback(async () => {
    setCompleted(true);
    if (!sessionIdRef.current) return;
    try {
      const { data, error } = await supabase.functions.invoke("notify-agency-support-purchase", {
        body: { sessionId: sessionIdRef.current, fallbackEmail: email },
      });
      if (error) throw error;
      if (data?.wallet != null) setWallet(data.wallet);
      toast({
        title: "Agency Support added",
        description: "Your accounts are now in your wallet, ready to assign.",
      });
    } catch (e) {
      console.error("[AgencySupport] notify error", e);
      toast({
        title: "Purchase recorded",
        description: "It may take a moment to appear in your wallet.",
      });
    }
    setTimeout(fetchWallet, 1500);
  }, [email, fetchWallet, toast]);

  const handleCloseCheckout = () => {
    sessionIdRef.current = null;
    setCompleted(false);
    setCheckoutOpen(false);
    if (completed) setActiveTab("assign");
  };

  /** One agency seat via App Store / Google Play. Quantity is always 1 in the apps. */
  const purchaseStoreSeat = async () => {
    if (!email || purchasingSeat) return;
    setPurchasingSeat(true);
    try {
      const ready = await initStoreBilling(email);
      if (!ready) {
        toast({
          title: "In-app purchases unavailable",
          description: "Try again in a moment, or buy seats on the website.",
          variant: "destructive",
        });
        return;
      }
      const offerings = await loadStoreOfferings();
      const match = offerings.find((item) => item.productId === "ss_agency_seat_monthly");
      if (!match) {
        toast({
          title: "Seat not available in the store right now",
          variant: "destructive",
        });
        return;
      }
      const result = await purchaseStorePackage(match.pkg);
      if (!result.ok) {
        if (!result.cancelled) {
          toast({
            title: result.error ?? "Purchase failed",
            variant: "destructive",
          });
        }
        return;
      }
      await supabase.functions.invoke("sync-store-subscription");
      await fetchWallet();
      toast({
        title: "Agency Support seat added",
        description: "Your seat is in your wallet, ready to assign.",
      });
      setActiveTab("assign");
    } catch (e) {
      console.error("[AgencySupport] store seat purchase failed", e);
      toast({
        title: "Purchase failed",
        description: "Try again, or buy seats on the website.",
        variant: "destructive",
      });
    } finally {
      setPurchasingSeat(false);
    }
  };

  const saveDomain = async () => {
    if (!email) return;
    const d = cleanDomain(domainInput);
    if (!/^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(d)) {
      toast({
        title: "Enter a valid domain",
        description: "Use the form app.yourdomain.com — no https:// and no trailing path.",
        variant: "destructive",
      });
      return;
    }
    setSavingDomain(true);
    const { data, error } = await supabase.rpc("set_white_label_domain" as any, {
      _email: normalizeEmail(email),
      _domain: d,
    });
    setSavingDomain(false);
    if (error) {
      toast({ title: "Could not save domain", description: error.message, variant: "destructive" });
      return;
    }
    const saved = (data as string | null) ?? d;
    setSavedDomain(saved);
    setDomainInput(saved);
    toast({ title: "White-label domain saved", description: saved });
  };

  const handleAddClient = async () => {
    if (!email) return;
    const ce = normalizeEmail(form.email);
    if (!form.name.trim()) {
      toast({ title: "Client name is required", variant: "destructive" });
      return;
    }
    if (!isEmail(ce)) {
      toast({ title: "Enter a valid email", variant: "destructive" });
      return;
    }
    if (!form.phone.trim()) {
      toast({ title: "Phone number is required", variant: "destructive" });
      return;
    }
    if (!form.company.trim()) {
      toast({ title: "Agency name is required", variant: "destructive" });
      return;
    }
    if (!form.locationId.trim()) {
      toast({
        title: "Location ID is required",
        description: "This is the sub-account ID we use to open their account.",
        variant: "destructive",
      });
      return;
    }
    setAdding(true);
    const { error } = await supabase.rpc("upsert_agency_support_client" as any, {
      _owner_email: normalizeEmail(email),
      _client_email: ce,
      _client_name: form.name.trim(),
      _source: "manual",
      _agency_id: null,
      _client_phone: form.phone.trim(),
      _client_company: form.company.trim(),
      _location_id: form.locationId.trim(),
    });
    setAdding(false);
    if (error) {
      console.error("[AgencySupport] add client", error);
      toast({ title: "Could not add client", description: error.message, variant: "destructive" });
      return;
    }
    setForm({ name: "", email: "", phone: "", company: "", locationId: "" });
    await fetchClients();
    toast({
      title: "Client added",
      description: "Toggle Agency Support on to assign one of your accounts.",
    });
  };

  const prefillFromExisting = (c: AgencyClient) => {
    setPickerOpen(false);
    setForm((f) => ({
      ...f,
      name: c.user_name || f.name,
      email: c.user_email || f.email,
    }));
    toast({
      title: "Details pre-filled",
      description: "Add their phone, company and location ID to finish.",
    });
  };

  const openEdit = (client: SupportClient) => {
    setEditForm({
      name: client.client_name || "",
      phone: client.client_phone || "",
      company: client.client_company || "",
      locationId: client.location_id || "",
    });
    setEditTarget(client);
  };

  const saveEdit = async () => {
    if (!email || !editTarget) return;
    if (
      !editForm.name.trim() ||
      !editForm.phone.trim() ||
      !editForm.company.trim() ||
      !editForm.locationId.trim()
    ) {
      toast({
        title: "All fields are required",
        description: "Name, phone, company and location ID are all needed.",
        variant: "destructive",
      });
      return;
    }
    setSavingEdit(true);
    const { error } = await supabase.rpc("upsert_agency_support_client" as any, {
      _owner_email: normalizeEmail(email),
      _client_email: editTarget.client_email,
      _client_name: editForm.name.trim(),
      _source: editTarget.source || "manual",
      _agency_id: editTarget.agency_id,
      _client_phone: editForm.phone.trim(),
      _client_company: editForm.company.trim(),
      _location_id: editForm.locationId.trim(),
    });
    setSavingEdit(false);
    if (error) {
      console.error("[AgencySupport] edit client", error);
      toast({
        title: "Could not save changes",
        description: error.message,
        variant: "destructive",
      });
      return;
    }
    setClients((prev) =>
      prev.map((c) =>
        c.id === editTarget.id
          ? {
              ...c,
              client_name: editForm.name.trim(),
              client_phone: editForm.phone.trim(),
              client_company: editForm.company.trim(),
              location_id: editForm.locationId.trim(),
            }
          : c,
      ),
    );
    setEditTarget(null);
    toast({ title: "Client details updated", description: editTarget.client_email });
  };

  const requestAssign = (client: SupportClient) => {
    if (available <= 0) {
      toast({
        title: "No accounts available",
        description: "Purchase more Agency Support accounts to assign this client.",
        variant: "destructive",
      });
      return;
    }
    if (!savedDomain) {
      toast({
        title: "Add your white-label domain first",
        description: "We need it to open your client sub-accounts.",
        variant: "destructive",
      });
      return;
    }
    if (!client.location_id || !client.client_phone || !client.client_company) {
      toast({
        title: "Missing client details",
        description: "Phone, company and location ID are all required before assigning.",
        variant: "destructive",
      });
      return;
    }
    setConfirmTarget(client);
  };

  const setActive = async (client: SupportClient, next: boolean) => {
    if (!email) return;
    const { data, error } = await supabase.rpc("set_agency_support_client_active" as any, {
      _owner_email: normalizeEmail(email),
      _client_email: client.client_email,
      _active: next,
    });
    if (error || (data as any)?.ok === false) {
      const reason = (data as any)?.error;
      const lockedUntil = (data as any)?.locked_until as string | undefined;
      toast({
        title: reason === "locked" ? "Locked for 30 days" : "Could not update",
        description:
          reason === "locked"
            ? `This account is locked to ${client.client_email} until ${fmtDate(lockedUntil ?? null)}.`
            : reason === "no_seats_available"
              ? "You've allocated all of your Agency Support accounts."
              : reason === "missing_details"
                ? "Phone, company and location ID are all required before assigning."
                : error?.message || "Please try again.",
        variant: "destructive",
      });
      return false;
    }
    const lockedUntil = (data as any)?.locked_until as string | null;
    setClients((prev) =>
      prev.map((c) =>
        c.id === client.id
          ? {
              ...c,
              active: next,
              assigned_at: next ? new Date().toISOString() : null,
              locked_until: next ? (lockedUntil ?? null) : null,
            }
          : c,
      ),
    );
    return true;
  };

  const confirmAssign = async () => {
    if (!confirmTarget) return;
    setAssigning(true);
    const ok = await setActive(confirmTarget, true);
    setAssigning(false);
    setConfirmTarget(null);
    if (ok) {
      toast({
        title: "Account assigned",
        description: `Locked to ${confirmTarget.client_email} for the next ${LOCK_DAYS} days.`,
      });
    }
  };

  const toggleClient = (client: SupportClient, next: boolean) => {
    if (next) {
      requestAssign(client);
      return;
    }
    if (isLocked(client)) {
      toast({
        title: "Locked for 30 days",
        description: `This account stays with ${client.client_email} until ${fmtDate(client.locked_until)}.`,
        variant: "destructive",
      });
      return;
    }
    void setActive(client, false);
  };

  const removeClient = async (client: SupportClient) => {
    if (!email) return;
    if (client.active && isLocked(client)) {
      toast({
        title: "Locked for 30 days",
        description: `You can remove ${client.client_email} after ${fmtDate(client.locked_until)}.`,
        variant: "destructive",
      });
      return;
    }
    const { data, error } = await supabase.rpc("delete_agency_support_client" as any, {
      _owner_email: normalizeEmail(email),
      _client_email: client.client_email,
    });
    if (error || (data as any)?.ok === false) {
      toast({
        title: (data as any)?.error === "locked" ? "Locked for 30 days" : "Could not remove",
        description:
          (data as any)?.error === "locked"
            ? `You can remove this client after ${fmtDate((data as any)?.locked_until ?? null)}.`
            : error?.message || "Please try again.",
        variant: "destructive",
      });
      return;
    }
    setClients((prev) => prev.filter((c) => c.id !== client.id));
  };

  // A client was added (or removed): the panel's job is done, show the list.
  useEffect(() => {
    setAssignOpen(false);
  }, [clients.length]);

  const existingEmails = new Set(clients.map((c) => c.client_email.toLowerCase()));

  return (
    <div className="space-y-5 max-w-5xl mx-auto min-w-0">
      <PageHeader
        eyebrow="Done for you"
        title="Agency Support"
        subtitle="Our team answers your clients' support requests under your brand."
        actions={
          !loading && available === 0 ? (
            <Button variant="accent" className="min-h-11 gap-2 sm:min-h-0" onClick={openBuy}>
              <ShoppingCart aria-hidden="true" /> Buy seats
            </Button>
          ) : (
            <Button variant="accent" className="min-h-11 gap-2 sm:min-h-0" onClick={openAssign}>
              <UserPlus aria-hidden="true" /> Assign a seat
            </Button>
          )
        }
        more={[
          !loading && available === 0
            ? { label: "Assign a seat", icon: <UserPlus aria-hidden="true" />, onSelect: openAssign }
            : { label: "Buy seats", icon: <ShoppingCart aria-hidden="true" />, onSelect: openBuy },
          {
            label: "What is included",
            icon: <CircleHelp aria-hidden="true" />,
            onSelect: () => setIncludedOpen(true),
          },
        ]}
      />

      {loadError && <LoadNotice error={loadError} onRetry={() => void fetchWallet()} />}

      <StatStrip
        stats={(
          [
            ["Available", available, undefined],
            ["Assigned", used, undefined],
            ["Purchased", wallet, `$${UNIT_PRICE} per seat / month`],
          ] as const
        ).map(([label, value, hint]) => ({
          label,
          hint,
          value: loading ? (
            <span className="px-skeleton inline-block h-6 w-8" />
          ) : (
            <NumberTicker
              key={value}
              from={0}
              target={value}
              transition={{ duration: 0.8, type: "tween", ease: [0.16, 1, 0.3, 1] }}
            />
          ),
        }))}
      />

      <div ref={tabsRef} className="scroll-mt-20" />
      <Tabs
        value={shownTab}
        onValueChange={(v) => {
          setTabBehind(v);
          setActiveTab(v);
        }}
        className="min-w-0"
      >
        <TabsList className="gap-4 sm:gap-6">
          <TabsTrigger value="assign" className="min-h-11">
            Clients
          </TabsTrigger>
          <TabsTrigger value="projects" className="min-h-11">
            Projects
          </TabsTrigger>
        </TabsList>

        <TabsContent
          value="assign"
          className="mt-4 space-y-4 animate-in fade-in duration-200 motion-reduce:animate-none"
        >
          {/* White-label domain */}
          <SettingList>
            <SettingItem
              icon={<Globe />}
              title="White-label domain"
              value={savedDomain || "We need this to open your clients' sub-accounts"}
              status={
                savedDomain ? (
                  <Tag tone="success">
                    <Check aria-hidden="true" /> Saved
                  </Tag>
                ) : (
                  <Tag tone="warning">Needs setup</Tag>
                )
              }
              panel={{ description: "We need this to open your clients' sub-accounts." }}
            >
              <div className="grid sm:grid-cols-[1fr_auto] gap-2">
                <Input
                  id="as-domain"
                  aria-label="White-label domain"
                  placeholder="app.yourdomain.com"
                  value={domainInput}
                  onChange={(e) => setDomainInput(e.target.value)}
                  className="h-11 text-base"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      void saveDomain();
                    }
                  }}
                />
                <Button
                  onClick={saveDomain}
                  disabled={savingDomain}
                  className="h-11 w-full sm:w-auto"
                >
                  {savingDomain ? "Saving…" : savedDomain ? "Update domain" : "Save domain"}
                </Button>
              </div>
              {savedDomain && (
                <p className="text-xs text-muted-foreground mt-2">Saved as {savedDomain}</p>
              )}
            </SettingItem>
          </SettingList>

          {/* Add clients */}
          <EditorPanel
            open={assignOpen}
            onOpenChange={setAssignOpen}
            wide
            title="Assign a seat to a client"
            description={`${used} of ${wallet} seats assigned. All fields are required, and each assignment is locked for ${LOCK_DAYS} days.`}
          >
            <div className="space-y-4">
              {ghlConn.connected && ghlConn.locations.length > 0 && (
                <div className="space-y-1.5">
                  <Label>Pick the sub-account</Label>
                  <LocationList
                    locations={ghlConn.locations}
                    value={form.locationId || null}
                    maxHeight="14rem"
                    onSelect={(l) =>
                      setForm((f) => ({
                        ...f,
                        locationId: l.location_id,
                        company: l.company_name || l.name || f.company,
                        name: f.name || l.name || "",
                        email: l.email || f.email,
                        phone: l.phone || f.phone,
                      }))
                    }
                  />
                  <p className="text-xs text-muted-foreground">
                    We fill in the details from HighLevel. Check them below before adding.
                  </p>
                </div>
              )}
              <div className="grid sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="as-name">Client name</Label>
                  <Input
                    id="as-name"
                    autoComplete="name"
                    value={form.name}
                    onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                    className="h-11 text-base"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="as-email">Email</Label>
                  <Input
                    id="as-email"
                    type="email"
                    inputMode="email"
                    autoComplete="email"
                    placeholder="client@example.com"
                    value={form.email}
                    onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                    className="h-11 text-base"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="as-phone">Phone number</Label>
                  <Input
                    id="as-phone"
                    type="tel"
                    inputMode="tel"
                    autoComplete="tel"
                    placeholder="+1 555 123 4567"
                    value={form.phone}
                    onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                    className="h-11 text-base"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="as-company">Agency name</Label>
                  <Input
                    id="as-company"
                    autoComplete="organization"
                    value={form.company}
                    onChange={(e) => setForm((f) => ({ ...f, company: e.target.value }))}
                    className="h-11 text-base"
                  />
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <Label htmlFor="as-location">Location ID</Label>
                  <Input
                    id="as-location"
                    placeholder="Their sub-account ID"
                    value={form.locationId}
                    onChange={(e) => setForm((f) => ({ ...f, locationId: e.target.value }))}
                    className="h-11 text-base font-mono"
                  />
                </div>
              </div>

              <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:flex-wrap">
                <Button
                  onClick={handleAddClient}
                  disabled={adding}
                  className="h-11 w-full gap-2 sm:w-auto"
                >
                  <Plus className="w-4 h-4" /> {adding ? "Adding…" : "Add client"}
                </Button>

                <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      className="h-auto min-h-11 w-full max-w-full justify-between gap-2 whitespace-normal sm:w-auto"
                    >
                      <span className="truncate">Pre-fill from your existing users</span>
                      <ChevronsUpDown className="h-4 w-4 opacity-50 shrink-0" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[min(320px,calc(100vw-2rem))] p-0" align="start">
                    <Command>
                      <CommandInput placeholder="Search by name or email…" />
                      <CommandList>
                        <CommandEmpty>No users found.</CommandEmpty>
                        <CommandGroup>
                          {agencyClients
                            .filter((c) => c.user_email)
                            .map((c) => {
                              const already = existingEmails.has(
                                (c.user_email || "").toLowerCase(),
                              );
                              return (
                                <CommandItem
                                  key={c.user_id}
                                  value={`${c.user_name || ""} ${c.user_email || ""}`}
                                  onSelect={() => {
                                    if (!already) prefillFromExisting(c);
                                  }}
                                >
                                  <Check
                                    className={`mr-2 h-4 w-4 ${already ? "opacity-100" : "opacity-0"}`}
                                  />
                                  <div className="flex flex-col">
                                    <span className="text-sm">{c.user_name || c.user_email}</span>
                                    {c.user_name && (
                                      <span className="text-xs text-muted-foreground">
                                        {c.user_email}
                                      </span>
                                    )}
                                  </div>
                                </CommandItem>
                              );
                            })}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>
            </div>
          </EditorPanel>

          {/* Roster */}
          <SectionCard icon={<Users />} title="Your clients" description="Everyone with a support seat.">
              {clients.length === 0 ? (
                <EmptyState
                  className="py-8"
                  title="No clients have a seat yet"
                  action={
                    <Button variant="outline" onClick={openAssign}>
                      Assign a seat
                    </Button>
                  }
                />
              ) : (
                <>
                  {/* Mobile: stacked cards */}
                  <div className="space-y-3 md:hidden">
                    {clients.map((c) => {
                      const locked = c.active && isLocked(c);
                      return (
                        <div key={c.id} className="rounded-lg border border-border p-3">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <p className="font-medium text-sm truncate">
                                {c.client_company || c.client_name || "Not set"}
                              </p>
                              <p className="text-xs text-muted-foreground break-all">
                                {c.client_email}
                              </p>
                              <p className="text-[11px] text-muted-foreground mt-0.5">
                                {c.client_name || "Not set"} · {c.client_phone || "no phone"}
                              </p>
                              <p className="text-[11px] text-muted-foreground font-mono break-all">
                                {c.location_id || "no location ID"}
                              </p>
                            </div>
                            <div className="flex items-center shrink-0">
                              <MoreMenu
                                label={`More for ${c.client_email}`}
                                items={[
                                  { label: "Edit details", icon: <Pencil aria-hidden="true" />, onSelect: () => openEdit(c) },
                                  { label: "Remove client", icon: <Trash2 aria-hidden="true" />, danger: true, onSelect: () => void removeClient(c) },
                                ]}
                              />
                            </div>
                          </div>
                          <div className="flex items-center justify-between gap-2 mt-3 pt-3 border-t border-border">
                            <span className="text-sm">Agency Support</span>
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-muted-foreground">
                                {locked
                                  ? `Locked until ${fmtDate(c.locked_until)}`
                                  : c.active
                                    ? "Active"
                                    : "Off"}
                              </span>
                              <Switch
                                checked={c.active}
                                disabled={locked}
                                onCheckedChange={(v) => toggleClient(c, v)}
                                aria-label={`Toggle Agency Support for ${c.client_email}`}
                              />
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Desktop: table */}
                  <div className="hidden md:block overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Client</TableHead>
                          <TableHead>Email</TableHead>
                          <TableHead>Phone</TableHead>
                          <TableHead>Location ID</TableHead>
                          <TableHead>Agency Support</TableHead>
                          <TableHead className="w-16 text-right"><span className="sr-only">More</span></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {clients.map((c) => {
                          const locked = c.active && isLocked(c);
                          return (
                            <TableRow key={c.id}>
                              <TableCell>
                                <span className="font-medium">{c.client_company || "Not set"}</span>
                                <span className="block text-xs text-muted-foreground">
                                  {c.client_name || "Not set"}
                                </span>
                              </TableCell>
                              <TableCell className="whitespace-nowrap">{c.client_email}</TableCell>
                              <TableCell className="whitespace-nowrap text-muted-foreground text-xs">
                                {c.client_phone || "Not set"}
                              </TableCell>
                              <TableCell className="font-mono text-xs">
                                {c.location_id || "Not set"}
                              </TableCell>
                              <TableCell>
                                <div className="flex items-center gap-2">
                                  <Switch
                                    checked={c.active}
                                    disabled={locked}
                                    onCheckedChange={(v) => toggleClient(c, v)}
                                  />
                                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                                    {locked && <Lock className="w-3 h-3" />}
                                    {locked
                                      ? `Locked until ${fmtDate(c.locked_until)}`
                                      : c.active
                                        ? "Active"
                                        : "Off"}
                                  </span>
                                </div>
                              </TableCell>
                              <TableCell>
                                <div className="flex items-center justify-end">
                                  <MoreMenu
                                    size="sm"
                                    label={`More for ${c.client_email}`}
                                    items={[
                                      { label: "Edit details", icon: <Pencil aria-hidden="true" />, onSelect: () => openEdit(c) },
                                      { label: "Remove client", icon: <Trash2 aria-hidden="true" />, danger: true, onSelect: () => void removeClient(c) },
                                    ]}
                                  />
                                </div>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                </>
              )}
          </SectionCard>
        </TabsContent>
        <EditorPanel
          open={buyOpen}
          onOpenChange={(o) => {
            if (!o && activeTab === "purchase") setActiveTab(tabBehind);
          }}
          title="Buy seats"
          description={`$${UNIT_PRICE} per seat each month. Seats are added to your balance as soon as you pay.`}
        >
          <div>
                {native ? (
                  <p className="text-sm text-muted-foreground mt-3">
                    In the app you buy one seat at a time through the App Store or Google Play.
                  </p>
                ) : (
                  <div className="flex items-center gap-2 mt-3 flex-wrap">
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-11 w-11 shrink-0"
                      aria-label="Decrease quantity"
                      onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                    >
                      <Minus className="w-4 h-4" />
                    </Button>
                    <Input
                      type="number"
                      inputMode="numeric"
                      aria-label="Number of accounts"
                      min={1}
                      max={100}
                      value={quantity}
                      onChange={(e) =>
                        setQuantity(Math.max(1, Math.min(100, Number(e.target.value) || 1)))
                      }
                      className="w-20 h-11 text-center text-base"
                    />
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-11 w-11 shrink-0"
                      aria-label="Increase quantity"
                      onClick={() => setQuantity((q) => Math.min(100, q + 1))}
                    >
                      <Plus className="w-4 h-4" />
                    </Button>
                    <span className="text-sm text-muted-foreground">
                      {quantity} {quantity === 1 ? "seat" : "seats"} · ${quantity * UNIT_PRICE} per month
                    </span>
                  </div>
                )}

                <Button
                  variant="accent"
                  className="mt-4 min-h-11 w-full gap-2 sm:w-auto"
                  disabled={purchasingSeat}
                  onClick={() => {
                    if (native) {
                      void purchaseStoreSeat();
                      return;
                    }
                    setCompleted(false);
                    setCheckoutOpen(true);
                  }}
                >
                  {purchasingSeat ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <ShoppingCart className="w-4 h-4" />
                  )}
                  {native
                    ? purchasingSeat
                      ? "Purchasing…"
                      : "Buy 1 seat"
                    : "Continue to checkout"}
                </Button>
                <p className="mt-4 text-xs text-muted-foreground">
                  Each assignment is locked to its client for {LOCK_DAYS} days.
                </p>
          </div>
        </EditorPanel>
        <TabsContent
          value="projects"
          className="mt-4 min-w-0 animate-in fade-in duration-200 motion-reduce:animate-none"
        >
          <AgencyProjectsBoard
            ownerEmail={(email || "").toLowerCase()}
            clients={clients.map((c) => ({
              email: c.client_email,
              name: c.client_name,
              company: c.client_company,
              locationId: c.location_id,
            }))}
          />
        </TabsContent>
      </Tabs>

      <Dialog open={includedOpen} onOpenChange={setIncludedOpen}>
        <DialogContent className="sm:max-w-lg w-[calc(100vw-1.5rem)] max-h-[92dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>We handle support for your clients</DialogTitle>
            <DialogDescription>
              One seat covers one client. Assign it and they can reach our team right away.
            </DialogDescription>
          </DialogHeader>
          <ul className="space-y-2">
            {AGENCY_FEATURES.map((feature) => (
              <li key={feature} className="flex items-start gap-2 text-sm text-foreground">
                <Check className="mt-0.5 size-4 shrink-0 text-brand" aria-hidden="true" />
                {feature.replace(/\s—\s/g, ", ")}
              </li>
            ))}
          </ul>
          <p className="text-xs text-muted-foreground">
            ${UNIT_PRICE} per seat each month. Each assignment is locked to its client for {LOCK_DAYS} days.
          </p>
        </DialogContent>
      </Dialog>

      {/* Edit existing client details */}
      <Dialog
        open={!!editTarget}
        onOpenChange={(o) => {
          if (!o) setEditTarget(null);
        }}
      >
        <DialogContent className="sm:max-w-lg w-[calc(100vw-1.5rem)] max-h-[92dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit client details</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground -mt-2 break-all">
            {editTarget?.client_email}
          </p>
          <div className="grid sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="as-edit-name">Client name</Label>
              <Input
                id="as-edit-name"
                value={editForm.name}
                onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
                className="h-11 text-base"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="as-edit-phone">Phone number</Label>
              <Input
                id="as-edit-phone"
                type="tel"
                inputMode="tel"
                placeholder="+1 555 123 4567"
                value={editForm.phone}
                onChange={(e) => setEditForm((f) => ({ ...f, phone: e.target.value }))}
                className="h-11 text-base"
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="as-edit-company">Agency name</Label>
              <Input
                id="as-edit-company"
                value={editForm.company}
                onChange={(e) => setEditForm((f) => ({ ...f, company: e.target.value }))}
                className="h-11 text-base"
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="as-edit-location">Location ID</Label>
              <Input
                id="as-edit-location"
                placeholder="Their sub-account ID"
                value={editForm.locationId}
                onChange={(e) => setEditForm((f) => ({ ...f, locationId: e.target.value }))}
                className="h-11 text-base font-mono"
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setEditTarget(null)}
              disabled={savingEdit}
              className="h-11"
            >
              Cancel
            </Button>
            <Button onClick={() => void saveEdit()} disabled={savingEdit} className="h-11">
              {savingEdit ? "Saving…" : "Save changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 30-day lock confirmation */}
      <AlertDialog
        open={!!confirmTarget}
        onOpenChange={(o) => {
          if (!o) setConfirmTarget(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Lock className="w-4 h-4" /> Lock this account for {LOCK_DAYS} days?
            </AlertDialogTitle>
            <AlertDialogDescription>
              You're assigning one Agency Support account to{" "}
              <span className="font-medium">
                {confirmTarget?.client_company ||
                  confirmTarget?.client_name ||
                  confirmTarget?.client_email}
              </span>{" "}
              ({confirmTarget?.client_email}). It stays with them for {LOCK_DAYS} days and cannot be
              turned off, removed or moved to another client until then.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={assigning}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                void confirmAssign();
              }}
              disabled={assigning}
            >
              {assigning ? "Assigning…" : `Assign and lock for ${LOCK_DAYS} days`}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog
        open={checkoutOpen && !native}
        onOpenChange={(v) => {
          if (!v) handleCloseCheckout();
        }}
      >
        <DialogContent
          className="sm:max-w-2xl w-[calc(100vw-1.5rem)] max-h-[92dvh] overflow-y-auto p-0 gap-0 [&>button]:hidden"
          onPointerDownOutside={(e) => e.preventDefault()}
          onInteractOutside={(e) => e.preventDefault()}
        >
          <div className="flex items-center justify-between px-4 py-3 border-b">
            <h3 className="font-semibold text-lg">
              {completed
                ? "Payment Successful"
                : `Agency Support · ${quantity} account${quantity === 1 ? "" : "s"} · $${quantity * UNIT_PRICE}/mo`}
            </h3>
            <Button variant="ghost" size="icon" onClick={handleCloseCheckout} aria-label="Close">
              <X className="h-4 w-4" />
            </Button>
          </div>
          <div className="p-4">
            {completed ? (
              <div className="text-center py-8">
                <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
                <h3 className="text-2xl font-bold mb-2">Thank you</h3>
                <p className="text-muted-foreground mb-6">
                  Your Agency Support seats are ready to assign.
                </p>
                <Button onClick={handleCloseCheckout}>Assign seats</Button>
              </div>
            ) : (
              <EmbeddedCheckoutProvider
                stripe={stripePromise}
                options={{ fetchClientSecret, onComplete: handleComplete }}
              >
                <EmbeddedCheckout />
              </EmbeddedCheckoutProvider>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AgencySupportManager;

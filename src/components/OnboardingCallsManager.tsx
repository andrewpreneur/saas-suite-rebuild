import LocationList from "@/components/highlevel/LocationList";
import { useGhl } from "@/components/highlevel/useGhl";
import { PageHeader } from "@/components/platform/PageHeader";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { loadStripe } from "@stripe/stripe-js";
import {
  EmbeddedCheckoutProvider,
  EmbeddedCheckout,
} from "@stripe/react-stripe-js";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
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
  CheckCircle,
  ShoppingCart,
  X,
  Video,
  ExternalLink,
  Users,
  Layers,
  UserCheck,
  Save,
  ChevronsUpDown,
  Check,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useUser } from "@/contexts/UserContext";
import OnboardingAutopayCard from "@/components/onboarding/OnboardingAutopayCard";
import OnboardingCallRecorder from "@/components/onboarding/OnboardingCallRecorder";
import { useToast } from "@/hooks/use-toast";
import { LoadNotice } from "@/components/platform/LoadNotice";
import { LOAD_TIMEOUT_MESSAGE, armLoadDeadline, loadErrorText } from "@/lib/loadSettle";

const STRIPE_PK =
  "pk_live_51MjPyIGdZ9PRE3ZipiIrE9ZxAF9obgIObU1VX1MgwWuh3SpFaq0nTZH8VLPDzrs0N9JREHGq0hnyGm1Kpd20Ev1I00UQDvqjfC";

const OnboardingCallsManager = () => {
  const { email } = useUser();
  const ghlConn = useGhl();
  const { toast } = useToast();
  const [wallet, setWallet] = useState<number>(0);
  const [access, setAccess] = useState<boolean>(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [bookings, setBookings] = useState<any[]>([]);
  const sessionIdRef = useRef<string | null>(null);

  // Deployment configuration
  type DeployMode = "ALL" | "PLANS" | "USERS";
  const [deployMode, setDeployMode] = useState<DeployMode>("ALL");
  const [deployPlans, setDeployPlans] = useState<string[]>([]);
  const [deployUsers, setDeployUsers] = useState<string[]>([]);
  const [deployConfigured, setDeployConfigured] = useState(false);
  const [userInput, setUserInput] = useState("");
  const [savingDeploy, setSavingDeploy] = useState(false);
  type AgencyClient = { user_id: string; user_name: string | null; user_email: string | null };
  const [agencyClients, setAgencyClients] = useState<AgencyClient[]>([]);
  const [pickerOpen, setPickerOpen] = useState(false);

  const stripePromise = useMemo(() => loadStripe(STRIPE_PK), []);

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
      .select(
        "onboarding_call_wallet, onboarding_call_access, onboarding_deployment_mode, onboarding_deployment_plans, onboarding_deployment_users, onboarding_deployment_configured",
      )
      .ilike("email", email)
      .maybeSingle();
    if (error) throw error;
    if (data) {
      setWallet((data as any).onboarding_call_wallet ?? 0);
      setAccess(Boolean((data as any).onboarding_call_access));
      setDeployMode(((data as any).onboarding_deployment_mode as DeployMode) || "ALL");
      setDeployPlans(((data as any).onboarding_deployment_plans as string[]) || []);
      setDeployUsers(((data as any).onboarding_deployment_users as string[]) || []);
      setDeployConfigured(Boolean((data as any).onboarding_deployment_configured));
    }
    } catch (loadFailure) {
      setLoadError(loadErrorText(loadFailure, "Couldn't load onboarding calls."));
    } finally {
      stop();
      setLoading(false);
    }
  }, [email]);

  const fetchBookings = useCallback(async () => {
    if (!email) return;
    const { data } = await supabase
      .from("onboarding_calls" as any)
      .select("*")
      .ilike("owner_email", email)
      .order("scheduled_at", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false });
    setBookings((data as any[]) ?? []);
  }, [email]);

  const fetchAgencyClients = useCallback(async () => {
    if (!email) return;
    const { data: userData } = await supabase
      .from("saas_suite_users")
      .select(
        "agency_id, agency_id_basic, agency_id_advanced, agency_id_elite",
      )
      .ilike("email", email)
      .maybeSingle();
    if (!userData) return;
    const ids = [
      (userData as any).agency_id,
      (userData as any).agency_id_basic,
      (userData as any).agency_id_advanced,
      (userData as any).agency_id_elite,
    ].filter(Boolean) as string[];
    const all: AgencyClient[] = [];
    for (const aid of ids) {
      const { data } = await supabase.rpc("get_agency_clients", { p_agency_id: aid });
      if (data) {
        for (const c of data as any[]) {
          all.push({
            user_id: c.user_id,
            user_name: c.user_name,
            user_email: c.user_email,
          });
        }
      }
    }
    const map = new Map<string, AgencyClient>();
    for (const c of all) map.set(c.user_id, c);
    setAgencyClients(Array.from(map.values()));
  }, [email]);

  useEffect(() => {
    fetchWallet();
    fetchBookings();
    fetchAgencyClients();
  }, [fetchWallet, fetchBookings, fetchAgencyClients]);

  // Handle return from Stripe redirect (in case redirect_on_completion fires)
  useEffect(() => {
    const url = new URL(window.location.href);
    if (url.searchParams.get("onboardingPurchase") === "true") {
      url.searchParams.delete("onboardingPurchase");
      url.searchParams.delete("email");
      window.history.replaceState({}, "", url.pathname + url.search);
      fetchWallet();
    }
  }, [fetchWallet]);

  const fetchClientSecret = useCallback(async () => {
    const { data, error } = await supabase.functions.invoke("create-onboarding-checkout", {
      body: { email, quantity: 1 },
    });
    if (error) throw new Error(error.message);
    if (data?.error) throw new Error(data.error);
    sessionIdRef.current = data.sessionId;
    return data.clientSecret as string;
  }, [email]);

  const handleComplete = useCallback(async () => {
    setCompleted(true);
    if (!sessionIdRef.current) return;
    try {
      const { data, error } = await supabase.functions.invoke("notify-onboarding-purchase", {
        body: { sessionId: sessionIdRef.current, fallbackEmail: email },
      });
      if (error) throw error;
      if (data?.wallet != null) {
        setWallet(data.wallet);
        setAccess(true);
      }
      toast({ title: "Purchase complete", description: "Onboarding call added to your wallet." });
    } catch (e) {
      console.error("[OnboardingCalls] notify error", e);
      toast({
        title: "Purchase recorded",
        description: "It may take a moment to appear in your wallet.",
      });
    }
    // Refresh after a moment
    setTimeout(fetchWallet, 1500);
  }, [email, fetchWallet, toast]);

  const handleClose = () => {
    sessionIdRef.current = null;
    setCompleted(false);
    setCheckoutOpen(false);
  };

  const togglePlan = (plan: string) => {
    setDeployPlans((prev) =>
      prev.includes(plan) ? prev.filter((p) => p !== plan) : [...prev, plan],
    );
  };

  const addUser = () => {
    const v = userInput.trim().toLowerCase();
    if (!v) return;
    if (deployUsers.includes(v)) {
      setUserInput("");
      return;
    }
    setDeployUsers((prev) => [...prev, v]);
    setUserInput("");
  };

  const removeUser = (u: string) =>
    setDeployUsers((prev) => prev.filter((x) => x !== u));

  const toggleUserFromList = (emailVal: string) => {
    const v = emailVal.trim().toLowerCase();
    if (!v) return;
    setDeployUsers((prev) =>
      prev.includes(v) ? prev.filter((x) => x !== v) : [...prev, v],
    );
  };

  const saveDeployment = async () => {
    if (!email) return;
    const isOff =
      (deployMode === "PLANS" && deployPlans.length === 0) ||
      (deployMode === "USERS" && deployUsers.length === 0);
    setSavingDeploy(true);
    const { error } = await supabase
      .from("saas_suite_users")
      .update({
        onboarding_deployment_mode: deployMode,
        onboarding_deployment_plans: deployMode === "PLANS" ? deployPlans : [],
        onboarding_deployment_users: deployMode === "USERS" ? deployUsers : [],
        onboarding_deployment_configured: true,
      } as any)
      .ilike("email", email);
    setSavingDeploy(false);
    if (error) {
      toast({
        title: "Could not save",
        description: error.message,
        variant: "destructive",
      });
      return;
    }
    setDeployConfigured(true);
    toast({
      title: isOff ? "Onboarding calls turned off" : "Deployment saved",
      description: isOff
        ? "No one has access to onboarding calls right now. Add a plan or user to turn it back on."
        : deployMode === "ALL"
          ? "Onboarding calls are now active for all sub-accounts."
          : deployMode === "PLANS"
            ? `Onboarding calls are active for ${deployPlans.length} plan(s).`
            : `Onboarding calls are active for ${deployUsers.length} user(s).`,
    });
  };


  const planOptions: { id: string; label: string; tooltip: string }[] = [
    {
      id: "PLAN_1",
      label: "Plan 1",
      tooltip:
        "Only users on Plan 1 will get access to onboarding calls. Other plans will not see the option.",
    },
    {
      id: "PLAN_2",
      label: "Plan 2",
      tooltip:
        "Only users on Plan 2 will get access to onboarding calls. Other plans will not see the option.",
    },
    {
      id: "PLAN_3",
      label: "Plan 3",
      tooltip:
        "Only users on Plan 3 will get access to onboarding calls. Other plans will not see the option.",
    },
  ];

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <PageHeader
        title="Onboarding Calls"
        subtitle="Book a 1-on-1 onboarding session for a client. $60 per call, or one call from your balance when Auto-Pay is on."
      />

      {/* Deployment Setup */}
      <Card className={!deployConfigured ? "border-primary/50 shadow-glow" : ""}>
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                {!deployConfigured && (
                  <Badge variant="default" className="text-[10px]">
                    Suggested
                  </Badge>
                )}
                Deploy Onboarding Calls
              </CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                Choose how to deploy onboarding calls before your users can start
                using them.
              </p>
            </div>
            {deployConfigured && (
              <Badge variant="secondary" className="gap-1">
                <CheckCircle className="w-3 h-3" /> Configured
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid sm:grid-cols-3 gap-3">
            {[
              {
                id: "ALL" as const,
                icon: Users,
                title: "All Sub-Accounts",
                desc: "Every sub-account under your agency gets access.",
              },
              {
                id: "PLANS" as const,
                icon: Layers,
                title: "Specific Plans",
                desc: "Only users on selected plans get access.",
              },
              {
                id: "USERS" as const,
                icon: UserCheck,
                title: "Specific Users",
                desc: "Hand-pick users already logged into your agency.",
              },
            ].map((opt) => {
              const Icon = opt.icon;
              const selected = deployMode === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setDeployMode(opt.id)}
                  className={`text-left p-4 rounded-lg border-2 transition-colors ${
                    selected
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-primary/40"
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <Icon className="w-4 h-4 text-primary" />
                    <span className="font-semibold text-sm">{opt.title}</span>
                  </div>
                  <p className="text-xs text-muted-foreground">{opt.desc}</p>
                </button>
              );
            })}
          </div>

          {deployMode === "PLANS" && (
            <div className="space-y-2">
              <p className="text-sm font-medium">Select which plans get onboarding calls:</p>
              <div className="flex flex-wrap gap-2">
                {planOptions.map((p) => {
                  const on = deployPlans.includes(p.id);
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => togglePlan(p.id)}
                      className={`rounded-md border px-3 py-1.5 text-sm transition-colors ${
                        on
                          ? "border-primary bg-primary text-primary-foreground"
                          : "bg-background hover:bg-accent"
                      }`}
                    >
                      {p.label}
                    </button>
                  );
                })}
              </div>
              <p className="text-xs text-muted-foreground">
                {deployPlans.length === 0
                  ? "Turn on a plan to give only that plan's clients onboarding calls. Plans you leave off will not see the option."
                  : planOptions
                      .filter((p) => deployPlans.includes(p.id))
                      .map((p) => p.tooltip)
                      .join(" ")}
              </p>
            </div>
          )}

          {deployMode === "USERS" && (
            <div className="space-y-2">
              <p className="text-sm font-medium">
                {ghlConn.connected ? "Pick the sub-accounts that should get onboarding calls:" : "Add user emails who should get onboarding calls:"}
              </p>
              {ghlConn.connected && ghlConn.locations.length > 0 ? (
                <LocationList
                  locations={ghlConn.locations}
                  value={null}
                  isActive={(l) => !!l.email && deployUsers.includes(l.email.toLowerCase())}
                  onSelect={(l) => {
                    if (!l.email) {
                      toast({ title: "No email on this sub-account", description: "Add a business email to it in HighLevel first.", variant: "destructive" });
                      return;
                    }
                    toggleUserFromList(l.email);
                  }}
                />
              ) : (
              <>
              <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
                <PopoverTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    role="combobox"
                    className="w-full justify-between"
                  >
                    Pick from your existing users
                    <ChevronsUpDown className="ml-2 h-4 w-4 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                  <Command>
                    <CommandInput placeholder="Search by name or email…" />
                    <CommandList>
                      <CommandEmpty>No users found.</CommandEmpty>
                      <CommandGroup>
                        {agencyClients
                          .filter((c) => c.user_email)
                          .map((c) => {
                            const e = (c.user_email || "").toLowerCase();
                            const selected = deployUsers.includes(e);
                            return (
                              <CommandItem
                                key={c.user_id}
                                value={`${c.user_name || ""} ${c.user_email || ""}`}
                                onSelect={() => toggleUserFromList(e)}
                              >
                                <Check
                                  className={`mr-2 h-4 w-4 ${selected ? "opacity-100" : "opacity-0"}`}
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
              <p className="text-xs text-muted-foreground">Or add an email manually:</p>
              <div className="flex gap-2">
                <Input
                  type="email"
                  placeholder="user@example.com"
                  value={userInput}
                  onChange={(e) => setUserInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addUser();
                    }
                  }}
                />
                <Button type="button" variant="outline" onClick={addUser}>
                  Add
                </Button>
              </div>
              </>
              )}
              {deployUsers.length > 0 && (
                <div className="flex flex-wrap gap-2 pt-1">
                  {deployUsers.map((u) => (
                    <Badge key={u} variant="secondary" className="gap-1">
                      {u}
                      <button
                        type="button"
                        onClick={() => removeUser(u)}
                        className="ml-1 opacity-70 hover:opacity-100"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              )}
              <p className="text-xs text-muted-foreground">
                Only these users will see and be able to book onboarding calls.
              </p>
            </div>
          )}

          <div className="flex justify-end">
            <Button onClick={saveDeployment} disabled={savingDeploy} className="gap-2">
              <Save className="w-4 h-4" />
              {savingDeploy ? "Saving…" : "Save Deployment"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Calls Available
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-end gap-3">
              <span className="text-5xl font-bold">{loading ? "…" : wallet}</span>
              {loadError && (
                <LoadNotice error={loadError} onRetry={() => void fetchWallet()} />
              )}
              <Badge variant={access && wallet > 0 ? "default" : "secondary"} className="mb-2">
                {access && wallet > 0 ? "Active" : "Inactive"}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Each call you book is automatically deducted from your wallet.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Buy More Calls
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">$60<span className="text-base font-normal text-muted-foreground"> / call</span></p>
            <Button
              className="mt-3 h-auto w-full gap-2 whitespace-normal"
              onClick={() => {
                setCompleted(false);
                setCheckoutOpen(true);
              }}
            >
              <ShoppingCart className="w-4 h-4" />
              Purchase Onboarding Call
            </Button>
          </CardContent>
        </Card>
      </div>

      {email && <OnboardingAutopayCard ownerEmail={email.trim().toLowerCase()} />}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">How it works</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-2">
          <p>1. Purchase an onboarding call — your wallet increases instantly.</p>
          <p>2. Book your call using the link our team will send you.</p>
          <p>3. When the call is booked, 1 credit is automatically deducted.</p>
          <p>4. Repeat any time — buy as many calls as you need.</p>
        </CardContent>
      </Card>

      {email && (
        <OnboardingCallRecorder
          ownerEmail={email.trim().toLowerCase()}
          onChanged={() => { fetchWallet(); fetchBookings(); }}
        />
      )}

      <Dialog open={checkoutOpen} onOpenChange={(v) => { if (!v) handleClose(); }}>
        <DialogContent
          className="sm:max-w-2xl max-h-[90vh] overflow-y-auto p-0 gap-0 [&>button]:hidden"
          onPointerDownOutside={(e) => e.preventDefault()}
          onInteractOutside={(e) => e.preventDefault()}
        >
          <div className="flex items-center justify-between px-4 py-3 border-b">
            <h3 className="font-semibold text-lg">
              {completed ? "Payment Successful" : "Purchase Onboarding Call — $60"}
            </h3>
            <Button variant="ghost" size="icon" onClick={handleClose} aria-label="Close">
              <X className="h-4 w-4" />
            </Button>
          </div>
          <div className="p-4">
            {completed ? (
              <div className="text-center py-8">
                <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
                <h3 className="text-2xl font-bold mb-2">Thank you!</h3>
                <p className="text-muted-foreground mb-6">
                  Your onboarding call has been added to your wallet.
                </p>
                <Button onClick={handleClose}>Close</Button>
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

export default OnboardingCallsManager;
import { useState, useEffect, useRef, type ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { AtSign, ChevronRight, CircleHelp, HandCoins, Link2, MessageCircle, TicketPercent, Wallet } from "lucide-react";
import { Reveal, RevealItem } from "@/components/premium/Reveal";
import { SectionCard } from "@/components/premium/SectionCard";
import { SettingItem, SettingList } from "@/components/premium/SettingList";
import { HowItWorksDialog } from "@/components/premium/grow/HowItWorksDialog";
import type { MoreMenuItem } from "@/components/premium/MoreMenu";
import { PageHeader } from "@/components/platform/PageHeader";
import { TextUsDialog } from "@/components/dashboard/SetupHelpPopup";
import { EmptyState } from "@/components/premium/21st/empty-state";
import { CopyConfirmIcon } from "@/components/premium/dashboard/CopyConfirmIcon";
import AffiliateReferralsPanel from "@/components/affiliate/AffiliateReferralsPanel";
import { supabase } from "@/integrations/supabase/client";
import { useUser } from "@/contexts/UserContext";
import { toast } from "sonner";
import { LoadNotice } from "@/components/platform/LoadNotice";
import { LOAD_TIMEOUT_MESSAGE, armLoadDeadline, loadErrorText } from "@/lib/loadSettle";
import { AFFILIATE_SALES_PAGES, affiliateShareUrl } from "@/lib/affiliateOffers";
import { affiliatePortalEmail, affiliateQueryData } from "@/lib/affiliatePortal";

const SALES_PAGES = AFFILIATE_SALES_PAGES;

interface AffiliateData {
  id: string;
  affiliate_slug: string;
  full_name: string;
  status: string;
  payout_method?: any;
}

interface ReferralRow {
  id: string;
  referred_email: string;
  referred_name: string | null;
  plan: string | null;
  status: string;
  created_at: string;
  commission_rate: number;
}

interface PageStats {
  page: string;
  views: number;
  clicks: number;
}

export default function AffiliateDashboard() {
  const identity = useUser();
  const email = affiliatePortalEmail(identity);
  const loadVersion = useRef(0);
  const [affiliate, setAffiliate] = useState<AffiliateData | null>(null);
  const [referrals, setReferrals] = useState<ReferralRow[]>([]);
  const [pageStats, setPageStats] = useState<PageStats[]>([]);
  const [pendingPayouts, setPendingPayouts] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [editingSlug, setEditingSlug] = useState(false);
  const [newSlug, setNewSlug] = useState("");
  const [copiedPage, setCopiedPage] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"dashboard" | "payout">("dashboard");
  const [commissionPercent, setCommissionPercent] = useState(30);
  const [shareOpen, setShareOpen] = useState(false);
  const [pagesOpen, setPagesOpen] = useState(false);
  const [howOpen, setHowOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);

  // Payout method state
  const [payoutType, setPayoutType] = useState<"bank" | "paypal">("bank");
  const [paypalEmail, setPaypalEmail] = useState("");
  const [bankCountry, setBankCountry] = useState("");
  const [transferType, setTransferType] = useState("international_wire");
  const [beneficiaryName, setBeneficiaryName] = useState("");
  const [beneficiaryAddress, setBeneficiaryAddress] = useState("");
  const [bankName, setBankName] = useState("");
  const [swiftBic, setSwiftBic] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [routingNumber, setRoutingNumber] = useState("");
  const [iban, setIban] = useState("");
  const [intermediaryBank, setIntermediaryBank] = useState("");
  const [showIntermediary, setShowIntermediary] = useState(false);
  const [confirmAccurate, setConfirmAccurate] = useState(false);
  const [savingPayout, setSavingPayout] = useState(false);

  // Application state (shown when the user isn't an affiliate yet)
  const [applyName, setApplyName] = useState("");
  const [applyCompany, setApplyCompany] = useState("");
  const [applyNetworkSize, setApplyNetworkSize] = useState("");
  const [applyAudience, setApplyAudience] = useState("");
  const [applying, setApplying] = useState(false);

  const handleApply = async () => {
    if (!email) return;
    if (!applyName.trim() || !applyNetworkSize) {
      toast.error("Add your name and audience size");
      return;
    }
    setApplying(true);
    try {
      const base =
        applyName.trim().split(" ")[0].toLowerCase().replace(/[^a-z0-9]/g, "") || "partner";

      // Slugs are globally unique but RLS hides other people's rows, so we can't
      // pre-check for collisions — retry with a suffix if the insert conflicts.
      let lastError: any = null;
      for (let attempt = 0; attempt < 6; attempt++) {
        const slug = attempt === 0 ? base : `${base}${attempt + 1}`;
        const { error } = await supabase.from("affiliates").insert({
          full_name: applyName.trim(),
          email,
          company: applyCompany.trim() || null,
          network_size: applyNetworkSize,
          audience_description: applyAudience.trim() || null,
          affiliate_slug: slug,
          user_email_linked: email,
        });
        if (!error) {
          lastError = null;
          break;
        }
        lastError = error;
        if (error.code !== "23505") break;
      }
      if (lastError) throw lastError;

      toast.success("You're in. Your affiliate links are ready.");
      await loadData();
    } catch (err: any) {
      console.error(err);
      toast.error(err?.message || "Could not submit your application");
    } finally {
      setApplying(false);
    }
  };

  useEffect(() => {
    if (email) loadData();
    else {
      setAffiliate(null);
      setReferrals([]);
      setPageStats([]);
      setPendingPayouts(0);
      setLoading(false);
      setLoadError(null);
    }
    return () => { loadVersion.current += 1; };
  }, [email, loadAttempt]);

  const loadData = async () => {
    if (!email) {
      setLoading(false);
      setLoadError(null);
      return;
    }
    const version = ++loadVersion.current;
    const isCurrent = () => loadVersion.current === version;
    setAffiliate(null);
    setReferrals([]);
    setPageStats([]);
    setPendingPayouts(0);
    hydratePayoutMethod(null);
    setEditingSlug(false);
    setLoading(true);
    setLoadError(null);
    const stop = armLoadDeadline(() => {
      if (!isCurrent()) return;
      setLoading(false);
      setLoadError(LOAD_TIMEOUT_MESSAGE);
    });

    try {
    // Get affiliate record by linked email
    const aff = affiliateQueryData(await supabase
      .from("affiliates")
      .select("id, affiliate_slug, full_name, status, payout_method")
      .ilike("user_email_linked", email)
      .maybeSingle());
    if (!isCurrent()) return;

    if (!aff) {
      // Try by email field
      const affByEmail = affiliateQueryData(await supabase
        .from("affiliates")
        .select("id, affiliate_slug, full_name, status, payout_method")
        .ilike("email", email)
        .maybeSingle());
      if (!isCurrent()) return;
      if (affByEmail) {
        setAffiliate(affByEmail as AffiliateData);
        hydratePayoutMethod((affByEmail as any).payout_method);
        await loadAffiliateDetails(affByEmail.id, isCurrent);
      }
    } else {
      setAffiliate(aff as AffiliateData);
      hydratePayoutMethod((aff as any).payout_method);
      await loadAffiliateDetails(aff.id, isCurrent);
    }

    if (isCurrent()) setLoadError(null);
    } catch (error) {
      if (isCurrent()) setLoadError(loadErrorText(error, "Couldn't load the affiliate dashboard."));
    } finally {
      stop();
      if (isCurrent()) setLoading(false);
    }
  };

  const hydratePayoutMethod = (pm: any) => {
    setPayoutType("bank");
    setPaypalEmail("");
    setBankCountry("");
    setTransferType("international_wire");
    setBeneficiaryName("");
    setBeneficiaryAddress("");
    setBankName("");
    setSwiftBic("");
    setAccountNumber("");
    setRoutingNumber("");
    setIban("");
    setIntermediaryBank("");
    setShowIntermediary(false);
    setConfirmAccurate(false);
    if (!pm || typeof pm !== "object") return;
    if (pm.type === "paypal") {
      setPayoutType("paypal");
      setPaypalEmail(pm.paypal_email || "");
    } else if (pm.type === "bank") {
      setPayoutType("bank");
      setBankCountry(pm.country || "");
      setTransferType(pm.transfer_type || "international_wire");
      setBeneficiaryName(pm.beneficiary_name || "");
      setBeneficiaryAddress(pm.beneficiary_address || "");
      setBankName(pm.bank_name || "");
      setSwiftBic(pm.swift_bic || "");
      setAccountNumber(pm.account_number || "");
      setRoutingNumber(pm.routing_number || "");
      setIban(pm.iban || "");
      if (pm.intermediary_bank) {
        setIntermediaryBank(pm.intermediary_bank);
        setShowIntermediary(true);
      }
    }
  };

  const loadAffiliate = async () => {
    if (!affiliate) return;
    const { data } = await supabase
      .from("affiliates")
      .select("id, affiliate_slug, full_name, status, payout_method")
      .eq("id", affiliate.id)
      .maybeSingle();
    if (data) {
      setAffiliate(data as AffiliateData);
      hydratePayoutMethod((data as any).payout_method);
    }
  };

  const handleSavePayout = async () => {
    if (!affiliate) return;
    let payload: any;
    if (payoutType === "paypal") {
      if (!paypalEmail.trim()) {
        toast.error("Enter your PayPal email");
        return;
      }
      payload = { type: "paypal", paypal_email: paypalEmail.trim() };
    } else {
      if (!confirmAccurate) {
        toast.error("Please confirm the bank details are correct");
        return;
      }
      if (!beneficiaryName.trim() || !bankName.trim() || !accountNumber.trim()) {
        toast.error("Fill in all required bank fields");
        return;
      }
      if (transferType === "domestic_ach" && !routingNumber.trim()) {
        toast.error("Routing number (ABA) is required for domestic ACH");
        return;
      }
      if (transferType === "sepa" && !iban.trim()) {
        toast.error("IBAN is required for SEPA transfers");
        return;
      }
      payload = {
        type: "bank",
        country: bankCountry.trim().toUpperCase(),
        transfer_type: transferType,
        beneficiary_name: beneficiaryName.trim(),
        beneficiary_address: beneficiaryAddress.trim(),
        bank_name: bankName.trim(),
        swift_bic: swiftBic.trim(),
        account_number: accountNumber.trim(),
        routing_number: routingNumber.trim(),
        iban: iban.trim().toUpperCase(),
        intermediary_bank: showIntermediary ? intermediaryBank.trim() : null,
      };
    }
    setSavingPayout(true);
    const { error } = await supabase
      .from("affiliates")
      .update({ payout_method: payload } as any)
      .eq("id", affiliate.id);
    setSavingPayout(false);
    if (error) {
      toast.error("Failed to save payout method");
      return;
    }
    toast.success("Payout method saved");
    await loadAffiliate();
  };

  const loadAffiliateDetails = async (affiliateId: string, isCurrent: () => boolean) => {
    // Load referrals
    const refs = affiliateQueryData(await supabase
      .from("affiliate_referrals")
      .select("*")
      .eq("affiliate_id", affiliateId)
      .order("created_at", { ascending: false }));
    if (!isCurrent()) return;
    setReferrals((refs as ReferralRow[]) || []);

    // Load page stats from events
    const events = affiliateQueryData(await supabase
      .from("affiliate_events")
      .select("event_type, page")
      .eq("affiliate_id", affiliateId));
    if (!isCurrent()) return;

    const statsMap: Record<string, { views: number; clicks: number }> = {};
    SALES_PAGES.forEach((p) => {
      statsMap[p.id] = { views: 0, clicks: 0 };
    });
    (events || []).forEach((e: any) => {
      if (!statsMap[e.page]) statsMap[e.page] = { views: 0, clicks: 0 };
      if (e.event_type === "view") statsMap[e.page].views++;
      if (e.event_type === "click") statsMap[e.page].clicks++;
    });
    setPageStats(
      Object.entries(statsMap).map(([page, s]) => ({ page, ...s }))
    );

    // Recorded commissions are the headline number. Once stripe_invoice_id exists,
    // older list-price rows (no invoice id) stay in the table but are not counted.
    // affiliate_payouts is only a fallback when no commission rows exist.
    const withInvoices = await supabase
      .from("affiliate_commissions")
      .select("amount, status, stripe_invoice_id")
      .eq("affiliate_id", affiliateId);
    const missingInvoiceColumn = !!withInvoices.error && /stripe_invoice_id/i.test(withInvoices.error.message || "");
    const commissions = affiliateQueryData(missingInvoiceColumn
      ? await supabase.from("affiliate_commissions").select("amount, status").eq("affiliate_id", affiliateId)
      : withInvoices);
    if (!isCurrent()) return;

    const tracksInvoices = (commissions || []).some((c: any) => Object.prototype.hasOwnProperty.call(c, "stripe_invoice_id"));
    const countable = tracksInvoices ? (commissions || []).filter((c: any) => c.stripe_invoice_id) : (commissions || []);
    let pending = 0;
    countable.forEach((c: any) => {
      if (c.status === "pending") pending += Number(c.amount);
    });

    if (!commissions || commissions.length === 0) {
      const payouts = affiliateQueryData(await supabase
        .from("affiliate_payouts")
        .select("amount, status")
        .eq("affiliate_id", affiliateId));
      if (!isCurrent()) return;
      (payouts || []).forEach((p: any) => {
        if (p.status !== "paid") pending += Number(p.amount);
      });
    }

    setPendingPayouts(pending);
  };

  const handleUpdateSlug = async () => {
    if (!affiliate || !newSlug.trim()) return;
    const slug = newSlug.trim().toLowerCase().replace(/[^a-z0-9-]/g, "");
    
    // Check uniqueness
    const { data: existing } = await supabase
      .from("affiliates")
      .select("id")
      .eq("affiliate_slug", slug)
      .neq("id", affiliate.id)
      .maybeSingle();

    if (existing) {
      toast.error("This slug is already taken. Try another.");
      return;
    }

    await supabase
      .from("affiliates")
      .update({ affiliate_slug: slug })
      .eq("id", affiliate.id);

    setAffiliate({ ...affiliate, affiliate_slug: slug });
    setEditingSlug(false);
    toast.success("Affiliate ID updated");
  };

  const copyLink = (path: string) => {
    const url = affiliateShareUrl(path, affiliate?.affiliate_slug ?? "");
    navigator.clipboard.writeText(url);
    setCopiedPage(path);
    setTimeout(() => setCopiedPage(null), 2000);
    toast.success("Link copied");
  };

  const header = (actions?: ReactNode, more?: MoreMenuItem[]) => (
    <PageHeader
      eyebrow="Grow"
      title="Affiliate"
      subtitle={`Share your link and earn ${commissionPercent}% recurring on every account that signs up.`}
      actions={actions}
      more={more}
    />
  );

  const helpDialogs = (
    <>
      <HowItWorksDialog
        open={howOpen}
        onOpenChange={setHowOpen}
        title="How the affiliate program works"
        intro="Every account that signs up through one of your links is credited to you."
        steps={[
          { title: "Share your link", detail: "Use the main link, or pick the sales page that fits the person you are sending." },
          { title: "They sign up", detail: "Referrals get 10% off at checkout with your discount code." },
          { title: `You earn ${commissionPercent}% recurring`, detail: "Commission is your rate times the amount each referral pays, for as long as they stay." },
          { title: "Get paid", detail: "Add a payout method once. Payouts start when your application is approved." },
        ]}
      />
      <TextUsDialog
        open={helpOpen}
        onOpenChange={setHelpOpen}
        title="Get help setting up"
        description="Text us and we will guide you through installation and answer your questions."
      />
    </>
  );

  if (loadError || loading) {
    return (
      <div className="space-y-6">
        {header()}
        <LoadNotice
          loading={loading}
          error={loadError}
          label="Loading affiliate dashboard…"
          onRetry={() => setLoadAttempt((attempt) => attempt + 1)}
        />
      </div>
    );
  }

  if (!affiliate) {
    return (
      <div className="space-y-6">
        {header(undefined, [
          { label: "How this works", icon: <CircleHelp />, onSelect: () => setHowOpen(true) },
          { label: "Get setup help", icon: <MessageCircle />, onSelect: () => setHelpOpen(true) },
        ])}
        <div className="mx-auto max-w-2xl">
          <SectionCard
            icon={<HandCoins />}
            title="Become a SaaSSuite affiliate"
            description="Apply below and your affiliate dashboard unlocks right here."
            bodyClassName="space-y-4"
          >
            <div className="space-y-2">
              <Label htmlFor="aff-name">Your full name *</Label>
              <Input
                id="aff-name"
                value={applyName}
                onChange={(e) => setApplyName(e.target.value)}
                placeholder="Jane Smith"
              />
            </div>
            <div className="space-y-2">
              <Label>Audience size *</Label>
              <Select value={applyNetworkSize} onValueChange={setApplyNetworkSize}>
                <SelectTrigger>
                  <SelectValue placeholder="Select your audience size" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Just getting started">Just getting started</SelectItem>
                  <SelectItem value="1-500">1 - 500</SelectItem>
                  <SelectItem value="500-2,500">500 - 2,500</SelectItem>
                  <SelectItem value="2,500-10,000">2,500 - 10,000</SelectItem>
                  <SelectItem value="10,000+">10,000+</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Collapsible>
              <CollapsibleTrigger className="group inline-flex min-h-11 items-center gap-1.5 rounded-sm text-sm font-medium text-muted-foreground transition-colors duration-150 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:min-h-9">
                <ChevronRight className="size-4 transition-transform duration-200 ease-out group-data-[state=open]:rotate-90" aria-hidden="true" />
                Add more detail (optional)
              </CollapsibleTrigger>
              <CollapsibleContent className="space-y-4 pt-2">
                <div className="space-y-2">
                  <Label htmlFor="aff-company">Company / brand</Label>
                  <Input
                    id="aff-company"
                    value={applyCompany}
                    onChange={(e) => setApplyCompany(e.target.value)}
                    placeholder="Optional"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="aff-audience">How will you promote SaaSSuite?</Label>
                  <Textarea
                    id="aff-audience"
                    value={applyAudience}
                    onChange={(e) => setApplyAudience(e.target.value)}
                    placeholder="Agency owners, YouTube, GHL community, email list..."
                    rows={4}
                  />
                </div>
              </CollapsibleContent>
            </Collapsible>
            <Button variant="accent" className="h-11 w-full" onClick={handleApply} disabled={applying}>
              {applying ? "Submitting…" : "Apply to become an affiliate"}
            </Button>
            <p className="text-center text-xs text-muted-foreground">
              You get your referral links at once. Payouts start when your application is approved.
            </p>
          </SectionCard>
        </div>
        {helpDialogs}
      </div>
    );
  }

  const mainLink = affiliateShareUrl("/", affiliate.affiliate_slug).replace("https://", "");
  const couponCode = affiliate.affiliate_slug?.toUpperCase().replace(/[^A-Z0-9]/g, "") || "";
  const copyCode = () => {
    navigator.clipboard.writeText(couponCode);
    setCopiedPage("__code");
    setTimeout(() => setCopiedPage(null), 2000);
    toast.success("Coupon code copied");
  };
  const openSlugEditor = (next: boolean) => {
    if (next) setNewSlug(affiliate.affiliate_slug || "");
    setEditingSlug(next);
  };
  const savedPayout = affiliate.payout_method;
  const payoutSummary =
    savedPayout?.type === "paypal"
      ? `PayPal · ${savedPayout.paypal_email || "email not set"}`
      : savedPayout?.type === "bank"
        ? `Bank transfer · ${savedPayout.bank_name || "bank not set"}`
        : "Not set up yet";

  const sharePopover = (
    <Popover open={shareOpen} onOpenChange={setShareOpen}>
      <PopoverTrigger asChild>
        <Button type="button" variant="accent" className="h-11 gap-2 sm:h-10" data-testid="affiliate-share">
          <Link2 className="size-4" aria-hidden="true" />
          Share link
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[min(22rem,calc(100vw-2rem))] space-y-4 rounded-xl p-4">
        <div className="space-y-1.5">
          <p className="px-eyebrow">Affiliate link</p>
          <div className="flex items-center gap-1 rounded-md border border-border bg-muted/50 py-1 pl-3 pr-1">
            <p className="min-w-0 flex-1 truncate font-mono text-sm text-foreground">{mainLink}</p>
            <Button type="button" variant="accent" size="sm" className="h-11 shrink-0 gap-1.5 sm:h-9" onClick={() => copyLink("/")}>
              <CopyConfirmIcon copied={copiedPage === "/"} />
              <span aria-live="polite">{copiedPage === "/" ? "Copied" : "Copy link"}</span>
            </Button>
          </div>
        </div>
        <div className="space-y-1.5">
          <p className="px-eyebrow">Discount code, 10% off</p>
          <div className="flex items-center gap-1 rounded-md border border-border bg-muted/50 py-1 pl-3 pr-1">
            <p className="min-w-0 flex-1 truncate font-mono text-sm font-semibold tracking-wider text-foreground">{couponCode || "None yet"}</p>
            <Button type="button" variant="ghost" size="sm" className="h-11 shrink-0 gap-1.5 sm:h-9" onClick={copyCode}>
              <CopyConfirmIcon copied={copiedPage === "__code"} />
              <span aria-live="polite">{copiedPage === "__code" ? "Copied" : "Copy code"}</span>
            </Button>
          </div>
        </div>
        <Button
          type="button"
          variant="outline"
          className="h-11 w-full justify-between sm:h-10"
          onClick={() => {
            setShareOpen(false);
            setPagesOpen(true);
          }}
        >
          Pick a sales page link
          <ChevronRight className="size-4" aria-hidden="true" />
        </Button>
      </PopoverContent>
    </Popover>
  );

  // One card of rows. It rides in the panel's `belowChart` slot so it sits between the chart and the customer list.
  const linksCard = (
    <SettingList label="Links and payout">
      <SettingItem
        icon={<Link2 />}
        title="Sales page links"
        value="Send people to the page that fits them"
        status={`${SALES_PAGES.length} pages`}
        open={pagesOpen}
        onOpenChange={setPagesOpen}
        panel={{ description: "Each link is credited to you. Copy the one that fits the person you are sending." }}
        testId="affiliate-pages-row"
      >
            {SALES_PAGES.length === 0 ? (
              <EmptyState
                icon={<span className="px-icon-chip"><Link2 className="size-5" /></span>}
                title="No sales pages yet"
                description="Links to share will show up here."
              />
            ) : (
              <ul className="divide-y divide-border">
                {SALES_PAGES.map((page) => {
                  const stat = pageStats.find((s) => s.page === page.id);
                  return (
                    <li key={page.id} data-affiliate-offer={page.id} className="flex flex-col gap-2 py-3 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-foreground">{page.label}</p>
                        <p className="break-all font-mono text-xs text-muted-foreground">
                          {affiliateShareUrl(page.path, affiliate.affiliate_slug).replace("https://", "")}
                        </p>
                      </div>
                      <div className="flex items-center justify-between gap-4 text-xs tabular-nums text-muted-foreground sm:justify-end">
                        <span>{stat?.views || 0} views</span>
                        <span>{stat?.clicks || 0} clicks</span>
                        <Button
                          size="sm"
                          aria-label={`Copy ${page.label} link`}
                          variant="outline"
                          className="h-11 gap-1.5 sm:h-9"
                          onClick={() => copyLink(page.path)}
                        >
                          <CopyConfirmIcon copied={copiedPage === page.path} />
                          {copiedPage === page.path ? "Copied" : "Copy"}
                        </Button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
      </SettingItem>
      <SettingItem
        icon={<AtSign />}
        title="Affiliate ID"
        value={affiliate.affiliate_slug}
        open={editingSlug}
        onOpenChange={openSlugEditor}
        panel={{
          description: "The ending of every link you share.",
          footer: (
            <>
              <Button variant="accent" className="h-11 sm:h-10" onClick={handleUpdateSlug}>Save affiliate ID</Button>
              <Button variant="ghost" className="h-11 sm:mr-auto sm:h-10" onClick={() => setEditingSlug(false)}>Cancel</Button>
            </>
          ),
        }}
        testId="affiliate-id-row"
      >
        <div className="space-y-2">
          <Label htmlFor="aff-slug">Affiliate ID</Label>
          <Input
            id="aff-slug"
            value={newSlug}
            onChange={(e) => setNewSlug(e.target.value)}
            placeholder="your-slug"
            className="h-11 font-mono sm:h-10"
          />
          <p className="break-all font-mono text-xs text-muted-foreground">
            {affiliateShareUrl("/", newSlug.trim().toLowerCase().replace(/[^a-z0-9-]/g, "") || affiliate.affiliate_slug).replace("https://", "")}
          </p>
        </div>
      </SettingItem>
      <SettingItem
        icon={<TicketPercent />}
        title="Discount code"
        value={`${couponCode || "None yet"} · referrals get 10% off at checkout`}
        status={<span aria-live="polite">{copiedPage === "__code" ? "Copied" : "Copy"}</span>}
        onOpen={copyCode}
        testId="affiliate-code-row"
      />
      <SettingItem
        icon={<Wallet />}
        title="Payout method"
        value={payoutSummary}
        open={activeTab === "payout"}
        onOpenChange={(next) => setActiveTab(next ? "payout" : "dashboard")}
        panel={{
          description: "Choose how you'd like to be paid your affiliate commissions.",
          footer: (
            <Button variant="accent" className="h-11 w-full sm:mr-auto sm:h-10 sm:w-auto" onClick={handleSavePayout} disabled={savingPayout}>
              {savingPayout ? "Saving…" : "Save payout method"}
            </Button>
          ),
        }}
        testId="affiliate-payout-row"
      >
        <div className="space-y-4">
            <div className="space-y-2">
              <Label>Method</Label>
              <Select value={payoutType} onValueChange={(v) => setPayoutType(v as "bank" | "paypal")}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="bank">Bank transfer</SelectItem>
                  <SelectItem value="paypal">PayPal</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {payoutType === "paypal" ? (
              <div className="space-y-2">
                <Label>PayPal email</Label>
                <Input
                  type="email"
                  placeholder="you@paypal.com"
                  value={paypalEmail}
                  onChange={(e) => setPaypalEmail(e.target.value)}
                />
              </div>
            ) : (
              <div className="space-y-4">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Country (ISO 2-letter)</Label>
                    <Input
                      placeholder="US, GB, DE..."
                      maxLength={2}
                      value={bankCountry}
                      onChange={(e) => setBankCountry(e.target.value.toUpperCase())}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Transfer type</Label>
                    <Select value={transferType} onValueChange={setTransferType}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="international_wire">International wire</SelectItem>
                        <SelectItem value="domestic_ach">Domestic ACH</SelectItem>
                        <SelectItem value="sepa">SEPA</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Beneficiary name (account holder)</Label>
                  <Input value={beneficiaryName} onChange={(e) => setBeneficiaryName(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Beneficiary address</Label>
                  <Textarea rows={3} value={beneficiaryAddress} onChange={(e) => setBeneficiaryAddress(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Bank name</Label>
                  <Input value={bankName} onChange={(e) => setBankName(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>SWIFT / BIC</Label>
                  <Input
                    placeholder="8 or 11 chars, e.g. BARCGB22"
                    value={swiftBic}
                    onChange={(e) => setSwiftBic(e.target.value.toUpperCase())}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Account number</Label>
                  <Input value={accountNumber} onChange={(e) => setAccountNumber(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>
                    Routing number / ABA / Sort code
                    {transferType === "domestic_ach" ? "" : " (if applicable)"}
                  </Label>
                  <Input
                    placeholder="e.g. 021000021"
                    value={routingNumber}
                    onChange={(e) => setRoutingNumber(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    US banks: 9-digit ABA routing number. UK: 6-digit sort code.
                  </p>
                </div>
                <div className="space-y-2">
                  <Label>IBAN {transferType === "sepa" ? "" : "(if applicable)"}</Label>
                  <Input
                    placeholder="e.g. DE89370400440532013000"
                    value={iban}
                    onChange={(e) => setIban(e.target.value.toUpperCase())}
                  />
                </div>
                <div>
                  <button
                    type="button"
                    onClick={() => setShowIntermediary(!showIntermediary)}
                    aria-expanded={showIntermediary}
                    className="inline-flex min-h-11 items-center gap-1.5 rounded-sm text-sm font-medium text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:min-h-0"
                  >
                    <ChevronRight
                      className={"size-4 transition-transform duration-200 " + (showIntermediary ? "rotate-90" : "")}
                      aria-hidden="true"
                    />
                    Intermediary bank (optional)
                  </button>
                  {showIntermediary && (
                    <Textarea
                      className="mt-2"
                      rows={3}
                      placeholder="Intermediary bank details"
                      value={intermediaryBank}
                      onChange={(e) => setIntermediaryBank(e.target.value)}
                    />
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="confirm-bank"
                    checked={confirmAccurate}
                    onCheckedChange={(v) => setConfirmAccurate(v === true)}
                  />
                  <Label htmlFor="confirm-bank" className="cursor-pointer">
                    I confirm these bank details are correct.
                  </Label>
                </div>
              </div>
            )}
        </div>
      </SettingItem>
    </SettingList>
  );

  return (
    <div className="space-y-4 sm:space-y-6">
      {header(
        <>
          <Badge variant={affiliate.status === "APPROVED" ? "success" : "warning"}>
            {affiliate.status === "APPROVED" ? "Approved affiliate" : `Status: ${affiliate.status}`}
          </Badge>
          {sharePopover}
        </>,
        [
          { label: "Payout method", icon: <Wallet />, onSelect: () => setActiveTab("payout") },
          { label: "Change affiliate ID", icon: <AtSign />, onSelect: () => openSlugEditor(true) },
          { label: "Copy discount code", icon: <TicketPercent />, onSelect: copyCode },
          { label: "How this works", icon: <CircleHelp />, onSelect: () => setHowOpen(true), separated: true },
          { label: "Get setup help", icon: <MessageCircle />, onSelect: () => setHelpOpen(true) },
        ],
      )}

      <Reveal className="space-y-4 sm:space-y-6">
        <RevealItem>
          <AffiliateReferralsPanel
            mode="self"
            calm
            affiliateId={affiliate.id}
            fallbackReferrals={referrals}
            fallbackPending={pendingPayouts}
            onCommissionRate={setCommissionPercent}
            belowChart={linksCard}
          />
        </RevealItem>
      </Reveal>
      {helpDialogs}
    </div>
  );
}

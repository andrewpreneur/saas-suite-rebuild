import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Copy, Check, Pencil, Wallet } from "lucide-react";
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

      toast.success("You're in! Your affiliate links are ready.");
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
    toast.success("Payout method saved!");
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
    toast.success("Affiliate ID updated!");
  };

  const copyLink = (path: string) => {
    const url = affiliateShareUrl(path, affiliate?.affiliate_slug ?? "");
    navigator.clipboard.writeText(url);
    setCopiedPage(path);
    setTimeout(() => setCopiedPage(null), 2000);
    toast.success("Link copied!");
  };

  if (loadError || loading) {
    return (
      <LoadNotice
        loading={loading}
        error={loadError}
        label="Loading affiliate dashboard…"
        onRetry={() => setLoadAttempt((attempt) => attempt + 1)}
      />
    );
  }

  if (!affiliate) {
    return (
      <div className="max-w-2xl mx-auto py-6 sm:py-10 px-1 sm:px-0">
        <div className="text-center mb-6">
          <h2 className="text-2xl font-bold text-foreground mb-2">Become a SaaSSuite Affiliate</h2>
          <p className="text-muted-foreground text-sm sm:text-base">
            Earn recurring commission on every account you refer — available on every plan. Apply below and
            your affiliate dashboard unlocks right here.
          </p>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>Affiliate application</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
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
              <Label htmlFor="aff-company">Company / brand</Label>
              <Input
                id="aff-company"
                value={applyCompany}
                onChange={(e) => setApplyCompany(e.target.value)}
                placeholder="Optional"
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
            <Button className="w-full" onClick={handleApply} disabled={applying}>
              {applying ? "Submitting..." : "Apply to become an affiliate"}
            </Button>
            <p className="text-xs text-muted-foreground text-center">
              You'll get your referral links instantly — payouts start once your application is approved.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6 px-1 sm:px-0">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Affiliate Dashboard</h2>
          <p className="text-muted-foreground text-sm sm:text-base">Track your referrals, commissions, and performance</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant={affiliate.status === "APPROVED" ? "default" : "secondary"}>
            {affiliate.status}
          </Badge>
          <Button
            variant={activeTab === "payout" ? "default" : "outline"}
            size="sm"
            onClick={() => setActiveTab(activeTab === "payout" ? "dashboard" : "payout")}
          >
            <Wallet className="h-4 w-4 mr-2" />
            Payout Method
          </Button>
        </div>
      </div>

      {activeTab === "payout" ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Payout Method</CardTitle>
            <p className="text-sm text-muted-foreground">Choose how you'd like to be paid your affiliate commissions.</p>
          </CardHeader>
          <CardContent className="space-y-4">
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
                <div className="grid grid-cols-2 gap-4">
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
                    className="text-sm text-muted-foreground hover:text-foreground"
                  >
                    {showIntermediary ? "▼" : "▶"} Intermediary bank (optional)
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

            <Button onClick={handleSavePayout} disabled={savingPayout}>
              {savingPayout ? "Saving..." : "Save payout method"}
            </Button>
          </CardContent>
        </Card>
      ) : (
      <>
      <AffiliateReferralsPanel
        mode="self"
        affiliateId={affiliate.id}
        fallbackReferrals={referrals}
        fallbackPending={pendingPayouts}
        onCommissionRate={setCommissionPercent}
        belowChart={(
          <Card className="rounded-2xl border-border/60">
            <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Affiliate link</p>
                <p className="mt-1 break-all font-mono text-sm text-foreground">
                  {affiliateShareUrl("/", affiliate.affiliate_slug).replace("https://", "")}
                </p>
              </div>
              <Button type="button" size="sm" className="shrink-0" onClick={() => copyLink("/")}>
                {copiedPage === "/" ? <Check className="h-4 w-4 mr-2" /> : <Copy className="h-4 w-4 mr-2" />}
                {copiedPage === "/" ? "Copied" : "Copy link"}
              </Button>
            </CardContent>
          </Card>
        )}
      />

      {/* Affiliate ID */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground mb-1">Your Affiliate ID</p>
              {editingSlug ? (
                <div className="flex items-center gap-2">
                  <Input
                    value={newSlug}
                    onChange={(e) => setNewSlug(e.target.value)}
                    placeholder="your-slug"
                    className="w-48"
                  />
                  <Button variant="accent" size="sm" onClick={handleUpdateSlug}>Save</Button>
                  <Button size="sm" variant="ghost" onClick={() => setEditingSlug(false)}>Cancel</Button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <span className="font-mono text-lg font-semibold text-foreground">{affiliate.affiliate_slug}</span>
                  <Button size="icon" aria-label="Edit" variant="ghost" className="h-7 w-7" onClick={() => { setEditingSlug(true); setNewSlug(affiliate.affiliate_slug || ""); }}>
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Coupon Code */}
      <Card className="border-primary/30 bg-primary/5">
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <p className="text-sm text-muted-foreground mb-1">Your Discount Code (10% off for referrals)</p>
              <div className="flex items-center gap-2">
                <span className="font-mono text-lg font-bold text-primary tracking-wider">
                  {affiliate.affiliate_slug?.toUpperCase().replace(/[^A-Z0-9]/g, "") || "—"}
                </span>
                <Button
                  size="icon" aria-label="Copy"
                  variant="ghost"
                  className="h-7 w-7"
                  onClick={() => {
                    const code = affiliate.affiliate_slug?.toUpperCase().replace(/[^A-Z0-9]/g, "") || "";
                    navigator.clipboard.writeText(code);
                    toast.success("Coupon code copied!");
                  }}
                >
                  <Copy className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
            <p className="text-xs text-muted-foreground sm:max-w-[200px] sm:text-right">
              Share this code with your referrals so they get 10% off at checkout
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Affiliate Links */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">All Sales Page Links</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {SALES_PAGES.map((page) => {
              const stat = pageStats.find((s) => s.page === page.id);
              return (
                <div key={page.id} data-affiliate-offer={page.id} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 p-3 rounded-lg border border-border bg-muted/30">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-foreground">{page.label}</p>
                    <p className="text-xs text-muted-foreground font-mono break-all">
                      {affiliateShareUrl(page.path, affiliate.affiliate_slug).replace("https://", "")}
                    </p>
                  </div>
                  <div className="flex items-center justify-between sm:justify-end gap-4 text-sm text-muted-foreground">
                    <span>{stat?.views || 0} views</span>
                    <span>{stat?.clicks || 0} clicks</span>
                    <Button
                      size="icon" aria-label="Confirm"
                      variant="ghost"
                      className="h-8 w-8"
                      onClick={() => copyLink(page.path)}
                    >
                      {copiedPage === page.path ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
      </>
      )}
    </div>
  );
}

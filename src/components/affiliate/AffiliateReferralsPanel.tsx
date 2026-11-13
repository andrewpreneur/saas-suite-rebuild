import { useEffect, useRef, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PanelSkeleton } from "@/components/ui/loading-skeletons";
import { supabase } from "@/integrations/supabase/client";
import { maskEmail } from "@/lib/affiliateReferrals";
import { format } from "date-fns";
import { CalendarIcon } from "lucide-react";
import type { DateRange } from "react-day-picker";
import { toast } from "sonner";
import {
  AffiliateReferralReport,
  type ActivityPoint,
  type PageAttributionSection,
  type ReferralActivity,
  type ReferralStatusRow,
} from "./AffiliateReferralReport";

const DAY_OPTIONS = [7, 30, 45, 90];

function lastDays(days: number): DateRange {
  const to = new Date();
  const from = new Date();
  from.setDate(to.getDate() - (days - 1));
  from.setHours(0, 0, 0, 0);
  return { from, to };
}

function endOfLocalDay(date: Date): Date {
  const copy = new Date(date);
  copy.setHours(23, 59, 59, 999);
  return copy;
}

type Choice = { id: string; fullName: string; slug: string | null };

type FallbackReferral = {
  id: string;
  referred_email: string;
  referred_name: string | null;
  plan: string | null;
  created_at: string;
  commission_rate?: number | null;
};

type Snapshot = {
  maskEmails?: boolean;
  stripeUnavailable?: boolean;
  stripeTruncated?: boolean;
  stripeLookupFailures?: number;
  commissionRate?: number | null;
  affiliates?: Array<{ id: string; commissionRate?: number | null }>;
  referrals?: ReferralStatusRow[];
  pages?: PageAttributionSection[];
  series?: ActivityPoint[];
  activity?: ReferralActivity;
  activityNote?: string | null;
  fromCache?: boolean;
  refreshedAt?: string | null;
  error?: string;
  code?: string;
};

const EMPTY_ACTIVITY: ReferralActivity = {
  views: 0,
  clicks: 0,
  signups: 0,
  trials: 0,
  active: 0,
  revenue: 0,
  commission: 0,
  pendingPayout: null,
  expectedTrialCommission: 0,
  expectedTrialCount: 0,
};

function fallbackRows(rows: FallbackReferral[], mask: boolean): ReferralStatusRow[] {
  return rows.map((row) => ({
    id: row.id,
    name: row.referred_name,
    email: mask ? maskEmail(row.referred_email || "") : row.referred_email,
    signupAt: row.created_at,
    kind: "unknown",
    label: "Status unavailable",
    plan: row.plan,
    trialEnd: null,
    commissionRate: Number(row.commission_rate) || 30,
    payments: [],
    totalPaid: 0,
    totalCommission: 0,
    nextPaymentAt: null,
  }));
}

export default function AffiliateReferralsPanel({
  mode,
  affiliateId,
  choices = [],
  fallbackReferrals = [],
  fallbackPending = null,
  onCommissionRate,
  belowChart,
}: {
  mode: "self" | "admin";
  affiliateId?: string | null;
  choices?: Choice[];
  fallbackReferrals?: FallbackReferral[];
  fallbackPending?: number | null;
  onCommissionRate?: (rate: number) => void;
  belowChart?: ReactNode;
}) {
  const [range, setRange] = useState<DateRange | undefined>(() => lastDays(45));
  const [choice, setChoice] = useState("");
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [loading, setLoading] = useState(false);
  const [usingFallback, setUsingFallback] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [rateDraft, setRateDraft] = useState("");
  const [savingRate, setSavingRate] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const snapshotRef = useRef<Snapshot | null>(null);
  const loadedFor = useRef("");
  const actionRef = useRef<"snapshot" | "refresh">("snapshot");

  const selectedId = affiliateId || choice;
  const waitingForChoice = mode === "admin" && !affiliateId && !choice;

  const refreshStatus = () => {
    actionRef.current = "refresh";
    setReloadKey((value) => value + 1);
  };

  useEffect(() => {
    if (waitingForChoice) {
      snapshotRef.current = null;
      loadedFor.current = "";
      setSnapshot(null);
      setUsingFallback(false);
      setNotice(null);
      setLoading(false);
      return;
    }
    if (!range?.from || !range?.to) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    const requestId = selectedId || "";
    if (loadedFor.current !== requestId) {
      snapshotRef.current = null;
      setSnapshot(null);
      setUsingFallback(false);
      setNotice(null);
    }
    setLoading(true);
    const since = range.from.toISOString();
    const until = endOfLocalDay(range.to).toISOString();
    const action = actionRef.current;
    actionRef.current = "snapshot";
    void (async () => {
      const { data, error } = await supabase.functions.invoke("affiliate-referrals", {
        body: {
          action,
          scope: mode,
          affiliateId: selectedId || undefined,
          since,
          until,
        },
      });
      if (cancelled) return;
      const payload = (data || null) as Snapshot | null;
      if (error || !payload || payload.error) {
        if (snapshotRef.current) {
          setSnapshot(snapshotRef.current);
          setUsingFallback(false);
          setNotice("Could not refresh referral status. Showing the last totals we loaded.");
        } else {
          setUsingFallback(true);
          setNotice(payload?.error || "Live trial, payment, and commission totals need the affiliate-referrals function. Showing the signup list only.");
        }
        setLoading(false);
        return;
      }
      snapshotRef.current = payload;
      loadedFor.current = requestId;
      setNotice(null);
      setSnapshot(payload);
      if (typeof payload.commissionRate === "number") {
        onCommissionRate?.(payload.commissionRate);
        setRateDraft(String(payload.commissionRate));
      }
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [mode, selectedId, range?.from?.getTime(), range?.to?.getTime(), reloadKey, waitingForChoice, onCommissionRate]);

  const saveRate = async () => {
    const target = snapshot?.affiliates?.length === 1 ? snapshot.affiliates[0].id : affiliateId;
    const requested = Number(rateDraft);
    if (!target || !Number.isFinite(requested)) {
      toast.error("Enter a rate between 0 and 100");
      return;
    }
    setSavingRate(true);
    const { data, error } = await supabase.functions.invoke("affiliate-referrals", {
      body: { action: "set-rate", affiliateId: target, commissionRate: requested },
    });
    setSavingRate(false);
    if (error || data?.error) {
      toast.error(data?.error || "Could not save the commission rate");
      return;
    }
    toast.success("New referrals will use this rate. Existing referrals keep their saved rate.");
    setReloadKey((value) => value + 1);
  };

  const notices = [
    ...(notice ? [notice] : []),
    ...(snapshot?.activityNote ? [snapshot.activityNote] : []),
    ...(snapshot?.stripeUnavailable ? ["Stripe is not configured, so trial, active, and payment dates are unavailable."] : []),
    ...(snapshot?.stripeTruncated ? ["Payment history is loaded for the first 150 referrals."] : []),
    ...((snapshot?.stripeLookupFailures || 0) > 0 ? ["Some Stripe lookups failed. Those rows may be missing payments."] : []),
  ];

  const previewFallback = !snapshot && !usingFallback && (!!affiliateId || selectedId === "all") && fallbackReferrals.length > 0;
  const showSignupList = usingFallback || previewFallback;
  const referrals = showSignupList
    ? fallbackRows(fallbackReferrals, mode === "self")
    : Array.isArray(snapshot?.referrals) ? snapshot.referrals : [];
  const hasVisibleData = !!snapshot || showSignupList;
  const updatedLabel = snapshot?.refreshedAt && !Number.isNaN(Date.parse(snapshot.refreshedAt))
    ? new Date(snapshot.refreshedAt).toLocaleString()
    : null;
  const activity = snapshot?.activity || {
    ...EMPTY_ACTIVITY,
    signups: showSignupList ? fallbackReferrals.length : 0,
    pendingPayout: showSignupList ? fallbackPending : null,
  };
  const showRateEditor = mode === "admin" && snapshot?.affiliates?.length === 1 && snapshot.commissionRate != null;
  const activeDays = range?.from && range?.to
    ? Math.round((endOfLocalDay(range.to).getTime() - range.from.getTime()) / 86400000)
    : 0;
  const rangeControl = (
    <div className="flex flex-wrap items-center gap-2">
      <div className="inline-flex rounded-md border border-border bg-muted/50 p-0.5" role="group" aria-label="Quick date range">
        {DAY_OPTIONS.map((option) => (
          <button
            key={option}
            type="button"
            aria-pressed={activeDays === option}
            onClick={() => setRange(lastDays(option))}
            className={
              "h-10 min-w-11 rounded-sm px-3 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:h-8 " +
              (activeDays === option ? "bg-card text-foreground shadow-card" : "text-muted-foreground hover:text-foreground")
            }
          >
            {option}d
          </button>
        ))}
      </div>
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" className="h-11 gap-2 font-medium sm:h-9">
            <CalendarIcon className="size-4 text-muted-foreground" aria-hidden="true" />
            {range?.from ? `${format(range.from, "MMM d")} – ${format(range.to ?? range.from, "MMM d, yyyy")}` : "Select date range"}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto rounded-xl p-0" align="end">
          <Calendar
            mode="range"
            selected={range}
            onSelect={setRange}
            numberOfMonths={1}
            defaultMonth={range?.from}
          />
        </PopoverContent>
      </Popover>
    </div>
  );

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col gap-3 empty:hidden sm:flex-row sm:items-end">
        {mode === "admin" && !affiliateId ? (
          <div className="space-y-1 flex-1">
            <Label>Affiliate</Label>
            <Select value={choice || undefined} onValueChange={setChoice}>
              <SelectTrigger className="w-full sm:max-w-sm" aria-label="Choose an affiliate">
                <SelectValue placeholder="Choose an affiliate" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All affiliates</SelectItem>
                {choices.map((item) => (
                  <SelectItem key={item.id} value={item.id}>
                    {item.fullName}{item.slug ? ` (${item.slug})` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ) : null}
        {mode === "admin" && selectedId && selectedId !== "all" ? (
          <Button type="button" variant="outline" size="sm" className="h-10" onClick={refreshStatus} disabled={loading}>
            Refresh status
          </Button>
        ) : null}
      </div>

      {waitingForChoice ? (
        <p className="text-sm text-muted-foreground">Choose an affiliate to load referral status and payment dates.</p>
      ) : null}

      {showRateEditor ? (
        <div className="px-surface flex flex-col gap-3 p-4 sm:flex-row sm:items-end">
          <div className="space-y-1">
            <Label htmlFor="affiliate-commission-rate">Commission rate for new referrals</Label>
            <Input
              id="affiliate-commission-rate"
              type="number"
              min={0}
              max={100}
              step="0.01"
              value={rateDraft}
              onChange={(event) => setRateDraft(event.target.value)}
              className="w-32"
            />
          </div>
          <Button type="button" onClick={saveRate} disabled={savingRate}>{savingRate ? "Saving..." : "Save rate"}</Button>
          <p className="text-xs text-muted-foreground sm:max-w-sm">Existing referrals keep the percentage stored when they signed up.</p>
        </div>
      ) : null}

      {!waitingForChoice && loading && hasVisibleData ? (
        <p className="text-sm text-muted-foreground">Updating referral status…</p>
      ) : null}
      {!waitingForChoice && updatedLabel ? (
        <p className="-mb-2 text-xs text-muted-foreground">Last updated {updatedLabel}</p>
      ) : null}

      {!waitingForChoice && loading && !hasVisibleData ? (
        <>
          <PanelSkeleton stats={8} rows={6} />
          {belowChart}
        </>
      ) : null}

      {!waitingForChoice && hasVisibleData ? (
        <AffiliateReferralReport
          activity={activity}
          series={!showSignupList && Array.isArray(snapshot?.series) ? snapshot.series : []}
          referrals={referrals}
          pages={!showSignupList && Array.isArray(snapshot?.pages) ? snapshot.pages : []}
          notices={notices}
          showAffiliate={mode === "admin" && selectedId === "all"}
          rangeControl={rangeControl}
          belowChart={belowChart}
        />
      ) : null}
    </div>
  );
}

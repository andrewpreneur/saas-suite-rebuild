import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useUser } from "@/contexts/UserContext";
import { KitAdTemplateLibrary } from "@/components/dashboard/KitAdTemplateLibrary";
import {
  KitActionList,
  KitOnboardingGuide,
  KitResourceLink,
  KitStagePill,
} from "@/components/dashboard/KitOnboardingGuide";
import { kitDeliveryState } from "@/lib/kitDelivery";
import { entitledKitLineIds, kitAccountIsOpen } from "@/lib/kitEntitlement";
import { kitAddonViews } from "@/lib/kitOnboarding";
import { attachKitPurchases } from "@/lib/kitPurchases";
import {
  emptyKitTrackerSignals,
  kitLineIdsFromPurchaseRows,
  loadKitTrackerSignals,
  type KitPurchaseRow,
  type KitTrackerSignals,
} from "@/lib/kitTracker";
import { cn } from "@/lib/utils";
import { Users } from "lucide-react";

function AddonSection({ item }: { item: ReturnType<typeof kitAddonViews>[number] }) {
  const stage = item.unlocked ? item.statusLabel : "Locked";
  return (
    <Card
      data-kit-line={item.id}
      data-kit-unlocked={item.unlocked ? "yes" : "no"}
      className={cn(
        "border-2",
        stage === "Confirmed" || stage === "Purchased" || stage === "Marked done"
          ? "border-green-600 dark:border-green-400"
          : stage === "In progress"
            ? "border-purple-600 dark:border-purple-300"
            : "border-purple-200 dark:border-purple-800",
      )}
    >
      <CardContent className="flex flex-col gap-3 p-4 sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <h3 className="min-w-0 text-base font-semibold text-purple-800 dark:text-purple-200">
            {item.title}
          </h3>
          <KitStagePill stage={stage} />
        </div>
        {item.unlocked ? (
          <>
            <div className="space-y-1">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Status
              </p>
              <p className="text-sm text-foreground">{item.status}</p>
            </div>
            <div className="space-y-1">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                What's next
              </p>
              <p className="text-sm text-muted-foreground">{item.next}</p>
            </div>
            <KitActionList actions={item.actions} />
            {item.confirmationNote && (
              <p className="text-sm text-muted-foreground">{item.confirmationNote}</p>
            )}
            {item.missing && <p className="text-sm text-muted-foreground">{item.missing}</p>}
          </>
        ) : (
          <>
            <p className="text-sm text-muted-foreground">{item.detail}</p>
            <KitResourceLink href={item.buyHref} label={`Buy · ${item.priceLabel}`} />
          </>
        )}
      </CardContent>
    </Card>
  );
}

export function KitDeliveryList({
  lineIds,
  loadError = false,
  userId = null,
  signals = emptyKitTrackerSignals(),
  onLandingPageSaved,
}: {
  lineIds: string[] | null;
  loadError?: boolean;
  userId?: string | null;
  signals?: KitTrackerSignals;
  onLandingPageSaved?: (url: string) => void;
}) {
  const knownIds = lineIds ?? [];
  const items = kitDeliveryState(knownIds);
  const addons = kitAddonViews(items);
  const ownsKit = knownIds.includes("kit");
  // Buyers see the full step list on the first paint, including while purchases load
  // and when the lookup fails. A settled empty result is the only buy prompt.
  const showSteps = ownsKit || lineIds === null || loadError;
  const guideLineIds = ownsKit ? knownIds : ["kit"];

  return (
    <div className="min-w-0 space-y-6" data-testid="kit-delivery">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <h2 className="text-xl font-bold text-foreground sm:text-2xl">One Feature Kit</h2>
          <p className="text-sm text-muted-foreground sm:text-base">
            Finish the training steps, then open the add-ons included with your account.
          </p>
        </div>
        <Link
          to="/app/community"
          data-testid="kit-join-community"
          className="inline-flex h-12 w-full shrink-0 items-center justify-center gap-2 rounded-md bg-purple-700 px-6 text-base font-semibold text-white hover:bg-purple-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-700 focus-visible:ring-offset-2 dark:bg-purple-300 dark:text-purple-950 dark:hover:bg-purple-200 sm:w-auto"
        >
          <Users className="h-4 w-4" aria-hidden="true" />
          Join the Community
        </Link>
      </header>

      {loadError ? (
        <p className="text-sm text-destructive">
          We couldn't load your kit purchases. The steps stay on this page. Refresh to try again.
        </p>
      ) : null}

      {showSteps ? (
        <KitOnboardingGuide
          lineIds={guideLineIds}
          userId={userId}
          signals={signals}
          syncUrl={lineIds !== null}
          onLandingPageSaved={onLandingPageSaved}
        />
      ) : (
        <section
          className="space-y-3 rounded-xl border border-border bg-card p-4 text-card-foreground shadow sm:p-5"
          data-testid="kit-onboarding"
        >
          <h3 className="text-lg font-semibold text-foreground">One Feature Training</h3>
          <p className="text-sm text-muted-foreground">
            Buy the kit and the training steps unlock on this page.
          </p>
          <Button asChild className="w-full sm:w-auto">
            <Link to="/one-feature-kit">Buy the kit · $27</Link>
          </Button>
        </section>
      )}

      {lineIds ? (
        <>
          <section className="space-y-3">
            <h3 className="text-lg font-semibold text-purple-800 dark:text-purple-200">
              Your add-ons
            </h3>
            <div className="grid grid-cols-1 gap-3">
              {addons.map((item) => (
                <AddonSection key={item.id} item={item} />
              ))}
            </div>
          </section>
          <KitAdTemplateLibrary lineIds={lineIds} />
        </>
      ) : null}
    </div>
  );
}

export default function OneFeatureKitDelivery() {
  const { email, userId, actualEmail } = useUser();
  const [lineIds, setLineIds] = useState<string[] | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [signals, setSignals] = useState<KitTrackerSignals>(emptyKitTrackerSignals());

  useEffect(() => {
    let cancelled = false;
    void attachKitPurchases();
    const contextEmail = email?.trim().toLowerCase() ?? "";
    const signedInEmail = actualEmail?.trim().toLowerCase() ?? "";
    const impersonating = Boolean(contextEmail && signedInEmail && contextEmail !== signedInEmail);

    void (async () => {
      // RLS returns the signed-in person's purchases. While Login As is active that
      // would be the admin's rows, so the viewed account is read on its own.
      // Access comes from that account, not from kit_purchases.
      const visible = impersonating
        ? { data: [] as KitPurchaseRow[], error: null }
        : await supabase.from("kit_purchases").select("line_id, email, comped, user_id");
      const scoped = !impersonating && email
        ? await supabase
            .from("kit_purchases")
            .select("line_id, email, comped, user_id")
            .eq("email", email.trim().toLowerCase())
        : { data: [] as KitPurchaseRow[], error: null };
      const profile = email
        ? await supabase
            .from("saas_suite_users")
            .select("approval, trial_source, landing_page, checkout_page, referrer, source")
            .ilike("email", email.trim())
            .maybeSingle()
        : { data: null, error: null };
      if (cancelled) return;
      const purchaseFailed = Boolean(visible.error && scoped.error);
      const purchased = purchaseFailed
        ? []
        : kitLineIdsFromPurchaseRows([...(visible.data ?? []), ...(scoped.data ?? [])]);
      const account = profile.error ? null : profile.data;
      const entitled = entitledKitLineIds(purchased, account);
      if (!kitAccountIsOpen(account)) {
        if (profile.error) {
          setLoadError(true);
          return;
        }
        setLoadError(false);
        setLineIds(entitled);
        return;
      }
      setLoadError(false);
      setLineIds(entitled);
    })();

    void loadKitTrackerSignals(email).then((next) => {
      if (!cancelled) setSignals(next);
    });

    return () => {
      cancelled = true;
    };
  }, [email, actualEmail]);

  return (
    <KitDeliveryList
      lineIds={lineIds}
      loadError={loadError}
      userId={userId}
      signals={signals}
      onLandingPageSaved={(url) =>
        setSignals((current) =>
          current.landingPageUrl === url ? current : { ...current, landingPageUrl: url },
        )
      }
    />
  );
}

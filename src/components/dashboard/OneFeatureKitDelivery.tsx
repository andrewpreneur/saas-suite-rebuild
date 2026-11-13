import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/premium/21st/empty-state";
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
import { GraduationCap, Users } from "lucide-react";

function AddonSection({ item }: { item: ReturnType<typeof kitAddonViews>[number] }) {
  const stage = item.unlocked ? item.statusLabel : "Locked";
  return (
    <article
      data-kit-line={item.id}
      data-kit-unlocked={item.unlocked ? "yes" : "no"}
      className={cn("px-surface", !item.unlocked && "bg-muted/40 shadow-none ring-1 ring-inset ring-border")}
    >
      {/* Add-on actions are secondary on this page; the training step holds the accent button. */}
      <div className="flex h-full flex-col gap-3 p-4 sm:p-5 [&_[data-testid=kit-primary-action]]:border [&_[data-testid=kit-primary-action]]:border-border [&_[data-testid=kit-primary-action]]:bg-card [&_[data-testid=kit-primary-action]]:bg-none [&_[data-testid=kit-primary-action]]:text-foreground [&_[data-testid=kit-primary-action]]:shadow-none hover:[&_[data-testid=kit-primary-action]]:bg-muted">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <h3 className="min-w-0 text-base font-semibold text-foreground">
            {item.title}
          </h3>
          <KitStagePill stage={stage} />
        </div>
        {item.unlocked ? (
          <>
            <div className="space-y-1">
              <p className="px-eyebrow">
                Status
              </p>
              <p className="text-sm text-foreground">{item.status}</p>
            </div>
            <div className="space-y-1">
              <p className="px-eyebrow">
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
      </div>
    </article>
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
      <div className="flex flex-col gap-3 rounded-lg border border-border bg-card/60 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <span className="px-icon-chip shrink-0" aria-hidden="true">
            <Users className="size-5" />
          </span>
          <p className="text-sm text-muted-foreground">
            <span className="font-medium text-foreground">Stuck on a step?</span> Other agency owners are
            working through the same kit.
          </p>
        </div>
        <Button asChild variant="outline" className="h-11 w-full shrink-0 sm:h-10 sm:w-auto">
          <Link to="/app/community" data-testid="kit-join-community">
            Join the Community
          </Link>
        </Button>
      </div>

      {loadError ? (
        <p role="alert" className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
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
        <section className="px-surface" data-testid="kit-onboarding">
          <EmptyState
            icon={
              <span className="px-icon-chip">
                <GraduationCap className="size-5" />
              </span>
            }
            title="One Feature Training"
            description="Buy the kit and the training steps unlock on this page."
            action={
              <Button asChild variant="accent" className="w-full sm:w-auto">
                <Link to="/one-feature-kit">Buy the kit · $27</Link>
              </Button>
            }
          />
        </section>
      )}

      {lineIds ? (
        <>
          <section className="space-y-3">
            <h2 className="text-base font-semibold text-foreground">Your add-ons</h2>
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
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

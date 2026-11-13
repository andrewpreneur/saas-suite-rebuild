import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { PageHeader } from "@/components/platform/PageHeader";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import AffiliateDashboard from "@/components/AffiliateDashboard";
import DashboardOverview from "@/components/dashboard/DashboardOverview";
import HubUrlCard from "@/components/dashboard/HubUrlCard";
import OneFeatureKitDelivery from "@/components/dashboard/OneFeatureKitDelivery";
import GiveawayOptInModal from "@/components/giveaway/GiveawayOptInModal";
import SetupHelpPopup from "@/components/dashboard/SetupHelpPopup";
import { useUser } from "@/contexts/UserContext";
import { useGiveaway } from "@/hooks/useGiveaway";
import { consumeKitHomeReturn } from "@/lib/kitReturn";

export default function Dashboard() {
  const { isEntered, isOptingIn, optIn } = useGiveaway();
  const { user } = useUser();
  const [optInOpen, setOptInOpen] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();
  const view = searchParams.get("view");
  const kitView = view === "kit";
  const overview = view !== "kit" && view !== "affiliate";

  // The kit tracker sits at the top of this view. Reset the app's scroll pane so
  // a previous overview position cannot leave the step list off screen.
  useEffect(() => {
    if (!kitView) return;
    // The bridge armed this for one auth attempt. Landing here spends it.
    consumeKitHomeReturn();
    const main = document.querySelector("main");
    if (main instanceof HTMLElement) main.scrollTop = 0;
    window.scrollTo(0, 0);
  }, [kitView]);

  // Arriving from the /challenge signup CTA (?challenge=1) opens the entry form.
  useEffect(() => {
    if (searchParams.get("challenge") !== "1") return;
    if (!isEntered) setOptInOpen(true);
    const next = new URLSearchParams(searchParams);
    next.delete("challenge");
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams, isEntered]);

  const firstName =
    (user?.user_metadata?.full_name as string | undefined)?.trim().split(/\s+/)[0] ?? "";
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  const today = new Date().toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  return (
    <div className="space-y-6">
      {/* Affiliate and One Feature Kit are their own sidebar pages, so each carries its own h1. */}
      {overview && (
        <PageHeader
          eyebrow={today}
          title={firstName ? `${greeting}, ${firstName}` : greeting}
          subtitle="How your SaaS is doing, and the one thing worth doing next."
        />
      )}
      {view === "affiliate" && (
        <PageHeader
          eyebrow="Grow"
          title="Affiliate"
          subtitle="Share your link, track referrals and get paid recurring commission."
        />
      )}
      {kitView && (
        <PageHeader
          eyebrow="Grow"
          title="One Feature Kit"
          subtitle="Finish the training steps, then open the add-ons included with your account."
        />
      )}

      <Tabs
        value={
          searchParams.get("view") === "affiliate"
            ? "affiliate"
            : searchParams.get("view") === "kit"
              ? "kit"
              : "overview"
        }
        onValueChange={(value) => {
          const next = new URLSearchParams(searchParams);
          if (value === "overview") {
            next.delete("view");
            next.delete("step");
          } else if (value === "kit") {
            next.set("view", "kit");
          } else {
            next.set("view", value);
            next.delete("step");
          }
          setSearchParams(next, { replace: true });
        }}
      >
        {/* No tab strip: Affiliate and One Feature Kit are reached from the sidebar. */}
        <TabsContent value="overview" className="mt-0">
          <DashboardOverview hubCard={overview && <HubUrlCard />} />
        </TabsContent>
        <TabsContent value="kit" className="mt-0">
          <OneFeatureKitDelivery />
        </TabsContent>
        <TabsContent value="affiliate" className="mt-0 space-y-6">
          <AffiliateDashboard />
          <SetupHelpPopup />
        </TabsContent>
      </Tabs>

      {/* Only opens when the user asks to enter — never auto-prompts. */}
      {optInOpen && (
        <GiveawayOptInModal
          open={optInOpen}
          onOpenChange={setOptInOpen}
          isEntered={isEntered}
          isOptingIn={isOptingIn}
          onOptIn={optIn}
        />
      )}
    </div>
  );
}

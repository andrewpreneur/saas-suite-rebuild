import { newUi } from "@/lib/uiVersion";
import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { PageHeader } from "@/components/platform/PageHeader";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import AffiliateDashboard from "@/components/AffiliateDashboard";
import DashboardOverview from "@/components/dashboard/DashboardOverview";
import OneFeatureKitDelivery from "@/components/dashboard/OneFeatureKitDelivery";
import HubUrlCard from "@/components/dashboard/HubUrlCard";
import GiveawayOptInModal from "@/components/giveaway/GiveawayOptInModal";
import SetupHelpPopup from "@/components/dashboard/SetupHelpPopup";
import { useGiveaway } from "@/hooks/useGiveaway";
import { consumeKitHomeReturn } from "@/lib/kitReturn";

export default function Dashboard() {
  const { isEntered, isOptingIn, optIn } = useGiveaway();
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

  return (
    <div className="space-y-6">
      {!kitView && <SetupHelpPopup />}
      {overview && <HubUrlCard />}

      {/* New UI: Affiliate and One Feature Kit are their own sidebar pages, so they carry their own title. */}
      {!kitView && !(newUi && view === "affiliate") && (
        <PageHeader
          title="Dashboard"
          subtitle="SaaS health, activity insights, and your users — all in one place."
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
        <TabsList
          className={newUi ? "hidden" : "flex h-auto min-h-9 w-full flex-wrap justify-start"}
        >
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="kit">One Feature Kit</TabsTrigger>
          <TabsTrigger value="affiliate">Affiliate</TabsTrigger>
        </TabsList>
        <TabsContent value="overview" className="mt-4">
          <DashboardOverview />
        </TabsContent>
        <TabsContent value="kit" className="mt-4">
          <OneFeatureKitDelivery />
        </TabsContent>
        <TabsContent value="affiliate" className="mt-4">
          <AffiliateDashboard />
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

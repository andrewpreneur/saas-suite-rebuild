import { PageHeader } from "@/components/platform/PageHeader";
import { LoadNotice } from "@/components/platform/LoadNotice";
import { useEffect, useState, type ReactNode } from "react";
import AnimatedTabs from "@/components/premium/21st/animated-tabs";
import { useLocation, useNavigate } from "react-router-dom";
import { pageEnter } from "@/lib/motion";
import { BookOpen, Layers, Lightbulb, Loader2, MessagesSquare } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { useCommunityProfile } from "@/hooks/useCommunityProfile";
import { consumeCommunityTour } from "@/utils/deepLink";
import { autoToursSuppressedThisSession, sequenceCompleted, toursDisabled } from "@/lib/tourSchedule";
import { useTipsBot, COMMUNITY_TOUR } from "@/components/tips-bot";
import { useUser } from "@/contexts/UserContext";
import { isPlatformAdminEmail } from "@/lib/platformAdmins";
import CommunityFeed from "./CommunityFeed";
import CommunitySnapshots from "./CommunitySnapshots";
import CommunityAcademy from "./CommunityAcademy";
import CommunityAsk from "./CommunityAsk";
import CommunityIdeas from "./CommunityIdeas";
import CommunityTestimonials from "./CommunityTestimonials";
import CommunityJoin from "./CommunityJoin";
import CommunityWelcome from "./CommunityWelcome";
import CommunityAvatarGate from "./CommunityAvatarGate";
import CommunityFeatureBanner from "./CommunityFeatureBanner";
import { Switch } from "@/components/ui/switch";
import { useEditMode } from "@/hooks/useEditMode";
import { prefetchAcademyContent } from "@/hooks/useAcademyContent";

export type CommunityTab = "feed" | "snapshots" | "academy" | "ideas" | "ask";
export type CommunityAcademySection = "lessons" | "prompts" | "skills" | "tech";

/**
 * Deep-link slugs → community page (and Academy sub-section).
 * Powers /app/community/:slug, e.g. /app/community/prompts.
 */
const DEEP_LINKS: Record<string, { tab: CommunityTab; section?: CommunityAcademySection }> = {
  feed: { tab: "feed" },
  posts: { tab: "feed" },
  snapshots: { tab: "snapshots" },
  vault: { tab: "snapshots" },
  academy: { tab: "academy" },
  courses: { tab: "academy", section: "lessons" },
  lessons: { tab: "academy", section: "lessons" },
  prompts: { tab: "academy", section: "prompts" },
  skills: { tab: "academy", section: "skills" },
  tech: { tab: "academy", section: "tech" },
  "tech-library": { tab: "academy", section: "tech" },
  ideas: { tab: "ideas" },
  ask: { tab: "ask" },
  support: { tab: "ask" },
};

export function resolveCommunityDeepLink(slug?: string) {
  return slug ? DEEP_LINKS[slug.toLowerCase()] : undefined;
}

/** Canonical slug for a tab (+ academy section) so the URL stays shareable. */
function slugFor(tab: CommunityTab, section?: CommunityAcademySection) {
  if (tab === "academy") return section ?? "academy";
  return tab;
}

const NAV: { id: CommunityTab; label: string; icon: ReactNode }[] = [
  { id: "feed", label: "Group Chat", icon: <MessagesSquare aria-hidden="true" /> },
  { id: "ideas", label: "Ideas", icon: <Lightbulb aria-hidden="true" /> },
  { id: "academy", label: "Resources", icon: <BookOpen aria-hidden="true" /> },
  { id: "snapshots", label: "Snapshots", icon: <Layers aria-hidden="true" /> },
];

export default function CommunityHub({
  initialTab = "feed",
  initialAcademySection,
}: {
  initialTab?: CommunityTab;
  initialAcademySection?: CommunityAcademySection;
}) {
  const { profile, isLoading, isPaid, isStaff, hasJoined, error, refetch } = useCommunityProfile();
  const { user, isImpersonating } = useUser();
  // Announcements post as the official SaaSSuite account — owner only, never while
  // impersonating another account via "Login as user".
  const canAnnounce =
    !isImpersonating && isPlatformAdminEmail(user?.email);
  // Staff powers (all private threads, editing others' posts) never carry over into a
  // "Login as user" session — the impersonated member only ever sees their own data.
  const staff = isStaff && !isImpersonating;
  const location = useLocation();
  const navigate = useNavigate();
  // The URL is the source of truth: /app/community/<slug>. Props are just the
  // initial hint (they come from the same place), so re-derive on every render
  // to stay correct even if the parent re-mounts or the slug changes.
  const urlSlug = location.pathname.split("/")[3];
  const urlLink = resolveCommunityDeepLink(urlSlug);
  const [tab, setTab] = useState<CommunityTab>(urlLink?.tab ?? initialTab);
  const [academySection, setAcademySection] = useState<CommunityAcademySection | undefined>(
    urlLink?.section ?? initialAcademySection,
  );
  const [celebrating, setCelebrating] = useState(false);
  const { startTipSequence } = useTipsBot();
  const { editMode, setEditMode } = useEditMode();

  // Warm the Academy cache. Group chat is the landing tab; resources stay one click away.
  useEffect(() => {
    prefetchAcademyContent();
  }, []);

  // Keep the view in sync when the URL (deep link) changes.

  useEffect(() => {
    const link = resolveCommunityDeepLink(location.pathname.split("/")[3]);
    if (link) {
      setTab(link.tab);
      setAcademySection(link.section);
    }
  }, [location.pathname]);

  // Deep-link support (e.g. the sidebar "Ideas" entry).
  useEffect(() => {
    const requested = sessionStorage.getItem("community_tab");
    if (requested) {
      sessionStorage.removeItem("community_tab");
      // A URL deep link always wins over a stale sessionStorage hint.
      if (!urlLink && ["feed", "snapshots", "academy", "ideas", "ask"].includes(requested)) {
        setTab(requested as CommunityTab);
      }
    }
  }, []);

  // Switching pages inside the hub keeps the URL shareable.
  const goToTab = (next: CommunityTab) => {
    setTab(next);
    if (next !== "academy") setAcademySection(undefined);
    navigate(`/app/community/${slugFor(next, next === "academy" ? academySection : undefined)}`, {
      replace: true,
    });
  };

  // Members who signed up from the /community landing page get a one-shot
  // interactive tour as soon as the hub is actually usable.
  useEffect(() => {
    if (isLoading || !hasJoined || celebrating || !profile?.avatar_url) return;
    const who = user?.email?.trim().toLowerCase() || "";
    if (toursDisabled(who) || autoToursSuppressedThisSession(who) || sequenceCompleted(COMMUNITY_TOUR[0]?.id || "", who)) return;
    if (!consumeCommunityTour()) return;
    const t = setTimeout(() => startTipSequence(COMMUNITY_TOUR), 700);
    return () => clearTimeout(t);
  }, [isLoading, hasJoined, celebrating, profile?.avatar_url, user?.email]);

  useEffect(() => {
    if (!celebrating) return;
    const t = setTimeout(() => setCelebrating(false), 2200);
    return () => clearTimeout(t);
  }, [celebrating]);

  // The interactive walkthrough can drive which community page is shown.
  useEffect(() => {
    const onNavigate = (e: Event) => {
      const requested = (e as CustomEvent).detail?.communityTab;
      if (requested && ["feed", "snapshots", "academy", "ideas", "ask"].includes(requested)) {
        setTab(requested as CommunityTab);
      }
    };
    window.addEventListener("tipbot-navigate", onNavigate);
    return () => window.removeEventListener("tipbot-navigate", onNavigate);
  }, []);

  const header = (
    <PageHeader
      title="Community"
      subtitle="Group chat, ideas, resources, and snapshots from other agencies."
    />
  );

  if (error || isLoading) {
    return (
      <div className="min-w-0 space-y-6">
        {header}
        <LoadNotice loading={isLoading} error={error} label="Loading community…" onRetry={() => void refetch()} />
      </div>
    );
  }

  if (celebrating) {
    return (
      <div className="min-w-0 space-y-6">
        {header}
        <CommunityWelcome name={profile?.display_name} />
      </div>
    );
  }

  if (!hasJoined) {
    return (
      <div className="min-w-0 space-y-6">
        {header}
        <CommunityJoin
          profile={profile}
          onJoined={async () => {
            setCelebrating(true);
            await refetch();
          }}
        />
      </div>
    );
  }

  if (!profile?.avatar_url) {
    return (
      <div className="min-w-0 space-y-6">
        {header}
        <CommunityAvatarGate profile={profile} onDone={refetch} />
      </div>
    );
  }

  const nav = (
    <AnimatedTabs
      variant="pill"
      layoutId="community-sub-nav"
      activeTab={tab}
      onChange={(id) => goToTab(id as CommunityTab)}
      tabs={NAV.map((item) => ({ id: item.id, label: item.label, icon: item.icon }))}
      className="w-max [&>button]:min-h-[44px] [&>button]:whitespace-nowrap [&>button]:px-4 sm:[&>button]:min-h-[40px] [&_svg]:size-4"
    />
  );

  return (
    <div className="min-w-0 space-y-6">
      {header}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div
          className="-mx-4 min-w-0 max-w-[calc(100%+2rem)] overflow-x-auto px-4 [scrollbar-width:none] sm:mx-0 sm:max-w-full sm:px-0 [&::-webkit-scrollbar]:hidden"
          data-tip-target="community-nav"
        >
          {nav}
        </div>
        {canAnnounce && (
          <div className="flex min-h-[44px] items-center gap-2">
            <label htmlFor="community-edit-mode" className="text-sm font-medium text-muted-foreground">
              Edit mode
            </label>
            <Switch id="community-edit-mode" checked={editMode} onCheckedChange={setEditMode} />
          </div>
        )}
      </div>

      <div data-tip-target={`community-page-${tab}`}>
        <AnimatePresence mode="wait">
          <motion.div
            key={tab}
            variants={pageEnter}
            initial="hidden"
            animate="show"
            exit="exit"
            className="space-y-4"
          >
            {tab === "feed" && (
              <>
                <CommunityFeatureBanner />
                <CommunityFeed profile={profile} isStaff={staff} canAnnounce={canAnnounce} />
              </>
            )}
            {tab === "snapshots" && <CommunitySnapshots isPaid={isPaid} />}
            {tab === "academy" && (
              <CommunityAcademy
                profile={profile}
                isPaid={isPaid}
                isOwner={canAnnounce}
                initialSection={academySection}
                onSectionChange={(s) => {
                  setAcademySection(s);
                  navigate(`/app/community/${s}`, { replace: true });
                }}
              />
            )}
            {tab === "ideas" && <CommunityIdeas profile={profile} isStaff={staff} />}
            {tab === "ask" && <CommunityAsk profile={profile} isPaid={isPaid} isStaff={staff} />}
          </motion.div>
        </AnimatePresence>
      </div>

      <div data-tip-target="community-testimonials">
        <CommunityTestimonials />
      </div>
    </div>
  );
}

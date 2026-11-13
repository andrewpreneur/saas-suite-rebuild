import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowUpRight, Megaphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SectionCard } from "@/components/premium/SectionCard";
import { EmptyState } from "@/components/premium/21st/empty-state";
import { DURATION, EASE_OUT } from "@/lib/motion";
import { cn } from "@/lib/utils";
import { useTipsBot } from "@/components/tips-bot";
import { ANNOUNCEMENT_TOURS } from "@/components/tips-bot/announcementTours";
import communityImg from "@/assets/announcement-community.jpg.asset.json";
import slackImg from "@/assets/announcement-slack.jpg.asset.json";
import affiliateImg from "@/assets/announcement-affiliate.jpg.asset.json";
import moduleReorderImg from "@/assets/announcement-module-reorder.jpg";
import ticketReplyImg from "@/assets/announcement-ticket-reply.jpg";
import videoThumbImg from "@/assets/announcement-video-thumbnail.jpg";
import copilotImg from "@/assets/announcement-copilot.jpg";
import popupIframeImg from "@/assets/announcement-popup-iframe.jpg";

type Announcement = {
  /** Key into ANNOUNCEMENT_TOURS for the 3-step mini walkthrough. */
  tour?: string;
  title: string;
  body: string;
  image?: string;
  /** "tool:<id>" navigates in-app via tipbot-select-tool event; a path navigates via react-router. */
  link?: string;
};

const ANNOUNCEMENTS: Announcement[] = [
  {
    title: "The Community Center is live",
    body: "Join other agency owners inside the platform — share wins, ask questions and vote on what we build next.",
    image: communityImg.url,
    link: "tool:community",
    tour: "community",
  },
  {
    title: "Slack alerts on every plan",
    body: "Connect your workspace in Settings to get pinged the moment a client logs in, onboards or opens a ticket.",
    image: slackImg.url,
    link: "/slack-integration",
    tour: "slack",
  },
  {
    title: "Become an affiliate today",
    body: "Earn recurring commissions for every agency you refer to SaaS Suite — grab your link in the Affiliate tab.",
    image: affiliateImg.url,
    link: "/affiliate",
    tour: "affiliate",
  },
  {
    title: "Client Hub module reordering",
    body: "Drag to reorder and rename every module — built-in or custom. Changes hit your clients instantly.",
    image: moduleReorderImg,
    link: "tool:client-hub",
    tour: "module-reorder",
  },
  {
    title: "Respond to tickets with attachments",
    body: "Write a reply, attach a screenshot, and our AI emails your client a polished ticket update.",
    image: ticketReplyImg,
    link: "tool:support",
    tour: "ticket-reply",
  },
  {
    title: "Welcome video thumbnails",
    body: "Upload a custom thumbnail so the first thing your clients see looks intentional.",
    image: videoThumbImg,
    link: "tool:client-hub",
    tour: "video-thumbnail",
  },
  {
    title: "AI CoPilot everywhere",
    body: "Ask CoPilot anything about your account, your clients, or your setup — even mid-onboarding.",
    image: copilotImg,
  },
  {
    title: "Popup iFrame buttons",
    body: "Any custom button can now open in a slick in-app popup instead of a new tab.",
    image: popupIframeImg,
    link: "tool:client-hub",
    tour: "popup-iframe",
  },
];

const FIRST = 4;

/**
 * "What's new": a calm list of product updates. No auto-rotation; the newest four
 * show, the rest open on request. A row with a destination opens it and starts its
 * short tour.
 */
export default function AnnouncementsCard({ className = "" }: { className?: string }) {
  const navigate = useNavigate();
  const { startTipSequence } = useTipsBot();
  const [showAll, setShowAll] = useState(false);

  const handleOpen = (link?: string, tour?: string) => {
    if (!link) return;
    if (link.startsWith("tool:")) {
      const tool = link.slice(5);
      window.dispatchEvent(
        new CustomEvent("tipbot-select-tool", { detail: { tool } })
      );
    } else {
      navigate(link);
    }
    // Kick off the 3-step tour once the destination has had a beat to mount.
    const tips = tour ? ANNOUNCEMENT_TOURS[tour] : undefined;
    if (tips?.length) {
      setTimeout(() => startTipSequence(tips), 500);
    }
  };

  const visible = showAll ? ANNOUNCEMENTS : ANNOUNCEMENTS.slice(0, FIRST);

  return (
    <SectionCard
      className={className}
      icon={<Megaphone />}
      title="What's new"
      description="Recent additions to your SaaS Suite account"
      actions={
        ANNOUNCEMENTS.length > FIRST ? (
          <Button variant="ghost" size="sm" onClick={() => setShowAll((v) => !v)} aria-expanded={showAll}>
            {showAll ? "Show fewer" : `Show all ${ANNOUNCEMENTS.length}`}
          </Button>
        ) : null
      }
    >
      {ANNOUNCEMENTS.length === 0 ? (
        <EmptyState
          icon={<span className="px-icon-chip"><Megaphone className="size-5" /></span>}
          title="No updates yet"
          description="New features and changes will show up here."
        />
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <AnimatePresence initial={false}>
            {visible.map((item) => {
              const inner = (
                <>
                  <span className="block aspect-square w-20 shrink-0 overflow-hidden rounded-md bg-muted sm:aspect-[16/9] sm:w-full">
                    <img
                      src={item.image}
                      alt=""
                      loading="lazy"
                      draggable={false}
                      className="h-full w-full object-cover transition-transform duration-300 ease-out group-hover:scale-105"
                    />
                  </span>
                  <span className="block min-w-0 flex-1 sm:mt-3">
                    <span className="flex items-start justify-between gap-2">
                      <span className="text-small font-semibold text-foreground">{item.title}</span>
                      {item.link ? (
                        <ArrowUpRight
                          className="mt-0.5 size-4 shrink-0 text-muted-foreground transition-colors group-hover:text-brand"
                          aria-hidden="true"
                        />
                      ) : null}
                    </span>
                    <span className="mt-1 line-clamp-3 block text-small text-muted-foreground">{item.body}</span>
                  </span>
                </>
              );
              const shell = "group flex h-full w-full items-start gap-3 rounded-lg p-2 text-left sm:flex-col sm:gap-0";
              return (
                <motion.li
                  key={item.title}
                  layout="position"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: DURATION.slow, ease: EASE_OUT }}
                  className="min-w-0"
                >
                  {item.link ? (
                    <button
                      type="button"
                      onClick={() => handleOpen(item.link, item.tour)}
                      className={cn(
                        shell,
                        "transition-colors hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                      )}
                    >
                      {inner}
                    </button>
                  ) : (
                    <div className={shell}>{inner}</div>
                  )}
                </motion.li>
              );
            })}
          </AnimatePresence>
        </ul>
      )}
    </SectionCard>
  );
}

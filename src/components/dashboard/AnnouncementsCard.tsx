import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { Megaphone } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
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

export default function AnnouncementsCard({ className = "" }: { className?: string }) {
  const navigate = useNavigate();
  const { startTipSequence } = useTipsBot();
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [direction, setDirection] = useState(1);
  const item = ANNOUNCEMENTS[index];

  const go = (dir: number) => {
    setDirection(dir);
    setIndex((i) => (i + dir + ANNOUNCEMENTS.length) % ANNOUNCEMENTS.length);
  };

  const handleImageClick = (link?: string, tour?: string) => {
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

  useEffect(() => {
    if (paused) return;
    const t = setInterval(() => {
      setDirection(1);
      setIndex((i) => (i + 1) % ANNOUNCEMENTS.length);
    }, 5000);
    return () => clearInterval(t);
  }, [paused, index]);

  return (
    <Card className={"flex flex-col rounded-2xl border-border/60 bg-card " + className}>
      <CardContent className="flex flex-1 flex-col p-5 sm:p-6">
        <div className="flex items-center gap-2">
          <Megaphone className="h-5 w-5 sm:h-4 sm:w-4 text-primary" />
          <h3 className="text-lg sm:text-base font-semibold">Announcements</h3>
        </div>

        <div
          className="relative mt-4 flex-1 overflow-hidden"
          onMouseEnter={() => setPaused(true)}
          onMouseLeave={() => setPaused(false)}
        >
          <AnimatePresence mode="popLayout" initial={false} custom={direction}>
            <motion.div
              key={index}
              custom={direction}
              initial={{ opacity: 0, x: direction * 40 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: direction * -40 }}
              transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
              drag="x"
              dragConstraints={{ left: 0, right: 0 }}
              dragElastic={0.2}
              onDragEnd={(_, info) => {
                if (info.offset.x < -60) go(1);
                else if (info.offset.x > 60) go(-1);
              }}
              className="flex h-full cursor-grab flex-col active:cursor-grabbing"
            >
              <div className="flex aspect-[16/9] w-full items-center justify-center overflow-hidden rounded-xl border border-border/60 bg-muted/50">
                <button
                  type="button"
                  onClick={() => handleImageClick(item.link, item.tour)}
                  className="group/img h-full w-full overflow-hidden"
                  title={item.link ? "Click to open" : undefined}
                >
                  <img
                    src={item.image}
                    alt={item.title}
                    className="pointer-events-none h-full w-full select-none object-cover transition-transform duration-300 ease-out group-hover/img:scale-110"
                    loading="lazy"
                    draggable={false}
                  />
                </button>
              </div>
              <div className="flex flex-1 flex-col justify-center py-3 text-center">
                <h4 className="text-base sm:text-sm font-semibold text-foreground">{item.title}</h4>
                <p className="mt-1 text-sm sm:text-xs text-muted-foreground">{item.body}</p>
              </div>
            </motion.div>
          </AnimatePresence>
        </div>

        <div className="mt-2 flex justify-center gap-1.5">
          {ANNOUNCEMENTS.map((a, i) => (
            <button
              key={a.title}
              type="button"
              aria-label={`Show ${a.title}`}
              onClick={() => {
                setDirection(i > index ? 1 : -1);
                setIndex(i);
              }}
              className={
                "h-1.5 rounded-full transition-all " +
                (i === index ? "w-6 bg-primary" : "w-1.5 bg-border hover:bg-muted-foreground/50")
              }
            />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

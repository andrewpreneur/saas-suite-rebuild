import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Sparkles } from "lucide-react";

type Feature = { title: string; body: string };

const FEATURES: Feature[] = [
  {
    title: "Client Hub module reordering",
    body: "Drag to reorder and rename every module — built-in or custom. Changes hit your clients instantly.",
  },
  {
    title: "Slack integration on every plan",
    body: "Connect your workspace in Settings for instant alerts on onboardings, AI chats and ticket updates.",
  },
  {
    title: "Respond to tickets with attachments",
    body: "Write a reply, attach a screenshot, and our AI emails your client a polished ticket update.",
  },
  {
    title: "Welcome video thumbnails",
    body: "Upload a custom thumbnail so the first thing your clients see looks intentional.",
  },
  {
    title: "AI CoPilot everywhere",
    body: "Ask CoPilot anything about your account, your clients, or your setup — even mid-onboarding.",
  },
  {
    title: "Popup iFrame buttons",
    body: "Any custom button can now open in a slick in-app popup instead of a new tab.",
  },
];

export default function CommunityFeatureBanner() {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setIndex((i) => (i + 1) % FEATURES.length), 6000);
    return () => clearInterval(t);
  }, []);

  const feature = FEATURES[index];

  return (
    <div className="px-surface px-brand-wash relative overflow-hidden p-4 sm:p-6">
      <div className="relative">
        <div className="px-eyebrow flex items-center gap-2 text-brand">
          <Sparkles className="h-3.5 w-3.5" />
          Feature of the week
        </div>
        <AnimatePresence mode="wait">
          <motion.div
            key={index}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.32, ease: [0.16, 1, 0.3, 1] }}
            className="mt-2 min-h-[72px] sm:min-h-[56px]"
          >
            <h2 className="text-base font-semibold text-foreground sm:text-lg">{feature.title}</h2>
            <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{feature.body}</p>
          </motion.div>
        </AnimatePresence>
        <div className="mt-3 flex gap-1.5">
          {FEATURES.map((f, i) => (
            <button
              key={f.title}
              aria-label={`Show ${f.title}`}
              onClick={() => setIndex(i)}
              className="group flex h-6 items-center"
            >
              <span
                className={`block h-1.5 rounded-full transition-all duration-200 ${
                  i === index ? "w-6 bg-brand" : "w-1.5 bg-brand/30 group-hover:bg-brand/60"
                }`}
              />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

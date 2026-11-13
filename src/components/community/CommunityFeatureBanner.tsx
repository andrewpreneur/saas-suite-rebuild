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
    <div className="relative overflow-hidden rounded-xl bg-gradient-primary p-5 shadow-elevated sm:p-6">
      <div className="pointer-events-none absolute -right-10 -top-16 h-48 w-48 rounded-full bg-primary-foreground/10 blur-2xl" />
      <div className="relative">
        <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-primary-foreground/80">
          <Sparkles className="h-3.5 w-3.5" />
          Feature of the week
        </div>
        <AnimatePresence mode="wait">
          <motion.div
            key={index}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.4, ease: "easeOut" }}
            className="mt-2"
          >
            <h2 className="text-lg font-semibold text-primary-foreground sm:text-xl">{feature.title}</h2>
            <p className="mt-1 max-w-2xl text-sm text-primary-foreground/85">{feature.body}</p>
          </motion.div>
        </AnimatePresence>
        <div className="mt-4 flex gap-1.5">
          {FEATURES.map((f, i) => (
            <button
              key={f.title}
              aria-label={`Show ${f.title}`}
              onClick={() => setIndex(i)}
              className={`h-1.5 rounded-full transition-all ${
                i === index ? "w-6 bg-primary-foreground" : "w-1.5 bg-primary-foreground/40"
              }`}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

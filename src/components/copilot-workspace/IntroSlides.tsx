import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Rocket, Palette, MessageCircleQuestion, Link2, LogIn, Monitor, Code2, Gift, Users, Sparkles as Spark, LayoutDashboard } from "lucide-react";
import { Button } from "@/components/ui/button";
import { INTRO_SLIDES } from "@/lib/copilotWorkspace";
import { cn } from "@/lib/utils";

import { EASE_OUT as ease, slideStep } from "@/lib/motion";

function Bubble({ children, delay = 0, className }: { children: React.ReactNode; delay?: number; className?: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9, y: 8 }} animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ duration: 0.36, delay, ease }}
      className={cn("flex items-center justify-center rounded-lg border border-border/60 bg-card text-brand shadow-card", className)}
    >
      {children}
    </motion.div>
  );
}

/** Simple animated illustrations — swap any of these for final artwork later. */
function SlideGraphic({ index }: { index: number }) {
  switch (index) {
    case 0:
      return (
        <div className="relative h-48 w-64">
          <motion.div initial={{ pathLength: 0, opacity: 0 }} animate={{ opacity: 1 }} className="absolute inset-x-6 top-1/2 h-0.5 bg-border" />
          <Bubble className="absolute left-0 top-14 h-20 w-20"><Users className="h-9 w-9" /></Bubble>
          <motion.div initial={{ x: 0, opacity: 0 }} animate={{ x: 150, opacity: [0, 1, 1, 0] }} transition={{ duration: 1.6, delay: 0.4, repeat: Infinity, repeatDelay: 0.6 }} className="absolute left-16 top-[88px] h-3 w-3 rounded-full bg-brand" />
          <Bubble delay={0.2} className="absolute right-0 top-14 h-20 w-20"><Rocket className="h-9 w-9" /></Bubble>
        </div>
      );
    case 1: {
      const items = [Palette, MessageCircleQuestion, Link2, LayoutDashboard, LogIn, Spark];
      return (
        <div className="grid grid-cols-3 gap-3">
          {items.map((I, i) => (
            <Bubble key={i} delay={i * 0.08} className="h-16 w-16"><I className="h-7 w-7" /></Bubble>
          ))}
        </div>
      );
    }
    case 2:
      return (
        <div className="flex items-center gap-3">
          <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.5, ease }} className="w-20 h-44 rounded-lg border border-border/60 bg-card p-2 space-y-2 shadow-card">
            {[0, 1, 2, 3].map((i) => <div key={i} className={cn("h-3 rounded", i === 1 ? "bg-brand" : "bg-muted")} />)}
          </motion.div>
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.2, ease }} className="w-44 h-44 rounded-lg border border-border/60 bg-card p-3 space-y-2 shadow-card">
            <div className="h-4 w-24 rounded bg-brand/70" />
            <div className="h-3 w-32 rounded bg-muted" />
            <div className="h-16 rounded-lg bg-muted" />
            <div className="flex gap-2"><Code2 className="h-4 w-4 text-brand" /><div className="h-3 flex-1 rounded bg-muted" /></div>
          </motion.div>
        </div>
      );
    case 3:
      return (
        <Bubble className="h-40 w-56 flex-col gap-2">
          <Monitor className="h-16 w-16" />
          <motion.div initial={{ scaleX: 0 }} animate={{ scaleX: 1 }} transition={{ duration: 1, delay: 0.4, ease }} className="h-1.5 w-28 origin-left rounded-full bg-brand" />
        </Bubble>
      );
    default:
      return (
        <div className="relative">
          <Bubble className="h-36 w-36"><Gift className="h-16 w-16" /></Bubble>
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: -6 }} transition={{ delay: 0.5, duration: 0.6, ease }} className="absolute -top-4 -right-6 rounded-full px-brand-fill px-3 py-1 text-sm font-semibold">$0</motion.div>
        </div>
      );
  }
}

export function IntroSlides({ onDone }: { onDone: () => void }) {
  const [i, setI] = useState(0);
  const [direction, setDirection] = useState(1);
  const last = i === INTRO_SLIDES.length - 1;
  const go = (next: number) => { setDirection(next > i ? 1 : -1); setI(next); };
  return (
    <div className="px-canvas flex min-h-[100dvh] flex-col items-center justify-center px-4 py-10">
      <div className="px-surface w-full max-w-lg overflow-hidden border border-border/60 p-6 sm:p-8">
        <p className="px-eyebrow text-center">Welcome · {i + 1} of {INTRO_SLIDES.length}</p>
        <AnimatePresence mode="wait" custom={direction} initial={false}>
          <motion.div key={i} custom={direction} variants={slideStep} initial="enter" animate="center" exit="exit" className="flex w-full flex-col items-center text-center">
            <div className="px-brand-wash mt-4 flex h-56 w-full items-center justify-center rounded-lg"><SlideGraphic index={i} /></div>
            <p className="mt-6 min-h-[5.25rem] text-pretty text-body-lg text-foreground">
              {INTRO_SLIDES[i].text.split(/(\*\*.*?\*\*)/g).map((part, n) => part.startsWith("**") ? <strong key={n} className="font-semibold">{part.slice(2, -2)}</strong> : part)}
            </p>
          </motion.div>
        </AnimatePresence>
        <div className="mt-6 flex items-center justify-between gap-4">
          <nav aria-label="Slide progress" className="flex">
            {INTRO_SLIDES.map((s, n) => (
              <button key={s.key} onClick={() => go(n)} aria-label={`Slide ${n + 1}`} aria-current={n === i}
                className="group px-1 py-4 focus-visible:outline-none">
                <span className={cn("block h-1.5 rounded-full transition-all duration-200 group-focus-visible:ring-2 group-focus-visible:ring-brand/40", n === i ? "w-6 bg-brand" : "w-1.5 bg-border group-hover:bg-muted-foreground/50")} />
              </button>
            ))}
          </nav>
          <Button size="lg" variant="accent" className="min-w-32" onClick={() => (last ? onDone() : go(i + 1))}>
            {last ? "Get started" : "Next"}
          </Button>
        </div>
      </div>
    </div>
  );
}

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Rocket, Palette, MessageCircleQuestion, Link2, LogIn, Monitor, Code2, Gift, Users, Sparkles as Spark, LayoutDashboard } from "lucide-react";
import { Button } from "@/components/ui/button";
import { INTRO_SLIDES } from "@/lib/copilotWorkspace";
import { cn } from "@/lib/utils";

const ease = [0.16, 1, 0.3, 1] as const;

function Bubble({ children, delay = 0, className }: { children: React.ReactNode; delay?: number; className?: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.6, y: 12 }} animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ duration: 0.5, delay, ease }}
      className={cn("flex items-center justify-center rounded-2xl border border-border bg-card shadow-sm text-primary", className)}
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
          <motion.div initial={{ x: 0, opacity: 0 }} animate={{ x: 150, opacity: [0, 1, 1, 0] }} transition={{ duration: 1.6, delay: 0.4, repeat: Infinity, repeatDelay: 0.6 }} className="absolute left-16 top-[88px] h-3 w-3 rounded-full bg-primary" />
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
          <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.5, ease }} className="w-20 h-44 rounded-xl border border-border bg-card p-2 space-y-2">
            {[0, 1, 2, 3].map((i) => <div key={i} className={cn("h-3 rounded", i === 1 ? "bg-primary" : "bg-muted")} />)}
          </motion.div>
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.2, ease }} className="w-44 h-44 rounded-xl border border-border bg-card p-3 space-y-2">
            <div className="h-4 w-24 rounded bg-primary/70" />
            <div className="h-3 w-32 rounded bg-muted" />
            <div className="h-16 rounded-lg bg-muted" />
            <div className="flex gap-2"><Code2 className="h-4 w-4 text-primary" /><div className="h-3 flex-1 rounded bg-muted" /></div>
          </motion.div>
        </div>
      );
    case 3:
      return (
        <Bubble className="h-40 w-56 flex-col gap-2">
          <Monitor className="h-16 w-16" />
          <motion.div initial={{ scaleX: 0 }} animate={{ scaleX: 1 }} transition={{ duration: 1, delay: 0.4, ease }} className="h-1.5 w-28 origin-left rounded-full bg-primary" />
        </Bubble>
      );
    default:
      return (
        <div className="relative">
          <Bubble className="h-36 w-36"><Gift className="h-16 w-16" /></Bubble>
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: -6 }} transition={{ delay: 0.5, duration: 0.6, ease }} className="absolute -top-4 -right-6 rounded-full bg-primary px-3 py-1 text-sm font-semibold text-primary-foreground">$0</motion.div>
        </div>
      );
  }
}

export function IntroSlides({ onDone }: { onDone: () => void }) {
  const [i, setI] = useState(0);
  const last = i === INTRO_SLIDES.length - 1;
  return (
    <div className="min-h-[100dvh] flex flex-col items-center justify-center px-6 py-10 bg-background">
      <AnimatePresence mode="wait">
        <motion.div key={i} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.2 }} className="flex flex-col items-center text-center max-w-md w-full">
          <div className="h-56 flex items-center justify-center"><SlideGraphic index={i} /></div>
          <motion.p
            initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1, duration: 0.5, ease }}
            className="mt-8 text-lg sm:text-xl leading-relaxed text-foreground"
          >
            {INTRO_SLIDES[i].text.split(/(\*\*.*?\*\*)/g).map((part, n) => part.startsWith("**") ? <strong key={n} className="font-semibold">{part.slice(2, -2)}</strong> : part)}
          </motion.p>
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 2, duration: 0.5, ease }} className="mt-10">
            <Button size="lg" className="rounded-full px-10 h-12" onClick={() => (last ? onDone() : setI(i + 1))}>
              {last ? "Get started" : "Next"}
            </Button>
          </motion.div>
        </motion.div>
      </AnimatePresence>
      <nav aria-label="Slide progress" className="mt-14 flex gap-1 opacity-40 hover:opacity-80 transition-opacity">
        {INTRO_SLIDES.map((s, n) => (
          <button key={s.key} onClick={() => setI(n)} aria-label={`Slide ${n + 1}`} aria-current={n === i}
            className="p-2">
            <span className={cn("block h-2 w-2 rounded-full transition-colors", n === i ? "bg-foreground" : "bg-muted-foreground/50")} />
          </button>
        ))}
      </nav>
    </div>
  );
}

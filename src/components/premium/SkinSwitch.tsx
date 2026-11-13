// Adapted from 21st.dev: "Theme Switcher" by ncdai (https://21st.dev). Two options instead of three, our skins instead of next-themes.
import { motion } from "framer-motion";
import { GlassWater, Square } from "lucide-react";
import { setSkin, useSkin, type Skin } from "@/lib/skin";
import { cn } from "@/lib/utils";

const OPTIONS: { value: Skin; label: string; icon: typeof Square }[] = [
  { value: "clean", label: "Clean", icon: Square },
  { value: "glass", label: "Glass", icon: GlassWater },
];

/** Switches the whole app between the Clean and Glass skins. */
export function SkinSwitch({ className, showLabels = false }: { className?: string; showLabels?: boolean }) {
  const skin = useSkin();
  return (
    <div
      role="radiogroup"
      aria-label="App look"
      data-testid="skin-switch"
      className={cn("inline-flex h-9 items-center rounded-full bg-card p-0.5 shadow-card", className)}
    >
      {OPTIONS.map((option) => {
        const active = skin === option.value;
        const Icon = option.icon;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={active}
            aria-label={`${option.label} look`}
            title={`${option.label} look`}
            onClick={() => setSkin(option.value)}
            className={cn(
              "relative flex h-8 min-w-8 items-center justify-center gap-1.5 rounded-full px-2 text-xs font-semibold transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              active ? "text-primary" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {active ? (
              <motion.span
                layoutId="skin-switch-pill"
                transition={{ type: "spring", bounce: 0.2, duration: 0.45 }}
                className="absolute inset-0 rounded-full bg-[hsl(var(--brand-subtle))] shadow-[inset_0_0_0_1px_rgba(96,67,239,0.22)]"
              />
            ) : null}
            <Icon className="relative size-4" aria-hidden="true" />
            {showLabels ? <span className="relative pr-1">{option.label}</span> : null}
          </button>
        );
      })}
    </div>
  );
}

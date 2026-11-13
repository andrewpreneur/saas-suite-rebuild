import type { ReactNode } from "react";
import GlassCard from "@/components/premium/21st/glass-card";
import { useSkin } from "@/lib/skin";

/**
 * Wraps the ONE most important block on a screen. In the Glass skin it becomes
 * a real glass pane (refracting rim, pointer-following highlight); in Clean it
 * adds nothing. Use it at most once per screen.
 */
export function HeroPane({ children, className }: { children: ReactNode; className?: string }) {
  const skin = useSkin();
  if (skin !== "glass") return <div className={className}>{children}</div>;
  return (
    <GlassCard tint="rgba(255, 255, 255, 0.5)" radius={18} rimWidth={8} refraction={14} shadow={false} className={className}>
      {children}
    </GlassCard>
  );
}

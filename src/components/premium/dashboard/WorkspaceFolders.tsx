import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { DURATION, EASE_OUT } from "@/lib/motion";
import GlassFolder, { type ArtPreset } from "@/components/premium/21st/glass-folder-cards";
import { NEW_UI_SIDEBAR_SECTIONS, TOOL_LABELS } from "@/lib/sidebarNav";
import { pathForAppTool } from "@/lib/appRoutes";
import { useIsMobile } from "@/hooks/use-mobile";

const ART: Record<string, ArtPreset> = {
  hub: "aurora",
  brand: "dusk",
  support: "glacier",
  growth: "ember",
  learn: "verdant",
};
const BLURB: Record<string, string> = {
  hub: "What clients see",
  brand: "Make it yours",
  support: "Answer clients",
  growth: "Earn and reach",
  learn: "Trainings and help",
};

function pathFor(toolId: string): string {
  if (toolId === "affiliate-dashboard") return "/app/dashboard?view=affiliate";
  if (toolId === "one-feature-kit") return "/app/dashboard?view=kit";
  return pathForAppTool(toolId);
}

/**
 * The whole app as five folders. Hover one to peek, open it to fan out its
 * pages, pick a page to go there. Same groups and names as the sidebar.
 */
export function WorkspaceFolders() {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const width = isMobile ? 164 : 208;
  const [openId, setOpenId] = useState<string | null>(null);
  const openSection = NEW_UI_SIDEBAR_SECTIONS.find((section) => section.id === openId) ?? null;
  return (
    <div>
      <div className="grid grid-cols-2 justify-items-center gap-x-3 gap-y-6 sm:grid-cols-3 lg:grid-cols-5">
        {NEW_UI_SIDEBAR_SECTIONS.map((section, index) => {
          const ids = section.toolIds.filter((id) => id !== "help");
          return (
            <GlassFolder
              key={section.id}
              label={section.label}
              // The second line would render under 7px at this size, so it is left blank.
              meta=" "
              aria-label={`${section.label}: ${BLURB[section.id] ?? ""}`}
              art={ART[section.id] ?? "aurora"}
              seed={index * 4 + 3}
              action="none"
              width={width}
              appearDelay={index * 70}
              open={openId === section.id}
              onOpenChange={(open) => setOpenId(open ? section.id : (current) => (current === section.id ? null : current))}
              files={ids.map((id) => ({ name: TOOL_LABELS[id] ?? id, meta: "Open", id })) as never}
              onFileSelect={(file) => navigate(pathFor((file as unknown as { id: string }).id))}
            />
          );
        })}
      </div>
      {/* The folder's pages again at a readable size, so nobody has to aim at a tiny sheet. */}
      <AnimatePresence mode="wait">
        {openSection ? (
          <motion.div
            key={openSection.id}
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: DURATION.base, ease: EASE_OUT }}
            className="px-surface mt-5 flex flex-wrap items-center gap-2 p-3"
            role="group"
            aria-label={`${openSection.label} pages`}
          >
            <span className="px-eyebrow px-2">{openSection.label}</span>
            {openSection.toolIds
              .filter((id) => id !== "help")
              .map((id) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => navigate(pathFor(id))}
                  className="group inline-flex min-h-11 items-center gap-2 rounded-full bg-muted px-4 text-sm font-medium text-foreground transition-colors duration-150 hover:bg-[hsl(var(--brand-subtle))] hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring active:scale-[0.98]"
                >
                  {TOOL_LABELS[id] ?? id}
                  <ArrowRight className="size-3.5 text-muted-foreground transition-transform duration-150 ease-out group-hover:translate-x-0.5 group-hover:text-primary" aria-hidden="true" />
                </button>
              ))}
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

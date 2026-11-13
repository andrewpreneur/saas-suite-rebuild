import { useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ArrowRight, Check } from "lucide-react";
import GlassFolder, { type ArtPreset } from "@/components/premium/21st/glass-folder-cards";
import { DURATION, EASE_OUT } from "@/lib/motion";
import { useIsMobile } from "@/hooks/use-mobile";

export type TrainingFolderItem = {
  id: string;
  name: string;
  /** Short second line: a length, "Guided lesson", "Open". */
  meta?: string;
  done?: boolean;
};

export type TrainingFolder = {
  id: string;
  label: string;
  meta: string;
  art: ArtPreset;
  items: TrainingFolderItem[];
};

/**
 * A library as folders: one folder per group, one open at a time. Opening a
 * folder fans out what is inside, and lists the same things below at a size
 * that is easy to read and tap. Every folder and item is a real button, so the
 * whole thing works from the keyboard.
 */
export function TrainingFolders({
  folders,
  onSelect,
}: {
  folders: TrainingFolder[];
  onSelect: (folderId: string, itemId: string) => void;
}) {
  const isMobile = useIsMobile();
  const reduceMotion = useReducedMotion();
  const width = isMobile ? 216 : 192;
  const [openId, setOpenId] = useState<string | null>(null);
  const openFolder = folders.find((folder) => folder.id === openId) ?? null;

  const list = openFolder ? (
    <motion.div
      key={openFolder.id}
      initial={reduceMotion ? false : { opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -4 }}
      transition={{ duration: DURATION.base, ease: EASE_OUT }}
      className="px-surface overflow-hidden"
      role="group"
      aria-label={`In ${openFolder.label}`}
    >
      <p className="px-eyebrow px-4 pt-3 sm:px-5">{openFolder.label}</p>
      <ul className="divide-y divide-border/70">
        {openFolder.items.map((item) => (
          <li key={item.id}>
            <button
              type="button"
              onClick={() => onSelect(openFolder.id, item.id)}
              className="group flex min-h-14 w-full items-center gap-3 px-4 py-2.5 text-left transition-colors duration-150 hover:bg-[hsl(var(--brand-subtle))]/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring sm:px-5"
            >
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold text-foreground">{item.name}</span>
                {item.meta ? <span className="block truncate text-xs text-muted-foreground">{item.meta}</span> : null}
              </span>
              {item.done ? (
                <span className="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-success">
                  <Check className="size-3.5" aria-hidden="true" />
                  Watched
                </span>
              ) : null}
              <ArrowRight
                className="size-4 shrink-0 text-muted-foreground transition-transform duration-150 ease-out group-hover:translate-x-0.5"
                aria-hidden="true"
              />
            </button>
          </li>
        ))}
      </ul>
    </motion.div>
  ) : null;

  return (
    <div>
      <div className="grid grid-cols-1 justify-items-center gap-x-3 gap-y-4 sm:grid-cols-3 lg:grid-cols-5">
        {folders.map((folder, index) => (
          <div key={folder.id} className="flex w-full flex-col items-center gap-3">
            <GlassFolder
              label={folder.label}
              meta={folder.meta}
              art={folder.art}
              seed={index * 4 + 3}
              action="none"
              width={width}
              appear={!reduceMotion}
              appearDelay={index * 70}
              open={openId === folder.id}
              onOpenChange={(open) =>
                setOpenId((current) => (open ? folder.id : current === folder.id ? null : current))
              }
              files={folder.items.map((item) => ({ name: item.name, meta: item.meta }))}
              onFileSelect={(_file, at) => {
                const item = folder.items[at];
                if (item) onSelect(folder.id, item.id);
              }}
            />
            {/* On a phone the folders stack, so the open one lists its contents right under itself. */}
            {isMobile ? (
              <AnimatePresence initial={false}>
                {openId === folder.id ? <div className="w-full">{list}</div> : null}
              </AnimatePresence>
            ) : null}
          </div>
        ))}
      </div>
      {!isMobile ? (
        <div className="mt-5" aria-live="polite">
          <AnimatePresence mode="wait" initial={false}>
            {list}
          </AnimatePresence>
        </div>
      ) : null}
    </div>
  );
}

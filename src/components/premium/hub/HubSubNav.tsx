import type { ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import AnimatedTabs from "@/components/premium/21st/animated-tabs";
import { DURATION, EASE_OUT } from "@/lib/motion";

export interface HubSubNavItem {
  id: string;
  label: string;
  icon?: ReactNode;
  /** One short line: what this area controls. */
  hint: string;
}

/**
 * The single sub-navigation of Hub Pages. Tabs on top, and underneath one line
 * that says what the selected area controls, with that area's own actions on the right.
 */
export function HubSubNav({
  items,
  active,
  onChange,
  actions,
  editing,
}: {
  items: HubSubNavItem[];
  active: string;
  onChange: (id: string) => void;
  actions?: ReactNode;
  /** Replaces the hint line (used for the inline "rename this page" field). */
  editing?: ReactNode;
}) {
  const current = items.find((i) => i.id === active) ?? items[0];
  return (
    <div className="min-w-0 space-y-3">
      <div className="-mx-4 overflow-x-auto px-4 [scrollbar-width:none] sm:mx-0 sm:px-0 [&::-webkit-scrollbar]:hidden">
        <AnimatedTabs
          variant="underline"
          layoutId="hub-pages-subnav"
          className="min-w-full whitespace-nowrap"
          tabs={items.map(({ id, label, icon }) => ({ id, label, icon }))}
          activeTab={current?.id}
          onChange={onChange}
        />
      </div>
      <div className="flex min-h-9 flex-wrap items-center justify-between gap-x-4 gap-y-2">
        {editing ?? (
          <AnimatePresence mode="wait" initial={false}>
            <motion.p
              key={current?.id}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: DURATION.base, ease: EASE_OUT }}
              className="min-w-0 flex-1 basis-64 text-sm text-muted-foreground"
            >
              {current?.hint}
            </motion.p>
          </AnimatePresence>
        )}
        {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
      </div>
    </div>
  );
}

import * as React from "react";
import * as TabsPrimitive from "@radix-ui/react-tabs";
import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

export type LineTabItem = {
  value: string;
  label: string;
  icon?: LucideIcon;
  count?: number;
  disabled?: boolean;
};

export interface LineTabsProps extends Omit<
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Root>,
  "children"
> {
  items: LineTabItem[];
  /** Names the tab strip for screen readers, e.g. "Client". */
  label: string;
  children: React.ReactNode;
  listClassName?: string;
}

// Design system v0.1 line tabs: 1px gray rule with a 3px purple bar under the selected tab.
// The strip scrolls sideways on phones instead of wrapping. Use LineTabsContent for each panel.
export function LineTabs({ items, label, children, listClassName, ...rootProps }: LineTabsProps) {
  return (
    <TabsPrimitive.Root {...rootProps}>
      <TabsPrimitive.List
        aria-label={label}
        className={cn(
          "flex gap-6 overflow-x-auto bg-[linear-gradient(hsl(var(--border)),hsl(var(--border)))] bg-[length:100%_1px] bg-[position:0_calc(100%-1px)] bg-no-repeat",
          listClassName,
        )}
      >
        {items.map(({ value, label: itemLabel, icon: Icon, count, disabled }) => (
          <TabsPrimitive.Trigger
            key={value}
            value={value}
            disabled={disabled}
            className="relative inline-flex h-12 shrink-0 items-center gap-2 whitespace-nowrap rounded-t-sm px-0.5 text-sm font-medium text-gray-500 after:absolute after:inset-x-0 after:bottom-0 after:h-[3px] after:rounded-full hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring disabled:cursor-not-allowed disabled:text-gray-400 disabled:hover:text-gray-400 data-[state=active]:font-semibold data-[state=active]:text-foreground data-[state=active]:after:bg-brand"
          >
            {Icon && <Icon className="size-4" aria-hidden="true" />}
            {itemLabel}
            {count ? (
              <span className="inline-grid h-[18px] min-w-[18px] place-items-center rounded-full bg-brand px-1.5 text-[11px] font-semibold text-white">
                {count}
                <span className="sr-only"> need attention</span>
              </span>
            ) : null}
          </TabsPrimitive.Trigger>
        ))}
      </TabsPrimitive.List>
      {children}
    </TabsPrimitive.Root>
  );
}

export const LineTabsContent = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Content>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Content
    ref={ref}
    className={cn("pt-6 focus-visible:outline-none", className)}
    {...props}
  />
));
LineTabsContent.displayName = "LineTabsContent";

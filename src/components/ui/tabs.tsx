import * as React from "react";
import * as TabsPrimitive from "@radix-ui/react-tabs";

import { motion } from "framer-motion";

import { cn } from "@/lib/utils";
import { SPRING_SNAPPY } from "@/lib/motion";

/**
 * Tabs with a brand bar that slides to the selected tab (sliding-indicator idea
 * from 21st.dev "Animated Tabs"). The root tracks the current value so each
 * trigger knows whether to render the shared indicator.
 */
const TabsValueContext = React.createContext<{ value?: string; id: string }>({ id: "tabs" });

const Tabs = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Root>
>(({ value, defaultValue, onValueChange, ...props }, ref) => {
  const [inner, setInner] = React.useState(defaultValue);
  const id = React.useId();
  const current = value ?? inner;
  return (
    <TabsValueContext.Provider value={{ value: current, id }}>
      <TabsPrimitive.Root
        ref={ref}
        value={value}
        defaultValue={defaultValue}
        onValueChange={(next) => {
          setInner(next);
          onValueChange?.(next);
        }}
        {...props}
      />
    </TabsValueContext.Provider>
  );
});
Tabs.displayName = TabsPrimitive.Root.displayName;

const TabsList = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.List>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.List>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.List
    ref={ref}
    className={cn(
      "flex h-auto max-w-full items-center justify-start gap-6 overflow-x-auto bg-[linear-gradient(hsl(var(--border)),hsl(var(--border)))] bg-[length:100%_1px] bg-[position:0_calc(100%-1px)] bg-no-repeat text-gray-500",
      className,
    )}
    {...props}
  />
));
TabsList.displayName = TabsPrimitive.List.displayName;

const TabsTrigger = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>
>(({ className, children, value, ...props }, ref) => {
  const tabs = React.useContext(TabsValueContext);
  const selected = tabs.value === value;
  return (
  <TabsPrimitive.Trigger
    ref={ref}
    value={value}
    className={cn(
      "relative inline-flex h-12 shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-t-sm px-0.5 text-sm font-medium text-gray-500 cursor-pointer transition-colors after:absolute after:inset-x-0 after:bottom-0 after:h-[3px] after:rounded-full hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring disabled:cursor-not-allowed disabled:text-gray-400 disabled:hover:text-gray-400 data-[state=active]:font-semibold data-[state=active]:text-foreground",
      className,
    )}
    {...props}
  >
    {children}
    {selected ? (
      <motion.span
        layoutId={`tabs-indicator-${tabs.id}`}
        aria-hidden="true"
        transition={SPRING_SNAPPY}
        className="tabs-indicator absolute inset-x-0 bottom-0 h-[3px] rounded-full bg-brand"
      />
    ) : null}
  </TabsPrimitive.Trigger>
  );
});
TabsTrigger.displayName = TabsPrimitive.Trigger.displayName;

const TabsContent = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Content>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Content
    ref={ref}
    className={cn(
      "mt-4 ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
      className,
    )}
    {...props}
  />
));
TabsContent.displayName = TabsPrimitive.Content.displayName;

export { Tabs, TabsList, TabsTrigger, TabsContent };

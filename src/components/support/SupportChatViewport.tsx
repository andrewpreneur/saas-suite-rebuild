import { forwardRef, type ComponentPropsWithoutRef } from "react";
import { cn } from "@/lib/utils";

/** Long messages must scroll inside, not size, the chat window. */
export const SupportChatViewport = forwardRef<HTMLDivElement, ComponentPropsWithoutRef<"div">>(
  ({ className, children, ...props }, ref) => (
    <div ref={ref} role="log" aria-label="Conversation messages" tabIndex={0}
      className={cn("min-h-0 min-w-0 max-w-full overflow-y-auto overscroll-contain [overflow-wrap:anywhere]", className)} {...props}>
      {children}
    </div>
  ),
);
SupportChatViewport.displayName = "SupportChatViewport";

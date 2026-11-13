import { cn } from "@/lib/utils";

/** Loading placeholder in the shape of the real content. Uses the shared shimmer. */
function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div aria-hidden="true" className={cn("px-skeleton", className)} {...props} />;
}

export { Skeleton };

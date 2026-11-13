import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

// Design system v0.1 status tag. The label always says the status; color is never the only signal.
export const tagVariants = cva(
  "inline-flex h-6 items-center gap-1 rounded-full border px-2.5 text-xs font-semibold [&_svg]:size-3.5",
  {
    variants: {
      tone: {
        neutral: "border-gray-700 bg-gray-50 text-gray-700",
        brand: "border-brand bg-brand-subtle text-brand",
        success: "border-success bg-green-50 text-success",
        warning: "border-warning bg-amber-50 text-warning",
        danger: "border-destructive bg-red-50 text-red-700",
        info: "border-info bg-blue-50 text-info",
      },
    },
    defaultVariants: { tone: "neutral" },
  },
);

export interface TagProps
  extends React.HTMLAttributes<HTMLSpanElement>, VariantProps<typeof tagVariants> {}

export function Tag({ tone, className, ...props }: TagProps) {
  return <span className={cn(tagVariants({ tone }), className)} {...props} />;
}

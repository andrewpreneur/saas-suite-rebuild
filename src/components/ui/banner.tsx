import * as React from "react";
import {
  CircleAlert,
  CircleCheck,
  Info,
  MessageSquare,
  TriangleAlert,
  X,
  type LucideIcon,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type BannerTone = "info" | "success" | "warning" | "error" | "brand";

const tones: Record<
  BannerTone,
  { box: string; icon: LucideIcon; iconCls: string; role: "status" | "alert" }
> = {
  info: { box: "border-info bg-blue-50", icon: Info, iconCls: "text-info", role: "status" },
  success: {
    box: "border-success bg-green-50",
    icon: CircleCheck,
    iconCls: "text-success",
    role: "status",
  },
  warning: {
    box: "border-warning bg-amber-50",
    icon: TriangleAlert,
    iconCls: "text-warning",
    role: "status",
  },
  error: {
    box: "border-destructive bg-red-50",
    icon: CircleAlert,
    iconCls: "text-destructive",
    role: "alert",
  },
  brand: {
    box: "border-brand bg-brand-subtle",
    icon: MessageSquare,
    iconCls: "text-brand",
    role: "status",
  },
};

export interface BannerProps {
  tone?: BannerTone;
  title: React.ReactNode;
  children?: React.ReactNode;
  action?: React.ReactNode;
  onDismiss?: () => void;
  className?: string;
}

// Design system v0.1 banner. Banners never auto-dismiss; only "error" interrupts screen readers.
export function Banner({
  tone = "info",
  title,
  children,
  action,
  onDismiss,
  className,
}: BannerProps) {
  const t = tones[tone];
  const Icon = t.icon;
  return (
    <div
      role={t.role}
      className={cn("flex items-start gap-3 rounded-lg border p-4", t.box, className)}
    >
      <span className="flex h-[22px] shrink-0 items-center" aria-hidden="true">
        <Icon className={cn("size-5", t.iconCls)} />
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-2 sm:flex-row sm:items-start sm:gap-4">
        <p className="flex-1 text-sm leading-[22px] text-foreground">
          <strong className="font-semibold">{title}</strong> {children}
        </p>
        {action && <div className="sm:-my-[5px]">{action}</div>}
      </div>
      {onDismiss && (
        <Button
          variant="ghost"
          size="icon"
          className="-my-2 -mr-2"
          aria-label="Dismiss"
          onClick={onDismiss}
        >
          <X aria-hidden="true" />
        </Button>
      )}
    </div>
  );
}

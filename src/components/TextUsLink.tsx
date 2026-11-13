import { MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SUPPORT_SMS_HREF, supportSmsUrl } from "@/lib/supportContact";
import { cn } from "@/lib/utils";

type ButtonVariant = "default" | "outline" | "ghost" | "secondary" | "link";

/** Text Us control. The phone number stays inside the sms: href. */
export function TextUsLink({
  message,
  className,
  children = "Text Us",
  variant = "outline",
  size = "sm",
  icon = true,
}: {
  message?: string;
  className?: string;
  children?: React.ReactNode;
  /** "inline" is a text link for sentences. Other values use the shared button styles. */
  variant?: ButtonVariant | "inline";
  size?: "sm" | "default" | "lg";
  icon?: boolean;
}) {
  const href = message ? supportSmsUrl(message) : SUPPORT_SMS_HREF;
  const content = (
    <>
      {icon ? <MessageCircle className="h-4 w-4" aria-hidden="true" /> : null}
      {children}
    </>
  );
  if (variant === "inline") {
    return (
      <a
        href={href}
        aria-label="Text us"
        className={cn("inline-flex min-h-11 min-w-11 items-center gap-1.5 font-semibold hover:underline", className)}
      >
        {content}
      </a>
    );
  }
  return (
    <Button asChild variant={variant} size={size} className={cn("min-h-11 min-w-11", className)}>
      <a href={href} aria-label="Text us">
        {content}
      </a>
    </Button>
  );
}

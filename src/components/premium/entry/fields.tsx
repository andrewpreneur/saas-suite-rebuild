import * as React from "react";
import { CircleAlert, CircleCheck, Eye, EyeOff, Info } from "lucide-react";

import { Button, type ButtonProps } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";

/** 44px on every screen size: the entry pages are thumb-first. */
export const ENTRY_CONTROL = "h-11 sm:h-11";

/** Turns terse auth errors into a sentence that says what to do next. Unknown messages pass through. */
export function friendlyAuthError(message: string): string {
  const text = (message || "").trim();
  if (!text) return text;
  if (/invalid login credentials/i.test(text)) return "That password doesn't match this email. Try again, or reset your password.";
  if (/email not confirmed/i.test(text)) return "Confirm your email first. Open the link we sent you, then sign in.";
  if (/rate limit|too many/i.test(text)) return "Too many attempts. Wait a minute, then try again.";
  if (/error checking (account|user) status|could not reach the account service/i.test(text))
    return "We couldn't check that email just now. Wait a moment and try again, or continue with Google or Apple.";
  if (/failed to fetch|network/i.test(text)) return "We couldn't reach the server. Check your connection and try again.";
  return text;
}

/** Inline message under a field or above the action. Icon + text, never color alone. */
export function FormMessage({
  tone = "error",
  children,
  className,
  id,
}: {
  tone?: "error" | "success" | "info";
  children: React.ReactNode;
  className?: string;
  id?: string;
}) {
  if (!children) return null;
  const Icon = tone === "error" ? CircleAlert : tone === "success" ? CircleCheck : Info;
  return (
    <p
      id={id}
      role={tone === "error" ? "alert" : "status"}
      className={cn(
        "flex items-start gap-2 rounded-md border px-3 py-2 text-small",
        tone === "error" && "border-destructive/30 bg-destructive/5 text-destructive",
        tone === "success" && "border-success/30 bg-success/5 text-foreground",
        tone === "info" && "border-border bg-muted/60 text-muted-foreground",
        className,
      )}
    >
      <Icon
        aria-hidden="true"
        className={cn("mt-0.5 size-4 shrink-0", tone === "success" && "text-success", tone === "info" && "text-brand")}
      />
      <span className="min-w-0 flex-1 text-left">{children}</span>
    </p>
  );
}

interface FieldProps extends React.ComponentProps<"input"> {
  label: string;
  hint?: React.ReactNode;
  /** Sits on the label row, right side (for example "Forgot password?"). */
  labelAction?: React.ReactNode;
  /** Sits inside the input, right side. */
  trailing?: React.ReactNode;
}

/** Label above, 44px input, optional hint. */
export const Field = React.forwardRef<HTMLInputElement, FieldProps>(
  ({ label, hint, labelAction, trailing, id, className, ...props }, ref) => {
    const autoId = React.useId();
    const inputId = id ?? autoId;
    return (
      <div className="flex flex-col gap-1.5 text-left">
        <div className="flex items-center justify-between gap-3">
          <label htmlFor={inputId} className="text-small font-medium text-foreground">
            {label}
          </label>
          {labelAction}
        </div>
        <div className="relative">
          <Input
            ref={ref}
            id={inputId}
            aria-describedby={hint ? `${inputId}-hint` : undefined}
            className={cn(ENTRY_CONTROL, "bg-card", trailing && "pr-12", className)}
            {...props}
          />
          {trailing ? <div className="absolute inset-y-0 right-0 flex items-center pr-1">{trailing}</div> : null}
        </div>
        {hint ? (
          <p id={`${inputId}-hint`} className="text-caption font-normal text-muted-foreground">
            {hint}
          </p>
        ) : null}
      </div>
    );
  },
);
Field.displayName = "Field";

interface PasswordFieldProps extends Omit<FieldProps, "type" | "trailing"> {
  visible: boolean;
  onToggleVisible: () => void;
}

/** Password input with a show/hide toggle that has a real accessible name. */
export const PasswordField = React.forwardRef<HTMLInputElement, PasswordFieldProps>(
  ({ visible, onToggleVisible, disabled, ...props }, ref) => (
    <Field
      ref={ref}
      type={visible ? "text" : "password"}
      disabled={disabled}
      trailing={
        <button
          type="button"
          onClick={onToggleVisible}
          disabled={disabled}
          aria-label={visible ? "Hide password" : "Show password"}
          aria-pressed={visible}
          className="flex size-9 items-center justify-center rounded-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
        >
          {visible ? <EyeOff className="size-4" aria-hidden="true" /> : <Eye className="size-4" aria-hidden="true" />}
        </button>
      }
      {...props}
    />
  ),
);
PasswordField.displayName = "PasswordField";

interface SubmitButtonProps extends ButtonProps {
  loading?: boolean;
  /** Shown beside the spinner while loading. */
  loadingLabel?: string;
}

/** The view's one accent action. The loading state lives inside the button. */
export const SubmitButton = React.forwardRef<HTMLButtonElement, SubmitButtonProps>(
  ({ loading, loadingLabel, children, className, variant = "accent", disabled, ...props }, ref) => (
    <Button
      ref={ref}
      variant={variant}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cn(ENTRY_CONTROL, "w-full", className)}
      {...props}
    >
      {loading ? (
        <>
          <Spinner aria-hidden="true" />
          {loadingLabel ?? children}
        </>
      ) : (
        children
      )}
    </Button>
  ),
);
SubmitButton.displayName = "SubmitButton";

/** "or" rule between the email form and the social buttons. */
export function OrDivider({ label = "or" }: { label?: string }) {
  return (
    <div className="flex items-center gap-3" role="separator" aria-label={label}>
      <span className="h-px flex-1 bg-border" />
      <span className="text-caption uppercase tracking-wide text-muted-foreground">{label}</span>
      <span className="h-px flex-1 bg-border" />
    </div>
  );
}

/** Read-only summary of the email being used, with a way back to change it. */
export function EmailSummary({ email, onChange, changeLabel = "Change" }: { email: string; onChange: () => void; changeLabel?: string }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-md border border-border bg-muted/50 px-3 py-2 text-left">
      <div className="min-w-0">
        <p className="text-caption font-normal text-muted-foreground">Email</p>
        <p className="truncate text-small font-medium text-foreground">{email}</p>
      </div>
      <Button type="button" variant="ghost" size="sm" onClick={onChange} className="shrink-0 text-brand hover:text-brand-hover">
        {changeLabel}
      </Button>
    </div>
  );
}

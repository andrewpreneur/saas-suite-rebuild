import * as React from "react";
import { CircleAlert } from "lucide-react";

import { cn } from "@/lib/utils";

export interface TextFieldProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  hint?: string;
  error?: string;
}

// Design system v0.1 text field: always-visible label, hint and error linked for screen readers.
export const TextField = React.forwardRef<HTMLInputElement, TextFieldProps>(
  ({ label, hint, error, required, className, id: idProp, ...props }, ref) => {
    const autoId = React.useId();
    const id = idProp ?? autoId;
    const describedBy = error ? `${id}-error` : hint ? `${id}-hint` : undefined;

    return (
      <div className="flex flex-col gap-1.5">
        <label htmlFor={id} className="text-sm font-medium text-foreground">
          {label}
          {required && (
            <span aria-hidden="true" className="text-destructive">
              {" "}
              *
            </span>
          )}
        </label>
        <input
          ref={ref}
          id={id}
          required={required}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          className={cn(
            "h-11 w-full rounded-md border border-input bg-card px-3 text-base text-foreground sm:h-10 sm:text-sm",
            "placeholder:text-muted-foreground",
            "focus-visible:border-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
            "disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground",
            "aria-[invalid=true]:border-destructive",
            className,
          )}
          {...props}
        />
        {hint && !error && (
          <p id={`${id}-hint`} className="text-sm text-muted-foreground">
            {hint}
          </p>
        )}
        <div aria-live="polite">
          {error && (
            <p
              id={`${id}-error`}
              className="flex items-center gap-1.5 text-sm font-medium text-destructive"
            >
              <CircleAlert className="size-4 shrink-0" aria-hidden="true" />
              {error}
            </p>
          )}
        </div>
      </div>
    );
  },
);
TextField.displayName = "TextField";

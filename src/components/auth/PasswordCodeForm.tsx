import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { requestPasswordCode, submitPasswordCode } from "@/lib/authAccount";
import { attachKitPurchases } from "@/lib/kitPurchases";
import { Button } from "@/components/ui/button";
import { Field, FormMessage, PasswordField, SubmitButton } from "@/components/premium/entry/fields";
import { TextShimmer } from "@/components/premium/21st/text-shimmer";

export function PasswordCodeForm({
  email,
  nextPath,
  onSuccess,
}: {
  email: string;
  nextPath: string | null;
  onSuccess: () => void;
}) {
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [sending, setSending] = useState(true);
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    setSending(true);
    setSent(false);
    setError("");
    void requestPasswordCode(email, nextPath)
      .then((result) => {
        if (cancelled) return;
        if (result.status === "sent") {
          setSent(true);
          return;
        }
        setError(typeof result.error === "string"
          ? result.error
          : "We couldn't email a code. Use the sign-in link from your kit email, or try again.");
      })
      .catch((reason: unknown) => {
        if (!cancelled) setError(reason instanceof Error ? reason.message : "We couldn't email a code.");
      })
      .finally(() => {
        if (!cancelled) setSending(false);
      });
    return () => {
      cancelled = true;
    };
  }, [email, nextPath]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (code.trim().length !== 6 || password.length < 6) {
      setError("Enter the 6-digit code and a password of at least 6 characters.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const result = await submitPasswordCode(email, code.trim(), password);
      if (result.status !== "password_set") {
        setError(typeof result.error === "string" ? result.error : "That code didn't work. Request a new one and try again.");
        return;
      }
      const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
      if (signInError) {
        setError("Your password is saved. Sign in with it to open the kit.");
        return;
      }
      void attachKitPurchases();
      onSuccess();
    } catch (reason: unknown) {
      setError(reason instanceof Error ? reason.message : "Could not set your password. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4" data-testid="password-code-form">
      <FormMessage tone={sent ? "success" : "info"}>
        {sending ? (
          <TextShimmer as="span" className="text-small">Sending a one-time code...</TextShimmer>
        ) : sent ? (
          `Enter the code we emailed to ${email}.`
        ) : (
          "Request a new code, or open the sign-in link from your kit email."
        )}
      </FormMessage>
      <Field
        id="password-code"
        label="One-time code"
        inputMode="numeric"
        autoComplete="one-time-code"
        value={code}
        onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
        placeholder="6-digit code"
        required
        className="font-mono tracking-[0.3em] placeholder:font-sans placeholder:tracking-normal"
      />
      <PasswordField
        id="new-password"
        label="Password"
        autoComplete="new-password"
        visible={showPassword}
        onToggleVisible={() => setShowPassword((current) => !current)}
        value={password}
        onChange={(event) => setPassword(event.target.value)}
        required
        minLength={6}
        placeholder="At least 6 characters"
        hint="Use 6 or more characters."
        autoFocus
      />
      {error && <FormMessage>{error}</FormMessage>}
      <SubmitButton type="submit" loading={loading} loadingLabel="Setting your password" disabled={sending}>
        Set password
      </SubmitButton>
      <Button
        type="button"
        variant="ghost"
        className="h-11 w-full text-muted-foreground hover:text-foreground"
        disabled={sending}
        onClick={() => {
          setSending(true);
          setError("");
          void requestPasswordCode(email, nextPath)
            .then((result) => {
              if (result.status === "sent") {
                setSent(true);
                setError("");
                return;
              }
              setError(typeof result.error === "string" ? result.error : "We couldn't email a new code.");
            })
            .catch((reason: unknown) => {
              setError(reason instanceof Error ? reason.message : "We couldn't email a new code.");
            })
            .finally(() => setSending(false));
        }}
      >
        Email me a new code
      </Button>
    </form>
  );
}

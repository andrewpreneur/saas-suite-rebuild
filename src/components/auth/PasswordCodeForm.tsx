import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { requestPasswordCode, submitPasswordCode } from "@/lib/authAccount";
import { attachKitPurchases } from "@/lib/kitPurchases";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Eye, EyeOff } from "lucide-react";

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
      <Alert>
        <AlertDescription>
          {sending
            ? "Sending a one-time code..."
            : sent
              ? `Enter the code we emailed to ${email}.`
              : "Request a new code, or open the sign-in link from your kit email."}
        </AlertDescription>
      </Alert>
      <div className="space-y-2">
        <Label htmlFor="password-code">One-time code</Label>
        <Input
          id="password-code"
          inputMode="numeric"
          autoComplete="one-time-code"
          value={code}
          onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
          placeholder="6-digit code"
          required
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="new-password">Password</Label>
        <div className="relative">
          <Input
            id="new-password"
            type={showPassword ? "text" : "password"}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
            minLength={6}
            placeholder="Create a password (minimum 6 characters)"
            autoFocus
            className="pr-16"
          />
          <button
            type="button"
            onClick={() => setShowPassword((current) => !current)}
            className="absolute inset-y-0 right-0 flex items-center px-3 text-xs font-medium text-muted-foreground hover:text-foreground"
            aria-label={showPassword ? "Hide password" : "Show password"}
          >
            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
      </div>
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      <Button type="submit" className="w-full" disabled={loading || sending}>
        {loading ? "Setting password..." : "Set password"}
      </Button>
      <Button
        type="button"
        variant="outline"
        className="w-full"
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

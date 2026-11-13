import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { EntryShell } from "@/components/premium/entry/EntryShell";
import { FormMessage, PasswordField, SubmitButton, friendlyAuthError } from "@/components/premium/entry/fields";
import { markSkipOnboarding, readNextPath } from "@/utils/deepLink";
import { isKitDeepLink } from "@/lib/kitLoginFlow";

function keepResetQuery() {
  const params = new URLSearchParams(window.location.search);
  params.delete("code");
  const query = params.toString();
  window.history.replaceState({}, document.title, `${window.location.pathname}${query ? `?${query}` : ""}`);
}

const ResetPassword = () => {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [verifying, setVerifying] = useState(true);
  const [valid, setValid] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    let isMounted = true;

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!isMounted) return;
      if (event === 'PASSWORD_RECOVERY' || event === 'SIGNED_IN') {
        setError("");
        setValid(!!session);
      }
    });

    const init = async () => {
      try {
        // Handle PKCE flow (query param with code)
        const urlParams = new URLSearchParams(window.location.search);
        const code = urlParams.get("code");

        if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) throw error;
          keepResetQuery();
          setValid(true);
        } else {
          // Handle implicit flow (hash fragment)
          const hash = window.location.hash || "";
          const hashParams = new URLSearchParams(hash.replace(/^#/, ""));
          const type = hashParams.get("type");
          const access_token = hashParams.get("access_token");
          const refresh_token = hashParams.get("refresh_token");

          if (type === "recovery" && access_token && refresh_token) {
            const { error } = await supabase.auth.setSession({ access_token, refresh_token });
            if (error) throw error;
            keepResetQuery();
            setValid(true);
          } else {
            const { data: { session } } = await supabase.auth.getSession();
            if (session) {
              setValid(true);
            } else {
              setError("Invalid or expired password reset link. Please request a new one.");
            }
          }
        }
      } catch (e: any) {
        setError(e.message || "Could not verify reset link.");
      } finally {
        if (isMounted) setVerifying(false);
      }
    };

    init();

    return () => {
      isMounted = false;
      subscription?.unsubscribe();
    };
  }, []);

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (password !== confirmPassword) {
      setError("Passwords don't match");
      return;
    }

    if (password.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }

    setLoading(true);

    try {
      const { error } = await supabase.auth.updateUser({
        password: password
      });

      if (error) throw error;

      toast({
        title: "Password updated!",
        description: "Your password has been successfully reset.",
      });

      const next = readNextPath();
      if (isKitDeepLink(next)) markSkipOnboarding();
      setTimeout(() => {
        navigate(next || "/login");
      }, 800);
    } catch (error: any) {
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  const mismatch = /match/i.test(error);

  return (
    <EntryShell
      title={verifying ? "Checking your link" : valid ? "Choose a new password" : "This link has expired"}
      description={
        verifying
          ? "One moment while we verify your reset link."
          : valid
            ? "Pick something you haven't used before."
            : "Reset links work once and expire after a short time."
      }
      footer={
        <button
          type="button"
          onClick={() => navigate("/login")}
          className="font-semibold text-brand underline-offset-4 hover:text-brand-hover hover:underline"
        >
          Back to sign in
        </button>
      }
    >
      {verifying ? (
        <div className="space-y-3" role="status" aria-label="Verifying reset link">
          <div className="px-skeleton h-11 rounded-md" />
          <div className="px-skeleton h-11 rounded-md" />
          <div className="px-skeleton h-11 rounded-md" />
        </div>
      ) : valid ? (
        <form onSubmit={handleResetPassword} className="space-y-4">
          <PasswordField
            id="password"
            label="New password"
            autoComplete="new-password"
            autoFocus
            visible={showPassword}
            onToggleVisible={() => setShowPassword(!showPassword)}
            placeholder="At least 6 characters"
            hint="Use 6 or more characters."
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            disabled={loading}
          />
          <PasswordField
            id="confirmPassword"
            label="Confirm new password"
            autoComplete="new-password"
            visible={showConfirmPassword}
            onToggleVisible={() => setShowConfirmPassword(!showConfirmPassword)}
            placeholder="Type it again"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
            disabled={loading}
            aria-invalid={mismatch ? true : undefined}
          />
          {error && (
            <FormMessage>
              {mismatch
                ? "The two passwords don't match. Type the same password in both fields."
                : /at least 6/i.test(error)
                  ? "That password is too short. Use 6 or more characters."
                  : friendlyAuthError(error)}
            </FormMessage>
          )}
          <SubmitButton type="submit" loading={loading} loadingLabel="Saving your password">
            Save new password
          </SubmitButton>
        </form>
      ) : (
        <div className="space-y-4">
          <FormMessage>
            {error || "Invalid or expired password reset link. Please request a new one."} Go back to sign in, enter your
            email and choose "Forgot password?" to get a fresh link.
          </FormMessage>
          <SubmitButton type="button" onClick={() => navigate("/login")}>
            Request a new link
          </SubmitButton>
        </div>
      )}
    </EntryShell>
  );
};

export default ResetPassword;

import { useEffect, useRef, useState } from "react";
import { ExternalLink } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { normalizeKitLandingPageUrl } from "@/lib/kitTracker";

const saveActionClass =
  "inline-flex h-12 w-full items-center justify-center rounded-md bg-success px-6 text-base font-semibold text-white shadow-sm hover:bg-success focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-success focus-visible:ring-offset-2 disabled:opacity-60 sm:w-auto";

const quietLinkClass =
  "text-sm font-medium text-brand underline decoration-brand/40 underline-offset-4 hover:text-brand-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand";

export function KitLandingPageField({
  savedUrl,
  onSaved,
}: {
  savedUrl: string | null;
  onSaved?: (url: string) => void;
}) {
  const [url, setUrl] = useState<string | null>(savedUrl);
  const [draft, setDraft] = useState(savedUrl ?? "");
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const onSavedRef = useRef(onSaved);
  onSavedRef.current = onSaved;

  useEffect(() => {
    if (!savedUrl) return;
    setUrl((current) => current ?? savedUrl);
    setDraft((current) => (current.trim() ? current : savedUrl));
  }, [savedUrl]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const { data: authData, error: authError } = await supabase.auth.getUser();
      const user = authData.user;
      if (cancelled || authError || !user) return;
      const { data, error } = await supabase
        .from("kit_landing_pages")
        .select("url")
        .eq("user_id", user.id)
        .maybeSingle();
      if (cancelled || error) return;
      const loaded = typeof data?.url === "string" ? data.url.trim() : "";
      if (!loaded) return;
      setUrl((current) => current ?? loaded);
      setDraft((current) => (current.trim() ? current : loaded));
      onSavedRef.current?.(loaded);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const safeUrl = url ? normalizeKitLandingPageUrl(url) : null;

  const save = async () => {
    const normalized = normalizeKitLandingPageUrl(draft);
    if (!normalized) {
      toast({
        title: "Enter a valid landing page link",
        description:
          "That doesn't look like a web address. Try something like example.com/your-offer.",
        variant: "destructive",
      });
      return;
    }
    setSaving(true);
    try {
      const { data: authData, error: authError } = await supabase.auth.getUser();
      const user = authData.user;
      if (authError || !user) {
        toast({
          title: "Sign in to save your landing page",
          description: "Your landing page is stored on this account.",
          variant: "destructive",
        });
        return;
      }
      const email = user.email?.trim().toLowerCase() || null;
      const { error } = await supabase.from("kit_landing_pages").upsert(
        {
          user_id: user.id,
          email,
          url: normalized,
        },
        { onConflict: "user_id" },
      );
      if (error) {
        toast({
          title: "Could not save that link",
          description: error.message,
          variant: "destructive",
        });
        return;
      }
      setUrl(normalized);
      setDraft(normalized);
      setEditing(false);
      onSavedRef.current?.(normalized);
      toast({
        title: "Landing page saved",
        description: "This page is saved on your account.",
      });
    } finally {
      setSaving(false);
    }
  };

  const labelClass = "text-sm font-medium text-foreground";

  return (
    <div className="space-y-2 border-t border-border pt-4" data-testid="kit-landing-page">
      {safeUrl && !editing ? (
        <>
          <p className={labelClass}>Your landing page for selling this offer</p>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <a
              href={safeUrl}
              target="_blank"
              rel="noreferrer"
              data-testid="kit-landing-page-link"
              className={`${quietLinkClass} inline-flex items-center gap-1 break-all`}
            >
              {safeUrl}
              <ExternalLink className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            </a>
            <button
              type="button"
              className={quietLinkClass}
              data-testid="kit-landing-page-edit"
              onClick={() => {
                setDraft(safeUrl);
                setEditing(true);
              }}
            >
              Edit
            </button>
          </div>
        </>
      ) : (
        <form
          className="flex flex-col items-start gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            void save();
          }}
        >
          <Label htmlFor="kit-landing-page-url" className={labelClass}>
            Your landing page for selling this offer
          </Label>
          <Input
            id="kit-landing-page-url"
            name="landingPage"
            type="text"
            inputMode="url"
            autoCapitalize="off"
            autoCorrect="off"
            spellCheck={false}
            placeholder="https://example.com/your-offer"
            autoComplete="url"
            value={draft}
            disabled={saving}
            onChange={(event) => setDraft(event.target.value)}
            className="h-12 text-base"
          />
          <button type="submit" className={saveActionClass} disabled={saving}>
            {saving ? "Saving…" : "Save"}
          </button>
        </form>
      )}
    </div>
  );
}

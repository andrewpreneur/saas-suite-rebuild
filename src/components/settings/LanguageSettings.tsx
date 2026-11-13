import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useUser } from "@/contexts/UserContext";
import { useTeamAccess } from "@/hooks/useTeamAccess";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { LANGUAGE_OPTIONS, type SupportedLanguage } from "@/translations";
import { saveLanguagePreferences } from "@/lib/languagePreferences";
import { Button } from "@/components/ui/button";
import { Field, ToggleRow } from "@/components/premium/settings/Field";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export default function LanguageSettings() {
  const { language, setLanguage, t } = useLanguage();
  const { email } = useUser();
  const access = useTeamAccess();
  const { toast } = useToast();
  const [selected, setSelected] = useState<SupportedLanguage>(language);
  const [includeCustomers, setIncludeCustomers] = useState(false);
  const [customerLanguage, setCustomerLanguage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const canEditCustomers = access.loaded && access.level("settings") === "edit";

  useEffect(() => setSelected(language), [language]);
  useEffect(() => {
    let active = true;
    setCustomerLanguage(null);
    setIncludeCustomers(false);
    if (email) {
      void supabase.from("saas_suite_users").select("customer_language")
        .eq("email", email.trim().toLowerCase()).maybeSingle().then(({ data, error }) => {
          if (active && !error) setCustomerLanguage(data?.customer_language ?? null);
        });
    }
    return () => { active = false; };
  }, [email]);

  const save = async () => {
    if (saving || (includeCustomers && !canEditCustomers)) return;
    setSaving(true);
    try {
      await saveLanguagePreferences(selected, includeCustomers, setLanguage, async (next) => {
        if (!email) throw new Error("Sign in to save customer defaults.");
        const { error } = await supabase.rpc("set_customer_language", {
          p_owner_email: email.trim().toLowerCase(), p_language: next,
        });
        if (error) throw error;
        setCustomerLanguage(next);
      });
      toast({ title: t.common_success, description: includeCustomers ? "Your language and customer default saved." : "Your language saved. Customer defaults are unchanged." });
    } catch (error) {
      toast({ title: t.common_error, description: error instanceof Error ? error.message : "Could not save language. Please try again.", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const customerLabel = LANGUAGE_OPTIONS.find((option) => option.value === customerLanguage)?.label;

  return (
    <form
      className="space-y-5"
      aria-label="Language preferences"
      onSubmit={(event) => {
        event.preventDefault();
        void save();
      }}
    >
      <Field label={t.settings_language} htmlFor="settings-language">
        <Select value={selected} onValueChange={(value) => setSelected(value as SupportedLanguage)} disabled={saving}>
          <SelectTrigger id="settings-language" className="h-11 w-full sm:h-10 sm:w-72"><SelectValue /></SelectTrigger>
          <SelectContent>{LANGUAGE_OPTIONS.map((option) => (
            <SelectItem key={option.value} value={option.value}>{option.flag} {option.label}</SelectItem>
          ))}</SelectContent>
        </Select>
      </Field>
      <ToggleRow
        label="Also use it as the default for customers"
        htmlFor="language-customers"
        className="border-t border-border/70 pt-4"
        description={
          <span role="status">
            {customerLabel ? `Customer default is ${customerLabel}, pending Customer Hub activation.` : "The customer default is unavailable."}
          </span>
        }
      >
        <Switch id="language-customers" checked={includeCustomers} onCheckedChange={setIncludeCustomers} disabled={saving || !canEditCustomers || !customerLanguage} />
      </ToggleRow>
      <div className="flex justify-end border-t border-border/70 pt-4">
        <Button type="submit" variant="accent" className="h-11 w-full sm:h-10 sm:w-auto" disabled={saving}>
          {saving ? <><Loader2 className="animate-spin" aria-hidden="true" /> Saving language</> : "Save language"}
        </Button>
      </div>
    </form>
  );
}

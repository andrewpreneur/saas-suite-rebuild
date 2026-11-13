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
import { Field, SectionFooter, ToggleRow } from "@/components/premium/settings/Field";
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

  return (
    <section className="space-y-4" aria-label="Language preferences">
      <Field label={t.settings_language} htmlFor="settings-language" hint="The language you see across SaaSSuite.">
        <Select value={selected} onValueChange={(value) => setSelected(value as SupportedLanguage)} disabled={saving}>
          <SelectTrigger id="settings-language" className="h-11 w-full sm:h-10 sm:w-64"><SelectValue /></SelectTrigger>
          <SelectContent>{LANGUAGE_OPTIONS.map((option) => (
            <SelectItem key={option.value} value={option.value}>{option.flag} {option.label}</SelectItem>
          ))}</SelectContent>
        </Select>
      </Field>
      <ToggleRow
        label="Also set customer default"
        htmlFor="language-customers"
        description={
          <span role="status">
            Customer default: {LANGUAGE_OPTIONS.find((option) => option.value === customerLanguage)?.label ?? "Unavailable"}. Customer Hub activation pending.
          </span>
        }
      >
        <Switch id="language-customers" checked={includeCustomers} onCheckedChange={setIncludeCustomers} disabled={saving || !canEditCustomers || !customerLanguage} />
      </ToggleRow>
      <SectionFooter>
        <Button type="button" variant="accent" onClick={save} disabled={saving}>
          {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Save language
        </Button>
      </SectionFooter>
    </section>
  );
}

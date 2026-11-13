import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { CheckCircle2, Circle, ClipboardCheck, Copy } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useUser } from "@/contexts/UserContext";
import { buildHubUrl, fetchHubVersion } from "@/lib/hubUrl";
import { installSnippets } from "@/lib/installSnippets";

type Item = "menu" | "css" | "js";
const storeKey = (email: string) => `ss_install_checklist:${email}`;

/** Persistent top-bar checklist: menu link, one-line CSS, one-line JS. */
const InstallChecklistButton = () => {
  const { email } = useUser();
  const [open, setOpen] = useState(false);
  const [agencyId, setAgencyId] = useState<string | null>(null);
  const [hubUrl, setHubUrl] = useState("");
  const [done, setDone] = useState<Record<Item, boolean>>({ menu: false, css: false, js: false });

  useEffect(() => {
    if (!email) return;
    const clean = email.trim().toLowerCase();
    let saved: Partial<Record<Item, boolean>> = {};
    try {
      saved = JSON.parse(localStorage.getItem(storeKey(clean)) || "{}");
    } catch {
      /* ignore */
    }
    (async () => {
      const { data: user } = await supabase
        .from("saas_suite_users")
        .select("agency_id, install_confirmed_at")
        .ilike("email", clean)
        .maybeSingle();
      const id = (user as any)?.agency_id ?? null;
      setAgencyId(id);
      if (id) setHubUrl(buildHubUrl(id, await fetchHubVersion(id)));
      const { data: installed } = await supabase.rpc("is_hub_installed", { user_email: clean });
      let menu = false;
      if (id) {
        const { data: cfg } = await supabase
          .from("agency_menu_config")
          .select("menu_link_id")
          .eq("agency_id", id)
          .maybeSingle();
        menu = Boolean((cfg as any)?.menu_link_id);
      }
      const all = Boolean(installed) || Boolean((user as any)?.install_confirmed_at);
      setDone({
        menu: all || menu || !!saved.menu,
        css: all || !!saved.css,
        js: all || !!saved.js,
      });
    })();
  }, [email, open]);

  if (!email) return null;

  const toggle = (k: Item) => {
    setDone((prev) => {
      const next = { ...prev, [k]: !prev[k] };
      localStorage.setItem(storeKey(email.trim().toLowerCase()), JSON.stringify(next));
      return next;
    });
  };

  const copy = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Copied");
  };

  const { css, js } = installSnippets(agencyId);
  const count = Object.values(done).filter(Boolean).length;

  const openFullGuide = () => {
    setOpen(false);
    window.dispatchEvent(new CustomEvent("tipbot-select-tool", { detail: { tool: "client-hub" } }));
    window.setTimeout(() => window.dispatchEvent(new CustomEvent("open-installation-guide")), 600);
  };

  const steps: { key: Item; title: string; where: string; value: string }[] = [
    { key: "menu", title: "Custom menu link", where: "Agency view → Settings → Custom Menu Link. Paste this URL:", value: hubUrl || buildHubUrl(agencyId) },
    { key: "css", title: "Custom CSS (one line)", where: "Agency view → Settings → Company → White Label → Custom CSS:", value: css },
    { key: "js", title: "Custom JS (one line)", where: "Agency view → Settings → Company → White Label → Custom JS:", value: js },
  ];

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)} className="gap-2">
        <ClipboardCheck className="w-4 h-4" />
        Installation Checklist
        <span className="text-xs text-muted-foreground">{count}/3</span>
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Installation Checklist</DialogTitle>
            <DialogDescription>Three things to add in HighLevel. Do this on a computer.</DialogDescription>
          </DialogHeader>
          <ol className="space-y-4">
            {steps.map((s, i) => (
              <li key={s.key} className="rounded-lg border border-border p-3 space-y-2">
                <button type="button" onClick={() => toggle(s.key)} className="flex items-center gap-2 text-left w-full">
                  {done[s.key] ? (
                    <CheckCircle2 className="w-5 h-5 text-primary shrink-0" />
                  ) : (
                    <Circle className="w-5 h-5 text-muted-foreground shrink-0" />
                  )}
                  <span className="font-medium">
                    {i + 1}. {s.title}
                  </span>
                </button>
                <p className="text-xs text-muted-foreground">{s.where}</p>
                <div className="flex items-center gap-2 bg-muted p-2 rounded border border-border">
                  <code className="text-xs flex-1 break-all font-mono">{s.value}</code>
                  <Button variant="outline" size="sm" onClick={() => copy(s.value)} aria-label={`Copy ${s.title}`}>
                    <Copy className="w-4 h-4" />
                  </Button>
                </div>
              </li>
            ))}
          </ol>
          <Button variant="ghost" onClick={openFullGuide}>
            Open the full installation guide
          </Button>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default InstallChecklistButton;

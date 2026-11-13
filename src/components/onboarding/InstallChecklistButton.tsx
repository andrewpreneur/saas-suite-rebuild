import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ArrowRight } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { popIn, riseItem, staggerParent } from "@/lib/motion";
import { cn } from "@/lib/utils";
import { CheckDot, CopyField, ProgressRing } from "@/components/premium/onboarding/pieces";
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
    return true;
  };

  const { css, js } = installSnippets(agencyId);
  const count = Object.values(done).filter(Boolean).length;

  const openFullGuide = () => {
    setOpen(false);
    window.dispatchEvent(new CustomEvent("tipbot-select-tool", { detail: { tool: "client-hub" } }));
    window.setTimeout(() => window.dispatchEvent(new CustomEvent("open-installation-guide")), 600);
  };

  const steps: { key: Item; title: string; where: string; value: string }[] = [
    {
      key: "menu",
      title: "Custom menu link",
      where: "Agency view → Settings → Custom Menu Link. Paste this URL:",
      value: hubUrl || buildHubUrl(agencyId),
    },
    {
      key: "css",
      title: "Custom CSS (one line)",
      where: "Agency view → Settings → Company → White Label → Custom CSS:",
      value: css,
    },
    {
      key: "js",
      title: "Custom JS (one line)",
      where: "Agency view → Settings → Company → White Label → Custom JS:",
      value: js,
    },
  ];
  const allDone = count === steps.length;

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)} className="gap-2 pl-2">
        <ProgressRing value={count} total={3} size={22} stroke={3}>
          {""}
        </ProgressRing>
        Install checklist
        <span className="text-xs tabular-nums text-muted-foreground">{count}/3</span>
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
          <DialogHeader className="min-w-0">
            <div className="flex items-center gap-4 text-left">
              <ProgressRing value={count} total={3} size={56} />
              <div className="min-w-0">
                <DialogTitle>
                  {allDone ? "SaaSSuite is installed" : "Install SaaSSuite in HighLevel"}
                </DialogTitle>
                <DialogDescription>
                  {allDone
                    ? "All three are in place. Changes you make here now update on their own."
                    : "Three things to paste. Do this on a computer, it takes about 10 minutes."}
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>
          <motion.ol variants={staggerParent} initial="hidden" animate="show" className="min-w-0 space-y-3">
            {steps.map((s) => (
              <motion.li
                key={s.key}
                variants={riseItem}
                className={cn(
                  "min-w-0 rounded-lg border p-3 transition-colors duration-200",
                  done[s.key] ? "border-transparent bg-muted" : "border-border bg-card",
                )}
              >
                <button
                  type="button"
                  role="checkbox"
                  aria-checked={done[s.key]}
                  onClick={() => toggle(s.key)}
                  className="flex min-h-[2.75rem] w-full items-center gap-3 rounded-sm text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <CheckDot checked={done[s.key]} />
                  <span
                    className={cn(
                      "text-body font-medium transition-colors duration-200",
                      done[s.key] ? "text-muted-foreground line-through" : "text-foreground",
                    )}
                  >
                    {s.title}
                  </span>
                </button>
                <AnimatePresence initial={false}>
                  {!done[s.key] && (
                    <motion.div
                      key="body"
                      variants={popIn}
                      initial="hidden"
                      animate="show"
                      exit="exit"
                      className="min-w-0 space-y-2 pl-9 pt-1"
                    >
                      <p className="text-small text-muted-foreground">{s.where}</p>
                      <CopyField
                        value={s.value}
                        label={`Copy ${s.title}`}
                        onCopy={() => copy(s.value)}
                      />
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.li>
            ))}
          </motion.ol>
          <Button variant="ghost" onClick={openFullGuide}>
            Open the full installation guide
            <ArrowRight />
          </Button>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default InstallChecklistButton;

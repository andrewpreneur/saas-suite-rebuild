import { useEffect, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import type { GhlPlan } from "@/components/one-feature/shared";
import { GHL_AFFILIATE_SIGNUP_URL, GHL_UPGRADE_297_URL, GHL_UPGRADE_497_URL } from "@/constants/ghlAffiliate";
import { GHL_POPUP_COPY } from "./copy/ghl";
import { downloadKitGhlFile, kitGhlSavedText, openKitGhlLink } from "./ghlResult";

type Step = "account" | "plan" | "destination" | "next";
type Notice = "copied" | "saved" | "opened";

const AFFILIATE_CODE = "Russell-Andrew";

/** Account question, then plan, then the HighLevel link. Styled with kit CSS: the funnel does not load Tailwind. */
export function KitGhlDialog({
  open,
  onOpenChange,
  onContinue,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onContinue: () => void;
}) {
  const [step, setStep] = useState<Step>("account");
  const [plan, setPlan] = useState<GhlPlan | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);
  const copy = GHL_POPUP_COPY;

  useEffect(() => {
    if (!open) return;
    setStep("account");
    setPlan(null);
    setNotice(null);
  }, [open]);

  const chooseAccount = (hasAccount: boolean) => {
    if (!hasAccount) {
      setPlan("none");
      setStep("destination");
      return;
    }
    setStep("plan");
  };

  const choosePlan = (value: Exclude<GhlPlan, "none">) => {
    setPlan(value);
    setStep("destination");
  };

  const advance = (next: Notice) => {
    setNotice(next);
    setStep("next");
  };

  const saveLinks = () => {
    if (!plan || plan === "497") return;
    const text = kitGhlSavedText(plan, AFFILIATE_CODE);
    if (!text) return;
    downloadKitGhlFile(copy.saveFileName, text);
    advance("saved");
  };

  const openLink = (url: string) => {
    openKitGhlLink(url);
    advance("opened");
  };

  const title =
    step === "plan" ? copy.planTitle : step === "destination" ? copy.destinationTitle : step === "next" ? copy.doneTitle : copy.accountTitle;

  const shell = document.querySelector(".ofk");

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal container={shell instanceof HTMLElement ? shell : undefined}>
        <Dialog.Overlay className="ofk-ghl-overlay" />
        <Dialog.Content className="ofk-ghl-dialog" aria-describedby={undefined}>
          <Dialog.Title className="ofk-ghl-title">{title}</Dialog.Title>
          {step === "account" && (
            <div className="ofk-ghl-stack">
              <button type="button" className="ofk-ghl-choice" onClick={() => chooseAccount(true)}>{copy.yes}</button>
              <button type="button" className="ofk-ghl-choice" onClick={() => chooseAccount(false)}>{copy.no}</button>
            </div>
          )}
          {step === "plan" && (
            <div className="ofk-ghl-stack">
              <button type="button" className="ofk-ghl-choice" onClick={() => choosePlan("97")}>{copy.plan97}</button>
              <button type="button" className="ofk-ghl-choice" onClick={() => choosePlan("297")}>{copy.plan297}</button>
              <button type="button" className="ofk-ghl-choice" onClick={() => choosePlan("497")}>{copy.plan497}</button>
              <button type="button" className="ofk-ghl-text" onClick={() => setStep("account")}>{copy.back}</button>
            </div>
          )}
          {step === "destination" && plan === "none" && (
            <div className="ofk-ghl-stack">
              <p className="ofk-ghl-note">First you'll need a HighLevel account — start here:</p>
              <CopyBlock label={copy.signupCopyLabel} value={GHL_AFFILIATE_SIGNUP_URL} onCopied={() => advance("copied")} />
              <button type="button" className="btn" onClick={() => openLink(GHL_AFFILIATE_SIGNUP_URL)}>{copy.signupLabel}</button>
              <button type="button" className="btn dark" onClick={saveLinks}>{copy.save}</button>
              <button type="button" className="ofk-ghl-text" onClick={() => setStep("account")}>{copy.back}</button>
            </div>
          )}
          {step === "destination" && plan === "97" && (
            <div className="ofk-ghl-stack">
              <CopyBlock label="Affiliate Upgrade Credit" value={GHL_UPGRADE_497_URL} onCopied={() => advance("copied")} />
              <button type="button" className="btn" onClick={() => openLink(GHL_UPGRADE_497_URL)}>Complete My Upgrade — $497 Plan</button>
              <CopyBlock label="Affiliate Code" value={AFFILIATE_CODE} onCopied={() => advance("copied")} />
              <button type="button" className="btn dark" onClick={() => openLink(GHL_UPGRADE_297_URL)}>Complete My Upgrade — $297 Plan</button>
              <button type="button" className="btn dark" onClick={saveLinks}>{copy.save}</button>
              <button type="button" className="ofk-ghl-text" onClick={() => setStep("plan")}>{copy.back}</button>
            </div>
          )}
          {step === "destination" && plan === "297" && (
            <div className="ofk-ghl-stack">
              <CopyBlock label="Affiliate Upgrade Credit" value={GHL_UPGRADE_497_URL} onCopied={() => advance("copied")} />
              <button type="button" className="btn" onClick={() => openLink(GHL_UPGRADE_497_URL)}>Complete My Upgrade — $497 Plan</button>
              <button type="button" className="btn dark" onClick={saveLinks}>{copy.save}</button>
              <button type="button" className="ofk-ghl-text" onClick={() => setStep("plan")}>{copy.back}</button>
            </div>
          )}
          {step === "destination" && plan === "497" && (
            <div className="ofk-ghl-stack">
              <h2 className="ofk-ghl-ready">{copy.readyTitle}</h2>
              <p className="ofk-ghl-note">{copy.readyDetail}</p>
              <button type="button" className="btn" onClick={onContinue}>{copy.readyAction}</button>
            </div>
          )}
          {step === "next" && (
            <div className="ofk-ghl-stack">
              {notice === "copied" && <p role="status" className="ofk-ghl-status">{copy.copied}</p>}
              {notice === "saved" && <p role="status" className="ofk-ghl-status">{copy.saved}</p>}
              {notice === "opened" && <p className="ofk-ghl-note">{copy.openedNote}</p>}
              <button type="button" className="btn" onClick={onContinue}>{copy.doneContinue}</button>
              {plan && plan !== "497" && (
                <button type="button" className="ofk-ghl-text" onClick={() => setStep("destination")}>{copy.back}</button>
              )}
            </div>
          )}
          {step !== "next" && (
            <button type="button" className="ofk-ghl-text" onClick={onContinue}>{copy.later}</button>
          )}
          <Dialog.Close className="ofk-ghl-x" aria-label="Close">×</Dialog.Close>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function CopyBlock({ label, value, onCopied }: { label: string; value: string; onCopied: () => void }) {
  return (
    <div className="ofk-ghl-copy">
      <p>{label}</p>
      <code>{value}</code>
      <button
        type="button"
        className="btn dark"
        onClick={() => {
          void navigator.clipboard?.writeText(value);
          onCopied();
        }}
      >
        Copy
      </button>
    </div>
  );
}

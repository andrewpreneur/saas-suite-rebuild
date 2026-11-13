import { ReactNode, useState } from "react";
import { SectionCard } from "@/components/premium/SectionCard";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { HelpCircle } from "lucide-react";

/** Explains the external-platform feature and requires confirmation before showing it. */
export default function ExternalPlatformGate({ children }: { children: ReactNode }) {
  const [confirmed, setConfirmed] = useState(false);
  const [askOpen, setAskOpen] = useState(false);

  if (confirmed) return <>{children}</>;

  return (
    <SectionCard icon={<HelpCircle />} title="What is this?" bodyClassName="space-y-4">
        <p className="max-w-[65ch] text-sm leading-relaxed text-muted-foreground">
          This is for connecting SaaS Suite to a platform that is not based on GoHighLevel. If you run a
          different SaaS that you would like to use our system for, such as our support systems, login
          tracking, Slack integrations, or anything like that, this allows you to do so.
        </p>
        <Button variant="accent" onClick={() => setAskOpen(true)}>Continue</Button>

      <AlertDialog open={askOpen} onOpenChange={setAskOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>One last check</AlertDialogTitle>
            <AlertDialogDescription>
              Confirm you are trying to install SaaS Suite on a non-GoHighLevel SaaS.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => setConfirmed(true)}>Confirm</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </SectionCard>
  );
}

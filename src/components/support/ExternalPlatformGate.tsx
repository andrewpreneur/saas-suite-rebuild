import { ReactNode, useState } from "react";
import { StatusRow } from "@/components/premium/settings/Page";
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

/** Explains the external-platform feature and requires confirmation before showing it. */
export default function ExternalPlatformGate({ children }: { children: ReactNode }) {
  const [confirmed, setConfirmed] = useState(false);
  const [askOpen, setAskOpen] = useState(false);

  if (confirmed) return <>{children}</>;

  return (
    <div>
      <StatusRow
        tone="off"
        label="Not set up"
        detail="For a SaaS that is not built on GoHighLevel: use our support, login tracking and Slack alerts with it."
      >
        <Button variant="accent" className="h-11 flex-1 sm:h-10 sm:flex-none" onClick={() => setAskOpen(true)}>
          Set up a platform
        </Button>
      </StatusRow>

      <AlertDialog open={askOpen} onOpenChange={setAskOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>One last check</AlertDialogTitle>
            <AlertDialogDescription>
              Confirm you are installing SaaS Suite on a SaaS that is not GoHighLevel.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => setConfirmed(true)}>Yes, continue</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

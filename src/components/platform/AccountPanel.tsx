import { ChevronRight, LogOut } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

export type SettingsDestination =
  | "profile"
  | "admins"
  | "billing"
  | "domain"
  | "slack"
  | "highlevel"
  | "external"
  | "help";

const GROUPS: {
  label: string;
  rows: { id: SettingsDestination; label: string; value?: string }[];
}[] = [
  {
    label: "Account",
    rows: [
      { id: "profile", label: "Agency name & logo" },
      { id: "admins", label: "Team admins" },
      { id: "billing", label: "Billing" },
    ],
  },
  {
    label: "Preferences",
    rows: [
      { id: "highlevel", label: "HighLevel" },
      { id: "slack", label: "Slack" },
      { id: "domain", label: "Custom domain" },
      { id: "external", label: "External platform" },
    ],
  },
  {
    label: "Support",
    rows: [{ id: "help", label: "Help" }],
  },
];

/** Profile card menu. Settings live here, and logout is inside the same panel. */
export function AccountPanel({
  open,
  onOpenChange,
  name,
  email,
  plan,
  onOpen,
  onLogout,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  name: string;
  email: string;
  plan: string;
  onOpen: (destination: SettingsDestination) => void;
  onLogout: () => void;
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full overflow-y-auto bg-muted px-4 pb-8 sm:max-w-md">
        <SheetHeader className="text-left">
          <SheetTitle>Account</SheetTitle>
          <SheetDescription>Settings for this agency. Log out is at the bottom.</SheetDescription>
        </SheetHeader>
        <div className="mt-4 rounded-2xl bg-card p-4">
          <p className="font-semibold text-foreground">{name || "Your account"}</p>
          <p className="truncate text-sm text-muted-foreground">{email}</p>
          <p className="mt-1 text-xs text-muted-foreground">{plan}</p>
        </div>
        <div className="mt-4 space-y-4">
          {GROUPS.map((group) => (
            <section key={group.label}>
              <h3 className="mb-2 px-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {group.label}
              </h3>
              <div className="overflow-hidden rounded-2xl bg-card">
                {group.rows.map((row, index) => (
                  <button
                    key={row.id}
                    type="button"
                    onClick={() => {
                      onOpenChange(false);
                      onOpen(row.id);
                    }}
                    className={`flex w-full items-center justify-between gap-3 px-4 py-3 text-left text-sm ${index > 0 ? "border-t border-border" : ""}`}
                  >
                    <span>{row.label}</span>
                    <span className="flex items-center gap-2 text-muted-foreground">
                      {row.id === "billing" ? plan : null}
                      <ChevronRight className="h-4 w-4" />
                    </span>
                  </button>
                ))}
              </div>
            </section>
          ))}
          <section>
            <h3 className="mb-2 px-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Session
            </h3>
            <div className="overflow-hidden rounded-2xl bg-card">
              <button
                type="button"
                onClick={onLogout}
                className="flex w-full items-center justify-between px-4 py-3 text-left text-sm text-destructive"
              >
                Log out
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          </section>
        </div>
      </SheetContent>
    </Sheet>
  );
}

import { useEffect, useState, type ReactNode } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Check, ChevronRight, ChevronsUpDown, CornerDownLeft, Search } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SkinSwitch } from "@/components/premium/SkinSwitch";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  NEW_UI_SIDEBAR_SECTIONS,
  SIDEBAR_HOME_TOOL_IDS,
  TOOL_LABELS,
  sectionLabelForTool,
} from "@/lib/sidebarNav";
import { pathForAppTool } from "@/lib/appRoutes";

/** Where each command-menu entry goes. Mirrors the sidebar's special cases. */
function pathForNav(toolId: string): string {
  if (toolId === "affiliate-dashboard") return "/app/dashboard?view=affiliate";
  if (toolId === "one-feature-kit") return "/app/dashboard?view=kit";
  return pathForAppTool(toolId);
}

/**
 * Answers "where am I?" on every signed-in page: the sidebar group and page
 * name on the left, a ⌘K jump-to menu in the middle, account controls on the right.
 */
export function AppTopBar({ tool, actions }: { tool: string; actions?: ReactNode }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const view = new URLSearchParams(location.search).get("view");
  const pageId =
    tool === "dashboard" && view === "affiliate"
      ? "affiliate-dashboard"
      : tool === "dashboard" && view === "kit"
        ? "one-feature-kit"
        : tool;
  const page = TOOL_LABELS[pageId] ?? "SaaSSuite";
  // A group named after its own page ("Branding › Branding") would just repeat itself.
  const sectionLabel = sectionLabelForTool(pageId);
  const section = sectionLabel === page ? null : sectionLabel;

  const siblings = (
    NEW_UI_SIDEBAR_SECTIONS.find((group) => group.toolIds.includes(pageId))?.toolIds ?? []
  ).filter((id) => id !== "help");

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen((value) => !value);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const go = (toolId: string) => {
    setOpen(false);
    navigate(pathForNav(toolId));
  };

  const groups = [
    { label: "Home", toolIds: [...SIDEBAR_HOME_TOOL_IDS] as string[] },
    ...NEW_UI_SIDEBAR_SECTIONS.map((group) => ({
      label: group.label,
      toolIds: group.toolIds.filter((id) => id !== "help"),
    })),
  ];

  return (
    <header className="px-glass sticky top-0 z-30 hidden h-14 items-center gap-3 border-b border-border/70 px-6 md:flex">
      <nav aria-label="Breadcrumb" className="flex min-w-0 items-center gap-1.5 text-sm">
        {section ? (
          <>
            <span className="truncate text-muted-foreground">{section}</span>
            <ChevronRight className="size-4 shrink-0 text-muted-foreground/60" aria-hidden="true" />
          </>
        ) : null}
        {siblings.length > 1 ? (
          // The page name doubles as a switcher for the other pages in this group.
          <DropdownMenu>
            <DropdownMenuTrigger
              data-testid="page-switcher"
              className="-mx-2 flex h-9 min-w-0 items-center gap-1.5 rounded-lg px-2 font-semibold text-foreground transition-colors duration-150 hover:bg-foreground/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <span aria-current="page" className="truncate">
                {page}
              </span>
              <ChevronsUpDown className="size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="min-w-56">
              <DropdownMenuLabel className="px-eyebrow">{sectionLabel}</DropdownMenuLabel>
              {siblings.map((id) => (
                <DropdownMenuItem key={id} className="min-h-10 gap-2" onSelect={() => go(id)}>
                  <span className="flex-1">{TOOL_LABELS[id] ?? id}</span>
                  {id === pageId ? <Check className="size-4 text-primary" aria-hidden="true" /> : null}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        ) : (
          <span aria-current="page" className="truncate font-semibold text-foreground">
            {page}
          </span>
        )}
      </nav>

      <div className="ml-auto flex shrink-0 items-center gap-2">
        <button
          type="button"
          onClick={() => setOpen(true)}
          data-testid="command-menu-trigger"
          aria-label="Jump to a page"
          className="flex h-9 items-center gap-2 rounded-full bg-card pl-3 pr-2 text-sm text-muted-foreground shadow-card transition-shadow hover:shadow-raised focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          <Search className="size-4 shrink-0" aria-hidden="true" />
          <span className="hidden lg:inline">Search</span>
          <kbd className="rounded-md border border-border bg-muted px-1.5 py-0.5 font-sans text-[11px] font-semibold text-muted-foreground">
            ⌘K
          </kbd>
        </button>
        <SkinSwitch />
      </div>

      {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}

      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput placeholder="Where do you want to go?" />
        <CommandList>
          <CommandEmpty>No page matches that. Try “branding” or “support”.</CommandEmpty>
          {groups.map((group) => (
            <CommandGroup key={group.label} heading={group.label}>
              {group.toolIds.map((id) => (
                <CommandItem key={id} value={`${TOOL_LABELS[id] ?? id} ${group.label}`} onSelect={() => go(id)}>
                  <span className="flex-1">{TOOL_LABELS[id] ?? id}</span>
                  <CornerDownLeft className="size-3.5 text-muted-foreground/60" aria-hidden="true" />
                </CommandItem>
              ))}
            </CommandGroup>
          ))}
        </CommandList>
      </CommandDialog>
    </header>
  );
}

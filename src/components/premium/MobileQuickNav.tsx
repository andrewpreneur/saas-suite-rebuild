import { useNavigate } from "react-router-dom";
import { BarChart3, LayoutGrid, LifeBuoy, Palette, Rocket } from "lucide-react";
import { ExpandableTabs } from "@/components/premium/21st/expandable-tabs";
import { pathForAppTool } from "@/lib/appRoutes";

const ITEMS = [
  { title: "Dashboard", icon: BarChart3, tool: "dashboard" },
  { title: "Hub Pages", icon: LayoutGrid, tool: "client-hub" },
  { title: "Branding", icon: Palette, tool: "branding" },
  { title: "Support", icon: LifeBuoy, tool: "support" },
  { title: "Learn", icon: Rocket, tool: "learning" },
];

/**
 * Phone-only strip under the header: the five places owners go most, one tap
 * each, without opening the drawer. Uses 21st.dev "Expandable Tabs", which shows
 * the label of the tab you pick. The full menu is still in the drawer.
 */
// Static class per position so Tailwind can see them; marks the page you are on.
const CURRENT_CLASS = [
  "[&>button:nth-child(1)]:bg-brand-subtle [&>button:nth-child(1)]:text-[#3E27AE]",
  "[&>button:nth-child(2)]:bg-brand-subtle [&>button:nth-child(2)]:text-[#3E27AE]",
  "[&>button:nth-child(3)]:bg-brand-subtle [&>button:nth-child(3)]:text-[#3E27AE]",
  "[&>button:nth-child(4)]:bg-brand-subtle [&>button:nth-child(4)]:text-[#3E27AE]",
  "[&>button:nth-child(5)]:bg-brand-subtle [&>button:nth-child(5)]:text-[#3E27AE]",
];

export function MobileQuickNav({ tool }: { tool?: string }) {
  const navigate = useNavigate();
  const current = ITEMS.findIndex((item) => item.tool === (tool === "start-here" ? "learning" : tool));
  return (
    <nav aria-label="Quick navigation" className="flex justify-center px-3 pb-2 md:hidden">
      <ExpandableTabs
        tabs={ITEMS.map(({ title, icon }) => ({ title, icon }))}
        activeColor="text-[#3E27AE]"
        className={`w-full flex-nowrap justify-between gap-1 rounded-xl border-border/70 bg-card shadow-card [&_button]:min-h-11 [&_button]:px-3 ${current >= 0 ? CURRENT_CLASS[current] : ""}`}
        onChange={(index) => {
          if (index === null) return;
          navigate(pathForAppTool(ITEMS[index].tool));
        }}
      />
    </nav>
  );
}

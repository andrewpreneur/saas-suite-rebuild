import type { ReactNode } from "react";

/**
 * Wraps an existing settings card when it is shown inside a side panel, and
 * strips the card's own frame so it does not read as a box inside a box.
 */
export function PanelCard({ children }: { children: ReactNode }) {
  return (
    <div className="[&>*]:!rounded-none [&>*]:!border-0 [&>*]:!bg-transparent [&>*]:!p-0 [&>*]:!shadow-none [&>*]:![backdrop-filter:none]">
      {children}
    </div>
  );
}

import { useUser } from "@/contexts/UserContext";
import { isPlatformAdminEmail } from "@/lib/platformAdmins";
import { platformMockEnabled } from "@/lib/platformMock";
import { newUi, setUiVersion } from "@/lib/uiVersion";

/**
 * Old UI / New UI switch for platform admins only (checked against the real
 * signed-in email, so it also shows while viewing a customer's account).
 * The choice is saved in this browser; customers never see the switch and
 * always get the old UI.
 */
export function UiVersionSwitch() {
  const { actualEmail } = useUser();
  if (!platformMockEnabled && !isPlatformAdminEmail(actualEmail)) return null;

  const options: { value: "old" | "new"; label: string }[] = [
    { value: "old", label: "Old UI" },
    { value: "new", label: "New UI" },
  ];
  const current = newUi ? "new" : "old";

  return (
    <div
      role="radiogroup"
      aria-label="Interface version"
      data-testid="ui-version-switch"
      className="inline-flex h-8 items-center rounded-full border border-gray-300 bg-card p-0.5 text-xs font-semibold"
    >
      {options.map((option) => {
        const selected = option.value === current;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => {
              if (!selected) setUiVersion(option.value);
            }}
            className={`h-full rounded-full px-3 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 ${
              selected ? "bg-[#6043EF] text-white" : "text-gray-700 hover:bg-muted"
            }`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

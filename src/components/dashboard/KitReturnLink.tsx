import { useEffect } from "react";
import { Link, useLocation, useSearchParams } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import {
  clearKitReturn,
  currentKitReturn,
  kitReturnTarget,
  rememberKitReturn,
} from "@/lib/kitReturn";

/** Shown on pages opened from a kit step. Hidden once the buyer is back on that step. */
export function KitReturnLink({
  className = "",
  placement = "page",
}: {
  className?: string;
  /** The copilot panel covers the page, so only its own link should show there. */
  placement?: "page" | "copilot";
}) {
  const location = useLocation();
  const [params] = useSearchParams();
  const fromQuery = kitReturnTarget(params.get("returnTo"));
  const target = fromQuery || currentKitReturn(location.search);
  const onKit =
    location.pathname === "/app/dashboard" &&
    params.get("view") === "kit" &&
    !params.get("returnTo");

  useEffect(() => {
    if (onKit) clearKitReturn();
    else if (fromQuery) rememberKitReturn(fromQuery);
  }, [onKit, fromQuery]);

  if (!target || onKit) return null;
  if (placement === "page" && location.pathname.startsWith("/app/copilot")) return null;

  return (
    <Link
      to={target}
      data-testid="kit-return-link"
      className={`inline-flex items-center gap-1.5 text-sm font-semibold text-foreground underline decoration-brand/40 underline-offset-4 hover:text-brand-hover ${className}`}
    >
      <ArrowLeft className="h-4 w-4" aria-hidden="true" />
      Back to One Feature Kit
    </Link>
  );
}

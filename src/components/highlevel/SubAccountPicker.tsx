import { Input } from "@/components/ui/input";
import { Loader2 } from "lucide-react";
import { useGhl } from "./useGhl";
import LocationList from "./LocationList";
import { Button } from "@/components/ui/button";

interface Props {
  agencyId: string | null;
  value: string;
  onChange: (v: string) => void;
  savedIds?: string[];
  /** Multi-select mode: pick several sub-accounts at once. */
  values?: string[];
  onToggle?: (id: string) => void;
}

/** With HighLevel connected: pick from every sub-account. Otherwise: type the ID. */
export default function SubAccountPicker({ agencyId, value, onChange, savedIds = [], values, onToggle }: Props) {
  const { connected, loading, locations, reload } = useGhl(agencyId);
  const multi = !!(values && onToggle);

  if (loading && !locations.length) {
    return <p className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="w-4 h-4 animate-spin" /> Loading sub-accounts…</p>;
  }
  if (connected && locations.length > 0) {
    if (multi) {
      return (
        <div className="space-y-2">
          <LocationList
            onRefresh={() => void reload(true)}
            refreshing={loading}
            locations={locations}
            value={null}
            onSelect={(l) => onToggle(l.location_id)}
            isActive={(l) => values.includes(l.location_id)}
          />
          {values.length > 0 && (
            <p className="text-xs text-primary animate-in fade-in duration-200">
              {values.length} sub-account{values.length > 1 ? "s" : ""} selected
            </p>
          )}
        </div>
      );
    }
    const sel = locations.find((l) => l.location_id === value);
    return (
      <div className="space-y-2">
        <LocationList locations={locations} value={value || null} onSelect={(l) => onChange(l.location_id)} onRefresh={() => void reload(true)} refreshing={loading} />
        {sel && <p className="text-xs text-primary animate-in fade-in duration-200">Selected: {sel.name} ({sel.location_id})</p>}
      </div>
    );
  }
  return (
    <div className="space-y-1.5">
      <Input placeholder="e.g., jTajsdfsdf982" value={value} onChange={(e) => onChange(e.target.value)} className="font-mono" list="saved-sub-accounts" />
      <datalist id="saved-sub-accounts">{savedIds.map((id) => <option key={id} value={id} />)}</datalist>
      {connected ? (
        <Button variant="outline" size="sm" onClick={() => void reload(true)} disabled={loading}>Refresh sub-accounts</Button>
      ) : (
        <p className="text-xs text-muted-foreground">Connect HighLevel in Settings → HighLevel to pick from your sub-accounts instead.</p>
      )}
    </div>
  );
}

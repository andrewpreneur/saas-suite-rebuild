import { useCallback, useState } from "react";
import { Grid } from "@giphy/react-components";
import type { IGif } from "@giphy/js-types";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { SmoothInput } from "@/components/ui/smooth-input";
import { ImagePlay, X } from "lucide-react";
import { motion } from "framer-motion";

export type GifSelection = {
  media_url: string;
  media_type: "gif";
  media_width: number;
  media_height: number;
};

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;

async function fetchFromProxy(q: string, offset: number) {
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData.session?.access_token;
  const res = await fetch(`${SUPABASE_URL}/functions/v1/giphy-search`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ q, offset, limit: 24 }),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json?.error || "Giphy request failed");
  return json;
}

/** Giphy picker — the SDK Grid renders results fetched through our secure proxy. */
export function GifPicker({ onSelect }: { onSelect: (gif: GifSelection) => void }) {
  const [open, setOpen] = useState(false);
  const [term, setTerm] = useState("");
  const [error, setError] = useState<string | null>(null);

  const fetchGifs = useCallback(
    async (offset: number) => {
      try {
        const json = await fetchFromProxy(term, offset);
        setError(null);
        return {
          data: json.data as IGif[],
          pagination: json.pagination,
          meta: json.meta,
        } as any;
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not load GIFs");
        return { data: [], pagination: { total_count: 0, count: 0, offset: 0 }, meta: {} } as any;
      }
    },
    [term],
  );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button type="button" size="sm" variant="ghost" className="gap-1.5 text-muted-foreground">
          <ImagePlay className="h-4 w-4" /> GIF
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[340px] p-3">
        <SmoothInput
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          placeholder="Search GIFs..."
          className="mb-2 rounded-md border border-input"
        />
        {error ? (
          <p className="py-6 text-center text-xs text-destructive">{error}</p>
        ) : (
          <div className="max-h-[300px] overflow-y-auto">
            <Grid
              key={term}
              width={310}
              columns={2}
              gutter={6}
              fetchGifs={fetchGifs}
              noLink
              hideAttribution
              onGifClick={(gif, e) => {
                e.preventDefault();
                const img = gif.images.fixed_width;
                onSelect({
                  media_url: img.url,
                  media_type: "gif",
                  media_width: Number(img.width),
                  media_height: Number(img.height),
                });
                setOpen(false);
              }}
            />
          </div>
        )}
        <p className="mt-2 text-center text-[10px] text-muted-foreground">Powered by GIPHY</p>
      </PopoverContent>
    </Popover>
  );
}

/** Preview of a selected GIF before posting, with a remove button. */
export function GifPreview({ gif, onClear }: { gif: GifSelection; onClear: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      className="relative inline-block overflow-hidden rounded-lg border border-border"
    >
      <img src={gif.media_url} alt="Selected GIF" className="max-h-40 w-auto" loading="lazy" />
      <button
        type="button"
        onClick={onClear}
        aria-label="Remove GIF"
        className="absolute right-1 top-1 rounded-full bg-background/80 p-1 text-muted-foreground hover:text-foreground"
      >
        <X className="h-3 w-3" />
      </button>
    </motion.div>
  );
}

/** Renders attached media on a post or comment. */
export function MediaAttachment({
  url,
  width,
  height,
  className = "",
}: {
  url?: string | null;
  width?: number | null;
  height?: number | null;
  className?: string;
}) {
  if (!url) return null;
  return (
    <img
      src={url}
      alt="GIF attachment"
      width={width || undefined}
      height={height || undefined}
      loading="lazy"
      className={`mt-2 max-h-72 w-auto max-w-full rounded-lg border border-border ${className}`}
    />
  );
}

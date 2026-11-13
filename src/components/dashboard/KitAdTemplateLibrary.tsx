import { useState } from "react";
import { Link } from "react-router-dom";
import JSZip from "jszip";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import {
  KIT_AD_GROUPS,
  KIT_AD_TEMPLATE_COUNT,
  KIT_AD_TEMPLATES,
  allowedKitAdTemplateIds,
  type KitAdTemplate,
} from "@/lib/kitAdTemplates";
import { Download, Lock, Maximize2 } from "lucide-react";

const LAUNCH_HREF = "/one-feature-kit/launch-pack";

export function kitAdDownloadName(src: string, id: string): string {
  const path = src.split("?")[0].split("#")[0];
  const base = path.split("/").pop() || "";
  return /\.[a-z0-9]+$/i.test(base) ? base : id;
}

function saveBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

/** Same-origin files use the saved blob name. A cross-origin URL falls back to the download attribute. */
export async function downloadKitAdFile(src: string, filename: string): Promise<void> {
  try {
    const response = await fetch(src);
    if (!response.ok) throw new Error("download failed");
    saveBlob(await response.blob(), filename);
  } catch {
    const link = document.createElement("a");
    link.href = src;
    link.download = filename;
    link.rel = "noopener";
    link.target = "_blank";
    document.body.appendChild(link);
    link.click();
    link.remove();
  }
}

async function downloadKitAdZip(items: KitAdTemplate[]): Promise<void> {
  const zip = new JSZip();
  await Promise.all(
    items.map(async (item) => {
      const response = await fetch(item.src);
      if (!response.ok) throw new Error("download failed");
      zip.file(kitAdDownloadName(item.src, item.id), await response.blob());
    }),
  );
  saveBlob(await zip.generateAsync({ type: "blob" }), "one-feature-kit-ad-library.zip");
}

function TemplateMedia({ item, className }: { item: KitAdTemplate; className: string }) {
  if (item.kind === "video") {
    return (
      <video controls poster={item.poster ?? undefined} src={item.src} className={className} />
    );
  }
  return <img src={item.src} alt={item.title} className={className} />;
}

function TemplatePreview({
  item,
  unlocked,
  onEnlarge,
}: {
  item: KitAdTemplate;
  unlocked: boolean;
  onEnlarge: () => void;
}) {
  const fullClass = "h-auto w-full rounded-md bg-muted object-contain";
  if (!unlocked) {
    return (
      <div className="relative overflow-hidden rounded-md">
        <img
          src={item.poster ?? item.src}
          alt=""
          className="h-auto w-full object-contain blur-md"
        />
        <Link
          to={LAUNCH_HREF}
          className="absolute inset-0 flex items-center justify-center bg-background/40 px-4 text-center text-sm font-semibold text-foreground"
        >
          <Lock className="mr-2 h-4 w-4" />
          Unlock in the Launch Pack
        </Link>
      </div>
    );
  }
  if (item.kind === "video") {
    return <TemplateMedia item={item} className={fullClass} />;
  }
  return (
    <button
      type="button"
      className="block w-full cursor-zoom-in rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-700"
      onClick={onEnlarge}
      aria-label={`Enlarge ${item.title}`}
    >
      <TemplateMedia item={item} className={fullClass} />
    </button>
  );
}

function TemplateCard({ item, unlocked }: { item: KitAdTemplate; unlocked: boolean }) {
  const [copied, setCopied] = useState(false);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const filename = kitAdDownloadName(item.src, item.id);
  return (
    <Card data-kit-template={item.id} data-kit-template-unlocked={unlocked ? "yes" : "no"}>
      <CardContent className="flex flex-col gap-3 p-4">
        <TemplatePreview item={item} unlocked={unlocked} onEnlarge={() => setOpen(true)} />
        <h4 className="text-sm font-semibold text-foreground">{item.title}</h4>
        {unlocked ? (
          <>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button
                type="button"
                variant="outline"
                className="w-full sm:w-auto"
                disabled={saving}
                onClick={() => {
                  setSaving(true);
                  void downloadKitAdFile(item.src, filename).finally(() => setSaving(false));
                }}
              >
                <Download className="mr-2 h-4 w-4" />
                {saving ? "Saving…" : "Download"}
              </Button>
              {item.kind === "video" ? (
                <Button
                  type="button"
                  variant="outline"
                  className="w-full sm:w-auto"
                  onClick={() => setOpen(true)}
                >
                  <Maximize2 className="mr-2 h-4 w-4" />
                  Enlarge
                </Button>
              ) : null}
              <Button
                type="button"
                variant="outline"
                className="w-full sm:w-auto"
                onClick={() => {
                  const field = document.getElementById(
                    `kit-prompt-${item.id}`,
                  ) as HTMLTextAreaElement | null;
                  void navigator.clipboard
                    ?.writeText(item.prompt)
                    .then(() => setCopied(true))
                    .catch(() => field?.select());
                }}
              >
                {copied ? "Copied" : "Copy prompt"}
              </Button>
            </div>
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogContent className="max-h-[90vh] max-w-5xl overflow-auto">
                <DialogTitle>{item.title}</DialogTitle>
                <TemplateMedia
                  item={item}
                  className="mx-auto h-auto max-h-[75vh] w-full object-contain"
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => void downloadKitAdFile(item.src, filename)}
                >
                  <Download className="mr-2 h-4 w-4" />
                  Download
                </Button>
              </DialogContent>
            </Dialog>
            <Label htmlFor={`kit-prompt-${item.id}`} className="text-xs text-muted-foreground">
              {item.kind === "video" ? "Script and storyboard prompt" : "ChatGPT prompt"}
            </Label>
            <Textarea
              id={`kit-prompt-${item.id}`}
              readOnly
              rows={6}
              value={item.prompt}
              className="text-xs"
            />
          </>
        ) : (
          <Button asChild className="w-full">
            <Link to={LAUNCH_HREF}>Buy the Launch Pack · $147</Link>
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

function readLogo(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const value = String(reader.result || "");
      const comma = value.indexOf(",");
      resolve(comma >= 0 ? value.slice(comma + 1) : value);
    };
    reader.onerror = () => reject(new Error("Couldn't read that logo."));
    reader.readAsDataURL(file);
  });
}

function CustomizationForm({ templates }: { templates: KitAdTemplate[] }) {
  const [businessName, setBusinessName] = useState("");
  const [notes, setNotes] = useState("");
  const [selected, setSelected] = useState<string[]>(() =>
    templates.filter((item) => item.inKit).map((item) => item.id),
  );
  const [logo, setLogo] = useState<File | null>(null);
  const [error, setError] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  if (sent) {
    return (
      <p
        className="rounded-md border border-border bg-muted/40 p-4 text-sm text-foreground"
        data-kit-request-sent="yes"
      >
        Request sent. The team has your logo and will customize these templates.
      </p>
    );
  }

  return (
    <form
      className="space-y-4 rounded-md border border-border p-4"
      data-testid="kit-ad-request"
      onSubmit={(event) => {
        event.preventDefault();
        if (sending) return;
        const name = businessName.trim();
        if (!name) {
          setError("Enter your business name.");
          return;
        }
        if (!logo) {
          setError("Upload your logo.");
          return;
        }
        if (!["image/png", "image/jpeg", "image/webp"].includes(logo.type)) {
          setError("Upload a PNG, JPEG, or WebP logo.");
          return;
        }
        if (logo.size > 4 * 1024 * 1024) {
          setError("That logo is over 4 MB.");
          return;
        }
        if (selected.length === 0) {
          setError("Choose at least one template.");
          return;
        }
        setSending(true);
        setError("");
        void readLogo(logo)
          .then((logoBase64) =>
            supabase.functions.invoke("kit-ad-customization", {
              body: {
                businessName: name,
                notes: notes.trim(),
                templateIds: selected,
                logoBase64,
                logoContentType: logo.type,
              },
            }),
          )
          .then(({ data, error: invokeError }) => {
            if (invokeError || data?.error || data?.ok !== true) {
              setError(
                typeof data?.error === "string"
                  ? data.error
                  : "We couldn't send that request. Please try again.",
              );
              return;
            }
            setSent(true);
          })
          .catch(() => setError("We couldn't send that request. Please try again."))
          .finally(() => setSending(false));
      }}
    >
      <div className="space-y-1">
        <h4 className="text-base font-semibold text-foreground">Done-for-you customization</h4>
        <p className="text-sm text-muted-foreground">
          Send your business name, logo, and the templates you want. The team brands them for you.
        </p>
      </div>
      <div className="space-y-2">
        <Label htmlFor="kit-ad-business">Business name</Label>
        <Input
          id="kit-ad-business"
          value={businessName}
          maxLength={120}
          onChange={(event) => setBusinessName(event.target.value)}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="kit-ad-logo">Logo</Label>
        <Input
          id="kit-ad-logo"
          type="file"
          accept="image/png,image/jpeg,image/webp"
          onChange={(event) => setLogo(event.target.files?.[0] ?? null)}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="kit-ad-notes">Offer or notes</Label>
        <Textarea
          id="kit-ad-notes"
          rows={4}
          maxLength={4000}
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
        />
      </div>
      <fieldset className="space-y-2">
        <legend className="text-sm font-medium text-foreground">Templates</legend>
        {templates.map((item) => (
          <label key={item.id} className="flex items-center gap-2 text-sm text-foreground">
            <input
              type="checkbox"
              checked={selected.includes(item.id)}
              onChange={(event) => {
                setSelected((current) =>
                  event.target.checked
                    ? [...current, item.id]
                    : current.filter((id) => id !== item.id),
                );
              }}
            />
            {item.title}
          </label>
        ))}
      </fieldset>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <Button type="submit" disabled={sending}>
        {sending ? "Sending…" : "Send this to the team"}
      </Button>
    </form>
  );
}

export function KitAdTemplateLibrary({ lineIds }: { lineIds: string[] }) {
  const allowed = new Set(allowedKitAdTemplateIds(lineIds));
  const unlocked = KIT_AD_TEMPLATES.filter((item) => allowed.has(item.id));
  const [zipping, setZipping] = useState(false);
  const [zipError, setZipError] = useState("");
  return (
    <section id="kit-ad-templates" className="space-y-4" data-testid="kit-ad-templates">
      <Accordion type="single" collapsible>
        <AccordionItem
          value="ad-library"
          className="group rounded-xl border border-purple-200 px-4 dark:border-purple-800"
        >
          <AccordionTrigger
            className="text-lg font-semibold text-purple-800 hover:no-underline dark:text-purple-200"
            data-testid="kit-ad-library-toggle"
          >
            Ad Library ({KIT_AD_TEMPLATE_COUNT})
          </AccordionTrigger>
          <AccordionContent forceMount className="space-y-4 group-data-[state=closed]:hidden">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="max-w-3xl text-sm text-muted-foreground">
                {KIT_AD_TEMPLATE_COUNT} creatives. The kit includes the Vibe Code template. The
                Launch Pack includes all of them. Upload a creative and your logo to ChatGPT with
                the prompt on the card.
              </p>
              {unlocked.length > 0 ? (
                <Button
                  type="button"
                  variant="outline"
                  className="shrink-0"
                  disabled={zipping}
                  onClick={() => {
                    setZipping(true);
                    setZipError("");
                    void downloadKitAdZip(unlocked)
                      .catch(() =>
                        setZipError("We couldn't prepare that download. Please try again."),
                      )
                      .finally(() => setZipping(false));
                  }}
                >
                  <Download className="mr-2 h-4 w-4" />
                  {zipping ? "Preparing…" : "Download all"}
                </Button>
              ) : null}
            </div>
            {zipError ? <p className="text-sm text-destructive">{zipError}</p> : null}
            {KIT_AD_GROUPS.map((group) => (
              <div key={group.id} className="space-y-3">
                <h4 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                  {group.label}
                </h4>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {KIT_AD_TEMPLATES.filter((item) => item.group === group.id).map((item) => (
                    <TemplateCard key={item.id} item={item} unlocked={allowed.has(item.id)} />
                  ))}
                </div>
              </div>
            ))}
            {unlocked.length > 0 && <CustomizationForm templates={unlocked} />}
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </section>
  );
}

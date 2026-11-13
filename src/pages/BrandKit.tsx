import { useState } from "react";
import JSZip from "jszip";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Download, Copy, Check } from "lucide-react";
import PageSEO from "@/components/PageSEO";
import { toast } from "sonner";
import darkIcon from "@/assets/saassuite-dark-icon.png.asset.json";
import darkBanner from "@/assets/saassuite-dark-banner.png.asset.json";
import lightIcon from "@/assets/saassuite-light-icon.png.asset.json";
import lightBanner from "@/assets/saassuite-light-banner.png.asset.json";
import andrewGeorgeImage from "@/assets/andrew-george-founder.png.asset.json";

const HERO_BG = "/assets/hero-bg.png";
const MARKETING_URL = "sassuite.com";

type Swatch = { name: string; hex: string; description: string };

const CORE_COLORS: Swatch[] = [
  { name: "SaaSSuite Purple", hex: "#6043EF", description: "Primary brand purple — matches the Start for Free button" },
  { name: "Ink", hex: "#171717", description: "Primary text & buttons" },
  { name: "Slate 900", hex: "#0F172A", description: "Foreground / headings" },
  { name: "Slate 500", hex: "#64748B", description: "Muted text" },
  { name: "Surface", hex: "#FCFCFC", description: "Page background" },
  { name: "Card", hex: "#FFFFFF", description: "Card surface" },
  { name: "Border", hex: "#E5E7EB", description: "Dividers & borders" },
];

const GRADIENTS = [
  { name: "SaaSSuite CTA Gradient", css: "linear-gradient(135deg, #7130B6 0%, #A83DDA 55%, #D026C9 100%)" },
];

const RADII = [
  { name: "sm", value: "0.5rem" },
  { name: "md (base)", value: "0.625rem" },
  { name: "lg / --radius", value: "0.75rem" },
  { name: "xl", value: "1rem" },
  { name: "full (pills)", value: "9999px" },
];

const FONTS = [
  { name: "Inter", role: "Primary UI & body", sample: "The quick brown fox jumps over 1234567890" },
  { name: "System UI", role: "Fallback stack", sample: "-apple-system, BlinkMacSystemFont, Segoe UI, Roboto" },
];

const LOGOS = [
  { label: "Dark square logo", src: darkIcon.url, filename: "saassuite-dark-icon.png", bg: "bg-card", dimensions: "1000 × 1000" },
  { label: "Light square logo", src: lightIcon.url, filename: "saassuite-light-icon.png", bg: "bg-pricing-premium", dimensions: "1000 × 1000" },
  { label: "Dark banner logo", src: darkBanner.url, filename: "saassuite-dark-banner.png", bg: "bg-card", dimensions: "1920 × 500" },
  { label: "Light banner logo", src: lightBanner.url, filename: "saassuite-light-banner.png", bg: "bg-pricing-premium", dimensions: "1920 × 500" },
];

const GRAPHICS = [
  { label: "Hero background", src: HERO_BG, filename: "hero-background.png" },
];

const FOUNDER_ASSETS = [
  { label: "Andrew George — Founder of SaaSSuite", src: andrewGeorgeImage.url, filename: "andrew-george-founder.png", dimensions: "1080 × 1920" },
];

function CopyChip({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={async () => {
        await navigator.clipboard.writeText(value);
        setCopied(true);
        setTimeout(() => setCopied(false), 1200);
      }}
      className="inline-flex items-center gap-1.5 text-xs font-mono px-2 py-1 rounded-md bg-muted hover:bg-muted/70 transition-colors"
      aria-label={`Copy ${value}`}
    >
      {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
      {value}
    </button>
  );
}

async function fetchAsBlob(url: string): Promise<Blob | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    return await res.blob();
  } catch {
    return null;
  }
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

async function downloadAsset(src: string, filename: string) {
  const blob = await fetchAsBlob(src);
  if (!blob) {
    toast.error(`Could not download ${filename}`);
    return;
  }
  downloadBlob(blob, filename);
}

function buildBrandGuidelines(): string {
  return `SaaSSuite Brand Kit
====================

COLORS
${CORE_COLORS.map((c) => `- ${c.name}: ${c.hex} — ${c.description}`).join("\n")}

GRADIENTS
${GRADIENTS.map((g) => `- ${g.name}: ${g.css}`).join("\n")}

BORDER RADIUS
${RADII.map((r) => `- ${r.name}: ${r.value}`).join("\n")}

TYPOGRAPHY
${FONTS.map((f) => `- ${f.name} — ${f.role}`).join("\n")}

LOGO USAGE
- Use the Primary logo on light backgrounds.
- Use the Inverted logo on dark backgrounds (#0F172A or darker).
- Keep clear space equal to the height of the "S" glyph around all sides.
- Do not recolor, skew, or apply drop shadows to the mark.

FILES
 /logos/            — full-resolution PNG logos
 /graphics/         — hero background
 /founder/          — full-resolution founder photo
/tokens.json       — machine-readable color, radius & typography tokens
/brand-guidelines.txt — this file
`;
}

function buildTokensJSON() {
  return JSON.stringify(
    {
      colors: Object.fromEntries(CORE_COLORS.map((c) => [c.name, c.hex])),
      gradients: Object.fromEntries(GRADIENTS.map((g) => [g.name, g.css])),
      radius: Object.fromEntries(RADII.map((r) => [r.name, r.value])),
      fonts: FONTS.map((f) => ({ name: f.name, role: f.role })),
    },
    null,
    2,
  );
}

const BrandKit = () => {
  const [zipping, setZipping] = useState(false);

  async function handleDownloadZip() {
    setZipping(true);
    try {
      const zip = new JSZip();
      zip.file("brand-guidelines.txt", buildBrandGuidelines());
      zip.file("tokens.json", buildTokensJSON());

      const logosFolder = zip.folder("logos");
      for (const l of LOGOS) {
        const blob = await fetchAsBlob(l.src);
        if (blob && logosFolder) logosFolder.file(l.filename, blob);
      }
      const graphicsFolder = zip.folder("graphics");
      for (const g of GRAPHICS) {
        const blob = await fetchAsBlob(g.src);
        if (blob && graphicsFolder) graphicsFolder.file(g.filename, blob);
      }
      const founderFolder = zip.folder("founder");
      for (const asset of FOUNDER_ASSETS) {
        const blob = await fetchAsBlob(asset.src);
        if (blob && founderFolder) founderFolder.file(asset.filename, blob);
      }

      const out = await zip.generateAsync({ type: "blob" });
      downloadBlob(out, "saassuite-brand-kit.zip");
      toast.success("Brand kit downloaded");
    } catch (e) {
      console.error(e);
      toast.error("Could not build the ZIP. Please try again.");
    } finally {
      setZipping(false);
    }
  }

  return (
    <>
      <PageSEO
        title="SaaSSuite Brand Kit — Colors, Logos & Assets"
        description="Download the official SaaSSuite brand kit: colors, gradients, typography, radii, logos (light & dark), and hero graphics — all in one ZIP."
        path="/brand-kit"
      />

      <main className="min-h-screen bg-background text-foreground">
        <section className="border-b border-border bg-card">
          <div className="max-w-6xl mx-auto px-6 py-16 md:py-20">
            <div className="brand-kit-gradient inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-primary-foreground text-xs font-semibold mb-6">
              Brand Kit
            </div>
            <h1 className="text-4xl md:text-6xl font-bold tracking-tight text-foreground max-w-3xl">
              The SaaSSuite Brand Kit
            </h1>
            <p className="mt-4 text-lg text-muted-foreground max-w-2xl">
              Full-resolution logos, official colors, founder imagery, and marketing graphics for representing SaaSSuite.
            </p>
            <a href="https://sassuite.com" className="mt-3 inline-block text-lg font-semibold text-pricing hover:underline">{MARKETING_URL}</a>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button
                onClick={handleDownloadZip}
                disabled={zipping}
                className="brand-kit-gradient text-primary-foreground rounded-full font-semibold px-6 py-6 text-base"
              >
                <Download className="w-4 h-4 mr-2" />
                {zipping ? "Building ZIP…" : "Download full brand kit (.zip)"}
              </Button>
            </div>
          </div>
        </section>

        <div className="max-w-6xl mx-auto px-6 py-16 space-y-20">
          {/* Logos */}
          <section>
            <SectionHeader
              eyebrow="01 — Logos"
              title="Logos"
              subtitle="Use the light-background logo on white/cream surfaces and the dark-background logo on ink, navy, or photographic backgrounds."
            />
            <div className="grid gap-6 md:grid-cols-2 mt-8">
              {LOGOS.map((l) => (
                <Card key={l.filename} className="overflow-hidden border-2 border-border">
                  <div className={`${l.bg} h-56 flex items-center justify-center p-8`}>
                    <img src={l.src} alt={l.label} className="max-h-full max-w-full object-contain" />
                  </div>
                  <CardContent className="p-5 flex items-center justify-between gap-4">
                    <div>
                      <div className="font-semibold text-sm">{l.label}</div>
                      <div className="text-xs text-muted-foreground font-mono mt-0.5">{l.filename}</div>
                      <div className="text-xs text-muted-foreground mt-1">{l.dimensions} PNG</div>
                    </div>
                    <Button size="sm" variant="outline" onClick={() => downloadAsset(l.src, l.filename)}>
                      <Download className="w-3.5 h-3.5 mr-1.5" /> PNG
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          </section>

          {/* Graphics — intentionally placed immediately below the logos */}
          <section>
            <SectionHeader eyebrow="02 — Graphics" title="Hero background" subtitle={`The primary marketing background used on ${MARKETING_URL}.`} />
            <div className="grid gap-6 mt-8">
              {GRAPHICS.map((g) => (
                <Card key={g.filename} className="overflow-hidden border-2 border-border">
                  <img src={g.src} alt={g.label} className="w-full h-64 object-cover" />
                  <CardContent className="p-5 flex items-center justify-between gap-4">
                    <div>
                      <div className="font-semibold text-sm">{g.label}</div>
                      <div className="text-xs text-muted-foreground font-mono mt-0.5">{g.filename}</div>
                    </div>
                    <Button size="sm" variant="outline" onClick={() => downloadAsset(g.src, g.filename)}>
                      <Download className="w-3.5 h-3.5 mr-1.5" /> PNG
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          </section>

          {/* Founder */}
          <section>
            <SectionHeader eyebrow="03 — Founder" title="Founder portrait" subtitle="Approved full-resolution photo of SaaSSuite founder Andrew George." />
            <div className="grid gap-6 mt-8 md:max-w-xl">
              {FOUNDER_ASSETS.map((asset) => (
                <Card key={asset.filename} className="overflow-hidden border-2 border-border">
                  <img src={asset.src} alt={asset.label} className="aspect-square w-full object-cover" />
                  <CardContent className="p-5 flex items-center justify-between gap-4">
                    <div>
                      <div className="font-semibold text-sm">{asset.label}</div>
                      <div className="text-xs text-muted-foreground mt-0.5">{asset.dimensions} PNG</div>
                    </div>
                    <Button size="sm" variant="outline" onClick={() => downloadAsset(asset.src, asset.filename)}>
                      <Download className="w-3.5 h-3.5 mr-1.5" /> PNG
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          </section>

          {/* Colors */}
          <section>
            <SectionHeader eyebrow="04 — Colors" title="Color palette" subtitle="One official purple, supported by neutral interface colors." />
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 mt-8">
              {CORE_COLORS.map((c) => (
                <Card key={c.hex} className="overflow-hidden border-2 border-border">
                  <div className="h-28" style={{ background: c.hex }} />
                  <CardContent className="p-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="font-semibold text-sm">{c.name}</div>
                      <CopyChip value={c.hex} />
                    </div>
                    <p className="text-xs text-muted-foreground">{c.description}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </section>

          {/* Gradient */}
          <section>
            <SectionHeader eyebrow="05 — Gradient" title="CTA gradient" subtitle="The approved gradient used on webinar buttons." />
            <div className="grid gap-4 md:max-w-xl mt-8">
              {GRADIENTS.map((g) => (
                <Card key={g.name} className="overflow-hidden border-2 border-border">
                  <div className="h-32 brand-kit-gradient" />
                  <CardContent className="p-4 space-y-2">
                    <div className="font-semibold text-sm">{g.name}</div>
                    <CopyChip value={g.css} />
                  </CardContent>
                </Card>
              ))}
            </div>
          </section>

          {/* Radius */}
          <section>
            <SectionHeader eyebrow="06 — Radius" title="Border radius" subtitle="Base token is 0.75rem — used across cards, inputs and modals." />
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5 mt-8">
              {RADII.map((r) => (
                <Card key={r.name} className="border-2 border-border">
                  <CardContent className="p-5 flex flex-col items-center gap-3">
                    <div className="brand-kit-gradient w-20 h-20" style={{ borderRadius: r.value }} />
                    <div className="text-sm font-semibold">{r.name}</div>
                    <CopyChip value={r.value} />
                  </CardContent>
                </Card>
              ))}
            </div>
          </section>

          {/* Typography */}
          <section>
            <SectionHeader eyebrow="07 — Typography" title="Typography" subtitle="Inter drives the entire product — clean, high legibility at any size." />
            <div className="grid gap-4 md:grid-cols-2 mt-8">
              {FONTS.map((f) => (
                <Card key={f.name} className="border-2 border-border">
                  <CardContent className="p-6 space-y-3">
                    <div className="text-xs uppercase tracking-widest text-muted-foreground">{f.role}</div>
                    <div className="text-2xl font-bold">{f.name}</div>
                    <div className="text-3xl font-bold tracking-tight">Aa Bb Cc</div>
                    <div className="text-sm text-muted-foreground">{f.sample}</div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </section>

          {/* Final ZIP */}
          <section className="rounded-2xl border-2 border-border bg-muted p-10 text-center">
            <h2 className="text-2xl md:text-3xl font-bold tracking-tight">Grab the whole kit</h2>
            <p className="mt-2 text-muted-foreground max-w-xl mx-auto">
              A single ZIP with every full-resolution logo, the hero background, founder photo, tokens, and brand guidelines.
            </p>
            <Button
              onClick={handleDownloadZip}
              disabled={zipping}
              className="brand-kit-gradient mt-6 text-primary-foreground rounded-full font-semibold px-8 py-6 text-base"
            >
              <Download className="w-4 h-4 mr-2" />
              {zipping ? "Building ZIP…" : "Download saassuite-brand-kit.zip"}
            </Button>
          </section>
        </div>
      </main>
    </>
  );
};

function SectionHeader({ eyebrow, title, subtitle }: { eyebrow: string; title: string; subtitle: string }) {
  return (
    <div className="max-w-2xl">
      <div className="text-xs uppercase tracking-widest text-pricing font-semibold">{eyebrow}</div>
      <h2 className="mt-2 text-3xl md:text-4xl font-bold tracking-tight">{title}</h2>
      <p className="mt-2 text-muted-foreground">{subtitle}</p>
    </div>
  );
}

export default BrandKit;

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

interface Font {
  name: string;
  family: string;
  type: "sans-serif" | "serif" | "display";
}

interface FontSelectorProps {
  selectedFont: string;
  onSelectFont: (font: string) => void;
  className?: string;
}

const fonts: Font[] = [
  { name: "Inter", family: "Inter, sans-serif", type: "sans-serif" },
  { name: "Roboto", family: "Roboto, sans-serif", type: "sans-serif" },
  { name: "Poppins", family: "Poppins, sans-serif", type: "sans-serif" },
  { name: "Montserrat", family: "Montserrat, sans-serif", type: "sans-serif" },
  { name: "Open Sans", family: "Open Sans, sans-serif", type: "sans-serif" },
  { name: "Verdana", family: "Verdana, sans-serif", type: "sans-serif" },
  { name: "Oswald", family: "Oswald, sans-serif", type: "display" },
  { name: "Playfair Display", family: "Playfair Display, serif", type: "serif" },
  { name: "Merriweather", family: "Merriweather, serif", type: "serif" },
];

const FontSelector = ({ selectedFont, onSelectFont, className }: FontSelectorProps) => {
  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <Label htmlFor="branding-font">Sidebar font</Label>
      <Select value={selectedFont} onValueChange={onSelectFont}>
        <SelectTrigger id="branding-font" className="w-full">
          <SelectValue placeholder="Choose a font..." />
        </SelectTrigger>
        <SelectContent>
          {fonts.map((font) => (
            <SelectItem key={font.name} value={font.name}>
              <span style={{ fontFamily: font.family }}>
                {font.name}
              </span>
              <span className="ml-2 text-xs text-muted-foreground">{font.type}</span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
};

export default FontSelector;

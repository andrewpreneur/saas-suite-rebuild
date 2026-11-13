import { useEffect, useState } from "react";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

interface ColorPickerProps {
  label: string;
  color: string;
  onChange: (color: string) => void;
  className?: string;
  autoFocus?: boolean;
}

const HEX = /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/;

/**
 * One tidy color field: the label on top, then a swatch that opens the system
 * color picker and a hex box you can type or paste into.
 */
const ColorPicker = ({ label, color, onChange, className, autoFocus }: ColorPickerProps) => {
  // Kept as `color-<label>` because browser tests find the field by this id.
  const id = `color-${label}`;
  const [inputColor, setInputColor] = useState(color);
  const [hexInput, setHexInput] = useState(color);

  useEffect(() => {
    setInputColor(color);
    setHexInput(color);
  }, [color]);

  const handleColorChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newColor = e.target.value;
    setInputColor(newColor);
    setHexInput(newColor);
    onChange(newColor);
  };

  const handleHexInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let value = e.target.value;

    // Auto-add # if not present
    if (value && !value.startsWith("#")) {
      value = "#" + value;
    }

    setHexInput(value);

    // Validate hex color (3 or 6 digits)
    if (HEX.test(value)) {
      setInputColor(value);
      onChange(value);
    }
  };

  const invalid = Boolean(hexInput) && !HEX.test(hexInput);
  // The native picker only accepts six-digit hex.
  const pickerValue = /^#[A-Fa-f0-9]{6}$/.test(inputColor || "") ? inputColor : "#000000";

  return (
    <div className={cn("flex min-w-0 flex-col gap-2", className)}>
      <Label htmlFor={id}>{label}</Label>
      <div
        className={cn(
          "flex h-11 items-center gap-2 rounded-md border bg-card p-1 pr-3 shadow-card transition-[border-color,box-shadow] sm:h-10",
          "focus-within:border-brand focus-within:ring-2 focus-within:ring-brand/20",
          invalid ? "border-destructive" : "border-input",
        )}
      >
        <span
          className="relative h-full w-10 shrink-0 overflow-hidden rounded-sm border border-border"
          style={{ backgroundColor: inputColor }}
          title="Open the color picker"
        >
          <input
            type="color"
            value={pickerValue}
            onChange={handleColorChange}
            aria-label={`Pick ${label}`}
            className="absolute inset-0 size-full cursor-pointer opacity-0"
          />
        </span>
        <input
          id={id}
          type="text"
          value={hexInput}
          onChange={handleHexInputChange}
          placeholder="#000000"
          spellCheck={false}
          autoComplete="off"
          maxLength={7}
          autoFocus={autoFocus}
          aria-invalid={invalid || undefined}
          aria-describedby={invalid ? `${id}-error` : undefined}
          className="min-w-0 flex-1 bg-transparent font-mono text-sm uppercase text-foreground outline-none placeholder:text-muted-foreground"
        />
      </div>
      {invalid ? (
        <p id={`${id}-error`} className="text-xs text-destructive">
          Use a hex color like #6043EF.
        </p>
      ) : null}
    </div>
  );
};

export default ColorPicker;

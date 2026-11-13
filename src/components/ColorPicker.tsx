
import { useState, useEffect } from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface ColorPickerProps {
  label: string;
  color: string;
  onChange: (color: string) => void;
  className?: string;
  autoFocus?: boolean;
}

const ColorPicker = ({ label, color, onChange, className, autoFocus }: ColorPickerProps) => {
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
    if (value && !value.startsWith('#')) {
      value = '#' + value;
    }
    
    setHexInput(value);
    
    // Validate hex color (3 or 6 digits)
    const hexRegex = /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/;
    if (hexRegex.test(value)) {
      setInputColor(value);
      onChange(value);
    }
  };

  const handleColorSquareClick = () => {
    const colorInput = document.getElementById(`color-${label}`) as HTMLInputElement;
    colorInput?.click();
  };
  
  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex justify-between items-center">
        <Label htmlFor={`color-${label}`}>{label}</Label>
        <div className="flex items-center space-x-2">
          <div 
            className="w-6 h-6 rounded border border-gray-300 cursor-pointer hover:border-gray-400 transition-colors" 
            style={{ backgroundColor: inputColor }}
            onClick={handleColorSquareClick}
            title="Click to open color picker"
          />
          <Input
            type="text"
            value={hexInput}
            onChange={handleHexInputChange}
            placeholder="#000000"
            className="h-8 w-24 text-sm"
            autoFocus={autoFocus}
          />
        </div>
      </div>
      <Input
        id={`color-${label}`}
        type="color"
        value={inputColor}
        onChange={handleColorChange}
        className="h-10 w-full p-1"
      />
    </div>
  );
};

export default ColorPicker;


import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Sparkles, Palette, BookOpen, Megaphone } from "lucide-react";

interface ToolSelectorProps {
  selectedTool: string;
  onSelectTool: (tool: string) => void;
}

const ToolSelector = ({ selectedTool, onSelectTool }: ToolSelectorProps) => {
  return (
    <div className="flex justify-center mb-6 sm:mb-8 px-2">
      <ToggleGroup type="single" value={selectedTool} onValueChange={(value) => value && onSelectTool(value)} className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-0 w-full max-w-4xl">
        <ToggleGroupItem value="onboarding" aria-label="White-Label Onboarding" className="flex items-center justify-center space-x-1 sm:space-x-2 px-2 sm:px-4 py-2 text-xs sm:text-sm">
          <BookOpen className="w-4 h-4 sm:w-5 sm:h-5" />
          <span className="hidden sm:inline">White-Label Onboarding</span>
          <span className="sm:hidden">Onboarding</span>
        </ToggleGroupItem>
        <ToggleGroupItem value="streamline" aria-label="Streamline Features" className="flex items-center justify-center space-x-1 sm:space-x-2 px-2 sm:px-4 py-2 text-xs sm:text-sm">
          <Sparkles className="w-4 h-4 sm:w-5 sm:h-5" />
          <span className="hidden sm:inline">Streamline Features</span>
          <span className="sm:hidden">Streamline</span>
        </ToggleGroupItem>
        <ToggleGroupItem value="branding" aria-label="Branding Tool" className="flex items-center justify-center space-x-1 sm:space-x-2 px-2 sm:px-4 py-2 text-xs sm:text-sm">
          <Palette className="w-4 h-4 sm:w-5 sm:h-5" />
          <span className="hidden sm:inline">Branding Tool</span>
          <span className="sm:hidden">Branding</span>
        </ToggleGroupItem>
        <ToggleGroupItem value="marketing" aria-label="AI Marketing" className="flex items-center justify-center space-x-1 sm:space-x-2 px-2 sm:px-4 py-2 text-xs sm:text-sm">
          <Megaphone className="w-4 h-4 sm:w-5 sm:h-5" />
          <span className="hidden sm:inline">AI Marketing</span>
          <span className="sm:hidden">Marketing</span>
        </ToggleGroupItem>
      </ToggleGroup>
    </div>
  );
};

export default ToolSelector;

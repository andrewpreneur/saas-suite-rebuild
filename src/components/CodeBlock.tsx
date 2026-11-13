
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Copy, Check, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";

interface CodeBlockProps {
  code: string;
  language?: string;
  maxHeight?: string;
}

const CodeBlock = ({ code, language = "css", maxHeight = "300px" }: CodeBlockProps) => {
  const [copied, setCopied] = useState(false);
  const [showOverlay, setShowOverlay] = useState(true);

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      toast.success(`${language.toUpperCase()} copied to clipboard!`);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      toast.error(`Failed to copy ${language.toUpperCase()} code`);
    }
  };

  return (
    <div className="relative">
      <div 
        className="bg-gray-900 text-gray-100 rounded-lg overflow-hidden"
        style={{ maxHeight }}
      >
        {showOverlay && (
          <div className="absolute inset-0 bg-gray-900/80 backdrop-blur-sm z-10 flex items-center justify-center">
            <div className="text-center space-y-4">
              <div className="flex flex-col md:flex-row space-y-2 md:space-y-0 md:space-x-2">
                <Button 
                  onClick={copyToClipboard}
                  className="bg-primary hover:bg-primary/90 text-primary-foreground"
                  size="sm"
                >
                  {copied ? <Check className="w-4 h-4 mr-2" /> : <Copy className="w-4 h-4 mr-2" />}
                  {copied ? "Copied!" : "Copy Code"}
                </Button>
                <Button 
                  onClick={() => setShowOverlay(false)}
                  variant="outline"
                  className="bg-white/10 hover:bg-white/20 text-white border-white/20"
                  size="sm"
                >
                  <Eye className="w-4 h-4 mr-2" />
                  View Code
                </Button>
              </div>
            </div>
          </div>
        )}
        
        <div className="relative">
          {!showOverlay && (
            <Button 
              onClick={() => setShowOverlay(true)}
              className="absolute top-2 right-2 z-20 bg-white/10 hover:bg-white/20 text-white border-white/20"
              size="sm"
            >
              <EyeOff className="w-4 h-4" />
            </Button>
          )}
          <pre className="p-6 overflow-auto text-sm" style={{ maxHeight }}>
            <code>{code}</code>
          </pre>
        </div>
      </div>
    </div>
  );
};

export default CodeBlock;

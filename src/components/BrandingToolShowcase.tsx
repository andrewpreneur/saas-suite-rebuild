import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Upload, Palette, Wand2, CheckCircle } from "lucide-react";
import { extractColorsFromImage } from "@/utils/colorExtraction";

const BrandingToolShowcase = () => {
  const [isDragging, setIsDragging] = useState(false);
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const [extractedColors, setExtractedColors] = useState<string[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showResult, setShowResult] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      handleFile(files[0]);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFile(file);
    }
  };

  const handleFile = async (file: File) => {
    if (!file.type.startsWith('image/')) return;
    
    setIsProcessing(true);
    setShowResult(false);
    
    // Create preview URL
    const imageUrl = URL.createObjectURL(file);
    setUploadedImage(imageUrl);
    
    try {
      // Simulate processing time for demo
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      // Extract colors (this would use the actual extraction utility in a real implementation)
      const colors = await extractColorsFromImage(file);
      setExtractedColors(colors);
      
      // Show result with animation delay
      setTimeout(() => {
        setShowResult(true);
        setIsProcessing(false);
      }, 500);
    } catch (error) {
      console.error('Error extracting colors:', error);
      setIsProcessing(false);
    }
  };

  const triggerFileSelect = () => {
    fileInputRef.current?.click();
  };

  const demoColors = ["#2563EB", "#7C3AED", "#059669", "#DC2626", "#EA580C"];

  return (
    <div className="py-16 bg-gradient-to-br from-purple-50 via-blue-50 to-indigo-50">
      <div className="max-w-6xl mx-auto px-6">
        <div className="text-center mb-12 animate-fade-in">
          <h2 className="text-4xl font-bold text-gray-900 mb-4">
            Intelligent Branding Tool
          </h2>
          <p className="text-xl text-gray-600">
            Upload your logo and instantly extract your brand colors with AI-powered precision
          </p>
        </div>

        <div className="grid lg:grid-cols-2 gap-12 items-center">
          {/* Interactive Demo */}
          <div className="space-y-6">
            <Card className="p-8 hover:shadow-xl transition-all duration-300">
              <CardContent className="p-0">
                <div
                  className={`relative border-2 border-dashed rounded-xl p-8 text-center transition-all duration-300 ${
                    isDragging
                      ? 'border-primary bg-primary/5 scale-105'
                      : uploadedImage
                      ? 'border-green-300 bg-green-50'
                      : 'border-gray-300 hover:border-primary/50 hover:bg-gray-50'
                  }`}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleFileSelect}
                    className="hidden"
                  />
                  
                  {uploadedImage ? (
                    <div className="space-y-4">
                      <div className="relative inline-block">
                        <img
                          src={uploadedImage}
                          alt="Uploaded logo"
                          className="max-w-32 max-h-32 mx-auto rounded-lg shadow-lg animate-scale-in"
                        />
                        {!isProcessing && showResult && (
                          <div className="absolute -top-2 -right-2 bg-green-500 text-white rounded-full p-1 animate-scale-in">
                            <CheckCircle className="w-4 h-4" />
                          </div>
                        )}
                      </div>
                      {isProcessing && (
                        <div className="flex items-center justify-center space-x-2">
                          <Wand2 className="w-5 h-5 text-primary animate-spin" />
                          <span className="text-sm text-gray-600">Extracting colors...</span>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div className="w-16 h-16 mx-auto bg-primary/10 rounded-full flex items-center justify-center">
                        <Upload className="w-8 h-8 text-primary" />
                      </div>
                      <div>
                        <p className="text-lg font-medium text-gray-900 mb-2">
                          Drop your logo here
                        </p>
                        <p className="text-sm text-gray-500 mb-4">
                          Or click to browse files
                        </p>
                        <Button onClick={triggerFileSelect} variant="outline">
                          Choose File
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Color Palette Display */}
            {(extractedColors.length > 0 || (!uploadedImage && !isProcessing)) && (
              <Card className="p-6 animate-fade-in">
                <div className="flex items-center space-x-3 mb-4">
                  <Palette className="w-5 h-5 text-primary" />
                  <h3 className="text-lg font-semibold text-gray-900">
                    {extractedColors.length > 0 ? 'Extracted Colors' : 'Demo Colors'}
                  </h3>
                </div>
                <div className="flex flex-wrap gap-3">
                  {(extractedColors.length > 0 ? extractedColors : demoColors).map((color, index) => (
                    <div
                      key={index}
                      className="group cursor-pointer animate-scale-in"
                      style={{ animationDelay: `${index * 100}ms` }}
                    >
                      <div
                        className="w-16 h-16 rounded-lg shadow-md border-2 border-white group-hover:scale-110 transition-transform duration-200"
                        style={{ backgroundColor: color }}
                      />
                      <p className="text-xs text-gray-600 text-center mt-2 font-mono">
                        {color}
                      </p>
                    </div>
                  ))}
                </div>
              </Card>
            )}
          </div>

          {/* Features List */}
          <div className="space-y-6">
            <div className="space-y-4">
              <div className="flex items-start space-x-4 animate-fade-in">
                <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0 mt-1">
                  <Upload className="w-4 h-4 text-blue-600" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-1">
                    Smart Logo Upload
                  </h3>
                  <p className="text-gray-600">
                    Simply drag and drop your logo or website screenshot to get started instantly
                  </p>
                </div>
              </div>

              <div className="flex items-start space-x-4 animate-fade-in">
                <div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center flex-shrink-0 mt-1">
                  <Wand2 className="w-4 h-4 text-purple-600" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-1">
                    AI-Powered Color Extraction
                  </h3>
                  <p className="text-gray-600">
                    Advanced algorithms identify your dominant brand colors with perfect accuracy
                  </p>
                </div>
              </div>

              <div className="flex items-start space-x-4 animate-fade-in">
                <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0 mt-1">
                  <Palette className="w-4 h-4 text-green-600" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-1">
                    Instant Theme Application
                  </h3>
                  <p className="text-gray-600">
                    Apply your brand colors across your entire HighLevel interface instantly
                  </p>
                </div>
              </div>

              <div className="flex items-start space-x-4 animate-fade-in">
                <div className="w-8 h-8 bg-orange-100 rounded-full flex items-center justify-center flex-shrink-0 mt-1">
                  <CheckCircle className="w-4 h-4 text-orange-600" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-1">
                    Perfect Brand Consistency
                  </h3>
                  <p className="text-gray-600">
                    Ensure your white-label solution matches your brand perfectly every time
                  </p>
                </div>
              </div>
            </div>

            <div className="pt-6">
              <Button 
                size="lg"
                className="w-full"
                onClick={() => document.getElementById('access-options')?.scrollIntoView({ behavior: 'smooth' })}
              >
                Try Branding Tool
                <Wand2 className="w-5 h-5 ml-2" />
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BrandingToolShowcase;
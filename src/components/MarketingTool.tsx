import { useState, useRef, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Palette, Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { useUser } from "@/contexts/UserContext";
import { UserDataStore } from "@/lib/userDataStore";
import { supabase } from "@/integrations/supabase/client";
import { Checkbox } from "@/components/ui/checkbox";

interface MarketingToolProps {
  onReset: () => void;
}

interface AIOfferData {
  targeting: string;
  situation: string;
  solution: string;
  shortVersion: string;
  longVersion: string;
  headline: string;
  subheadline: string;
}

interface EmailData {
  subject: string;
  body: string;
}

const MarketingTool = ({ onReset }: MarketingToolProps) => {
  const { email } = useUser();
  const [activeTab, setActiveTab] = useState("ai-offer");
  const [isGenerating, setIsGenerating] = useState(false);
  const [isGeneratingEmails, setIsGeneratingEmails] = useState(false);
  const [generatedEmails, setGeneratedEmails] = useState<Record<string, EmailData>>({});
  const [includeContactCity, setIncludeContactCity] = useState(true);
  
  const [aiOfferData, setAiOfferData] = useState<AIOfferData>({
    targeting: "",
    situation: "",
    solution: "",
    shortVersion: "",
    longVersion: "",
    headline: "",
    subheadline: ""
  });

  // Load saved data from database on component mount
  useEffect(() => {
    const loadSavedData = async () => {
      if (!email) return;
      
      try {
        const { data, error } = await supabase.rpc('get_marketing_data', {
          user_email: email
        });

        if (error) {
          console.error('Error loading marketing data:', error);
          return;
        }

        if (data && data.length > 0) {
          const savedData = data[0] as any;
          
          // Load input fields
          setAiOfferData(prev => ({
            ...prev,
            targeting: savedData.targeting || '',
            situation: savedData.situation || '',
            solution: savedData.solution || ''
          }));

          // Load AI Offer data if exists
          if (savedData.ai_offer_data && typeof savedData.ai_offer_data === 'object' && Object.keys(savedData.ai_offer_data).length > 0) {
            const offerData = savedData.ai_offer_data as any;
            setAiOfferData(prev => ({
              ...prev,
              shortVersion: offerData.shortVersion || '',
              longVersion: offerData.longVersion || '',
              headline: offerData.headline || '',
              subheadline: offerData.subheadline || ''
            }));
          }

          // Load AI Email data if exists
          if (savedData.ai_email_data && typeof savedData.ai_email_data === 'object' && Object.keys(savedData.ai_email_data).length > 0) {
            setGeneratedEmails(savedData.ai_email_data as Record<string, EmailData>);
          }

          // Show success message if there's data
          if (savedData.targeting || savedData.situation || savedData.solution) {
            toast.success("Your previous data has been restored!");
          }
        }
      } catch (error) {
        console.error('Error loading saved data:', error);
      }
    };

    loadSavedData();
  }, [email]);

  // Save current inputs to database
  const saveCurrentInputs = async () => {
    if (!email) return;
    
    console.log('Saving inputs:', {
      targeting: aiOfferData.targeting,
      situation: aiOfferData.situation,
      solution: aiOfferData.solution
    });
    
    try {
      const { error } = await supabase.rpc('save_marketing_data', {
        user_email: email,
        targeting_input: aiOfferData.targeting.trim() || null,
        situation_input: aiOfferData.situation.trim() || null,
        solution_input: aiOfferData.solution.trim() || null
      });
      
      if (error) {
        console.error('Error saving inputs:', error);
      } else {
        console.log('Inputs saved successfully');
      }
    } catch (error) {
      console.error('Error saving inputs:', error);
    }
  };

  const generateAIOffer = async () => {
    if (!aiOfferData.targeting.trim() || !aiOfferData.situation.trim() || !aiOfferData.solution.trim()) {
      toast.error("Please fill in all three fields first");
      return;
    }

    setIsGenerating(true);
    try {
      // Save inputs first
      await saveCurrentInputs();

      const { data, error } = await supabase.functions.invoke('generate-ai-offer', {
        body: {
          targeting: aiOfferData.targeting,
          situation: aiOfferData.situation,
          solution: aiOfferData.solution
        }
      });

      if (error) {
        throw error;
      }

      const newOfferData = {
        shortVersion: data.shortVersion,
        longVersion: data.longVersion,
        headline: data.headline,
        subheadline: data.subheadline
      };

      setAiOfferData(prev => ({
        ...prev,
        ...newOfferData
      }));

      // Save only the AI-generated offer data
      console.log('Saving offer data:', newOfferData);
      const { error: saveError } = await supabase.rpc('save_marketing_data', {
        user_email: email,
        offer_data: newOfferData
      });

      if (saveError) {
        console.error('Error saving offer data:', saveError);
      } else {
        console.log('Offer data saved successfully');
      }

      toast.success("AI offer generated successfully!");
    } catch (error) {
      console.error('Error generating AI offer:', error);
      toast.error("Failed to generate offer. Please try again.");
    } finally {
      setIsGenerating(false);
    }
  };

  const generateAIEmails = async () => {
    if (!aiOfferData.targeting.trim() || !aiOfferData.situation.trim() || !aiOfferData.solution.trim()) {
      toast.error("Please fill in all three fields first");
      return;
    }

    setIsGeneratingEmails(true);
    try {
      // Save inputs first
      await saveCurrentInputs();

      const { data, error } = await supabase.functions.invoke('generate-ai-email', {
        body: {
          targeting: aiOfferData.targeting,
          situation: aiOfferData.situation,
          solution: aiOfferData.solution,
          includeContactCity: includeContactCity
        }
      });

      if (error) {
        throw error;
      }

      setGeneratedEmails(data);

      // Save only the AI-generated email data
      console.log('Saving email data:', data);
      const { error: saveError } = await supabase.rpc('save_marketing_data', {
        user_email: email,
        email_data: data
      });

      if (saveError) {
        console.error('Error saving email data:', saveError);
      } else {
        console.log('Email data saved successfully');
      }

      toast.success("Email sequence generated successfully!");
    } catch (error) {
      console.error('Error generating emails:', error);
      toast.error("Failed to generate emails. Please try again.");
    } finally {
      setIsGeneratingEmails(false);
    }
  };

  const resetForm = () => {
    setAiOfferData({
      targeting: "",
      situation: "",
      solution: "",
      shortVersion: "",
      longVersion: "",
      headline: "",
      subheadline: ""
    });
    setGeneratedEmails({});
  };

  return (
    <div className="max-w-4xl mx-auto space-y-4 sm:space-y-8 px-2 sm:px-0">
      <Card>
        <CardHeader className="pb-4 sm:pb-6">
          <CardTitle className="flex items-center text-lg sm:text-xl">
            <Palette className="w-4 h-4 sm:w-5 sm:h-5 mr-2" />
            AI Marketing Tool
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="ai-offer">AI Offer</TabsTrigger>
              <TabsTrigger value="ai-email">AI Email</TabsTrigger>
            </TabsList>
            
            <TabsContent value="ai-offer" className="space-y-6 mt-6">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="targeting">Who is your offer targeting?</Label>
                  <Textarea
                    id="targeting"
                    placeholder="e.g., Small business owners in the fitness industry"
                    value={aiOfferData.targeting}
                    onChange={(e) => setAiOfferData(prev => ({ ...prev, targeting: e.target.value }))}
                    onBlur={saveCurrentInputs}
                    className="min-h-[80px]"
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="situation">What is their current situation?</Label>
                  <Textarea
                    id="situation"
                    placeholder="e.g., Struggling to generate consistent leads online"
                    value={aiOfferData.situation}
                    onChange={(e) => setAiOfferData(prev => ({ ...prev, situation: e.target.value }))}
                    onBlur={saveCurrentInputs}
                    className="min-h-[80px]"
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="solution">What is your service/solution?</Label>
                  <Textarea
                    id="solution"
                    placeholder="e.g., Done-for-you Facebook ad campaigns with conversion optimization"
                    value={aiOfferData.solution}
                    onChange={(e) => setAiOfferData(prev => ({ ...prev, solution: e.target.value }))}
                    onBlur={saveCurrentInputs}
                    className="min-h-[80px]"
                  />
                </div>
                
                <div className="flex gap-3">
                  <Button 
                    onClick={generateAIOffer} 
                    disabled={isGenerating}
                    className="flex items-center gap-2"
                  >
                    {isGenerating ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Sparkles className="w-4 h-4" />
                    )}
                    {isGenerating ? "Generating..." : "Generate AI Offer"}
                  </Button>
                  
                  {(aiOfferData.shortVersion || aiOfferData.longVersion) && (
                    <>
                      <Button 
                        onClick={generateAIOffer} 
                        disabled={isGenerating}
                        variant="outline"
                        className="flex items-center gap-2"
                      >
                        {isGenerating ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Sparkles className="w-4 h-4" />
                        )}
                        Regenerate
                      </Button>
                      <Button variant="outline" onClick={resetForm}>
                        Start Over
                      </Button>
                    </>
                  )}
                </div>
              </div>
              
              {(aiOfferData.shortVersion || aiOfferData.longVersion || aiOfferData.headline) && (
                <div className="space-y-6 border-t pt-6">
                  <h3 className="text-xl font-semibold">Generated Offer Copy</h3>
                  
                  {aiOfferData.headline && (
                    <div className="space-y-2">
                      <h4 className="font-medium text-primary">Headline</h4>
                      <div className="p-4 bg-muted rounded-lg">
                        <p className="font-semibold">{aiOfferData.headline}</p>
                      </div>
                    </div>
                  )}
                  
                  {aiOfferData.subheadline && (
                    <div className="space-y-2">
                      <h4 className="font-medium text-primary">Sub-headline</h4>
                      <div className="p-4 bg-muted rounded-lg">
                        <p>{aiOfferData.subheadline}</p>
                      </div>
                    </div>
                  )}
                  
                  {aiOfferData.shortVersion && (
                    <div className="space-y-2">
                      <h4 className="font-medium text-primary">Short Version</h4>
                      <div className="p-4 bg-muted rounded-lg">
                        <p>{aiOfferData.shortVersion}</p>
                      </div>
                    </div>
                  )}
                  
                  {aiOfferData.longVersion && (
                    <div className="space-y-2">
                      <h4 className="font-medium text-primary">Long Version</h4>
                      <div className="p-4 bg-muted rounded-lg">
                        <p>{aiOfferData.longVersion}</p>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </TabsContent>
            
            <TabsContent value="ai-email" className="mt-6">
              <div className="space-y-6">
                <div className="text-center">
                  <h3 className="text-2xl font-semibold mb-2">AI Email Generator</h3>
                  <p className="text-muted-foreground max-w-md mx-auto">
                    Generate a 6-email cold outreach sequence using your targeting, situation, and solution
                  </p>
                </div>
                
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="email-targeting">Who is your offer targeting?</Label>
                    <Textarea
                      id="email-targeting"
                      placeholder="e.g., Small business owners in the fitness industry"
                      value={aiOfferData.targeting}
                      onChange={(e) => setAiOfferData(prev => ({ ...prev, targeting: e.target.value }))}
                      onBlur={saveCurrentInputs}
                      className="min-h-[80px]"
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="email-situation">What is their current situation?</Label>
                    <Textarea
                      id="email-situation"
                      placeholder="e.g., Struggling to generate consistent leads online"
                      value={aiOfferData.situation}
                      onChange={(e) => setAiOfferData(prev => ({ ...prev, situation: e.target.value }))}
                      onBlur={saveCurrentInputs}
                      className="min-h-[80px]"
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="email-solution">What is your service/solution?</Label>
                    <Textarea
                      id="email-solution"
                      placeholder="e.g., Done-for-you Facebook ad campaigns with conversion optimization"
                      value={aiOfferData.solution}
                      onChange={(e) => setAiOfferData(prev => ({ ...prev, solution: e.target.value }))}
                      onBlur={saveCurrentInputs}
                      className="min-h-[80px]"
                    />
                  </div>

                  <div className="flex items-center space-x-2 p-3 bg-muted rounded-lg">
                    <Checkbox
                      id="include-city"
                      checked={includeContactCity}
                      onCheckedChange={(checked) => setIncludeContactCity(!!checked)}
                    />
                    <Label htmlFor="include-city" className="text-sm cursor-pointer">
                      Include Contact City in emails
                    </Label>
                  </div>
                  
                  <div className="flex gap-3">
                    <Button 
                      onClick={generateAIEmails} 
                      disabled={isGeneratingEmails}
                      className="flex items-center gap-2"
                    >
                      {isGeneratingEmails ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Sparkles className="w-4 h-4" />
                      )}
                      {isGeneratingEmails ? "Generating..." : "Generate Email Sequence"}
                    </Button>
                    
                    {Object.keys(generatedEmails).length > 0 && (
                      <>
                        <Button 
                          onClick={generateAIEmails} 
                          disabled={isGeneratingEmails}
                          variant="outline"
                          className="flex items-center gap-2"
                        >
                          {isGeneratingEmails ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Sparkles className="w-4 h-4" />
                          )}
                          Regenerate
                        </Button>
                        <Button variant="outline" onClick={resetForm}>
                          Start Over
                        </Button>
                      </>
                    )}
                  </div>
                </div>
                
                {Object.keys(generatedEmails).length > 0 && (
                  <div className="space-y-6 border-t pt-6">
                    <h3 className="text-xl font-semibold">Generated Email Sequence</h3>
                    
                    {Object.entries(generatedEmails).map(([key, emailData], index) => (
                      <div key={key} className="space-y-2">
                        <h4 className="font-medium text-primary">Email {index + 1}</h4>
                        <div className="p-4 bg-muted rounded-lg space-y-3">
                          <div>
                            <p className="text-sm font-semibold text-muted-foreground mb-1">Subject:</p>
                            <p className="font-medium">{emailData.subject}</p>
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-muted-foreground mb-1">Body:</p>
                            <p className="whitespace-pre-wrap">{emailData.body}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
};

export default MarketingTool;
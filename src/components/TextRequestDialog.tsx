import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Check } from "lucide-react";

interface TextRequestDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  source: "home" | "webinar" | "pricing";
}

const TextRequestDialog = ({ open, onOpenChange, source }: TextRequestDialogProps) => {
  const [name, setName] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [countryCode, setCountryCode] = useState("+1");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const formatPhoneNumber = (value: string, countryCode: string): string => {
    const numbers = value.replace(/[^0-9]/g, '');
    
    switch (countryCode) {
      case '+1': // US/Canada
        if (numbers.length <= 3) return numbers;
        if (numbers.length <= 6) return `(${numbers.slice(0, 3)}) ${numbers.slice(3)}`;
        return `(${numbers.slice(0, 3)}) ${numbers.slice(3, 6)}-${numbers.slice(6, 10)}`;
      
      case '+44': // UK
        if (numbers.length <= 4) return numbers;
        if (numbers.length <= 7) return `${numbers.slice(0, 4)} ${numbers.slice(4)}`;
        return `${numbers.slice(0, 4)} ${numbers.slice(4, 7)} ${numbers.slice(7, 11)}`;
      
      case '+61': // Australia
        if (numbers.length <= 4) return numbers;
        if (numbers.length <= 7) return `${numbers.slice(0, 4)} ${numbers.slice(4)}`;
        return `${numbers.slice(0, 4)} ${numbers.slice(4, 7)} ${numbers.slice(7, 10)}`;
      
      case '+91': // India
        if (numbers.length <= 5) return numbers;
        return `${numbers.slice(0, 5)} ${numbers.slice(5, 10)}`;
      
      case '+86': // China
        if (numbers.length <= 3) return numbers;
        if (numbers.length <= 7) return `${numbers.slice(0, 3)} ${numbers.slice(3)}`;
        return `${numbers.slice(0, 3)} ${numbers.slice(3, 7)} ${numbers.slice(7, 11)}`;
      
      case '+81': // Japan
        if (numbers.length <= 3) return numbers;
        if (numbers.length <= 7) return `${numbers.slice(0, 3)}-${numbers.slice(3)}`;
        return `${numbers.slice(0, 3)}-${numbers.slice(3, 7)}-${numbers.slice(7, 11)}`;
      
      case '+49': // Germany
        if (numbers.length <= 3) return numbers;
        return `${numbers.slice(0, 3)} ${numbers.slice(3, 11)}`;
      
      case '+33': // France
        if (numbers.length <= 1) return numbers;
        if (numbers.length <= 3) return `${numbers.slice(0, 1)} ${numbers.slice(1)}`;
        if (numbers.length <= 5) return `${numbers.slice(0, 1)} ${numbers.slice(1, 3)} ${numbers.slice(3)}`;
        if (numbers.length <= 7) return `${numbers.slice(0, 1)} ${numbers.slice(1, 3)} ${numbers.slice(3, 5)} ${numbers.slice(5)}`;
        return `${numbers.slice(0, 1)} ${numbers.slice(1, 3)} ${numbers.slice(3, 5)} ${numbers.slice(5, 7)} ${numbers.slice(7, 9)}`;
      
      case '+39': // Italy
        if (numbers.length <= 3) return numbers;
        if (numbers.length <= 6) return `${numbers.slice(0, 3)} ${numbers.slice(3)}`;
        return `${numbers.slice(0, 3)} ${numbers.slice(3, 6)} ${numbers.slice(6, 10)}`;
      
      case '+34': // Spain
        if (numbers.length <= 3) return numbers;
        if (numbers.length <= 6) return `${numbers.slice(0, 3)} ${numbers.slice(3)}`;
        return `${numbers.slice(0, 3)} ${numbers.slice(3, 6)} ${numbers.slice(6, 9)}`;
      
      case '+52': // Mexico
        if (numbers.length <= 2) return numbers;
        if (numbers.length <= 6) return `${numbers.slice(0, 2)} ${numbers.slice(2)}`;
        return `${numbers.slice(0, 2)} ${numbers.slice(2, 6)} ${numbers.slice(6, 10)}`;
      
      case '+55': // Brazil
        if (numbers.length <= 2) return numbers;
        if (numbers.length <= 7) return `(${numbers.slice(0, 2)}) ${numbers.slice(2)}`;
        return `(${numbers.slice(0, 2)}) ${numbers.slice(2, 7)}-${numbers.slice(7, 11)}`;
      
      default:
        return numbers;
    }
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatPhoneNumber(e.target.value, countryCode);
    setPhoneNumber(formatted);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!name.trim()) {
      toast.error("Please enter your name");
      return;
    }
    
    if (!phoneNumber.trim()) {
      toast.error("Please enter your phone number");
      return;
    }
    
    // Validate phone number (digits only)
    const cleanNumber = phoneNumber.replace(/[^0-9]/g, '');
    const phoneRegex = /^[0-9]{7,15}$/;
    if (!phoneRegex.test(cleanNumber)) {
      toast.error("Please enter a valid phone number");
      return;
    }
    
    setIsSubmitting(true);
    
    try {
      const fullPhoneNumber = `${countryCode}${cleanNumber}`;
      
      const { error } = await supabase
        .from('text_requests')
        .insert([{ 
          name: name.trim(),
          phone_number: fullPhoneNumber,
          source: source
        }]);
      
      if (error) throw error;
      
      setIsSuccess(true);
      setName("");
      setPhoneNumber("");
      setCountryCode("+1");
    } catch (error) {
      console.error('Error submitting request:', error);
      toast.error("Something went wrong. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    onOpenChange(false);
    // Reset state after dialog closes
    setTimeout(() => {
      setIsSuccess(false);
      setName("");
      setPhoneNumber("");
      setCountryCode("+1");
    }, 300);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        {!isSuccess ? (
          <>
            <DialogHeader>
              <DialogTitle className="text-2xl font-bold text-center">Want to Learn More?</DialogTitle>
              <DialogDescription className="text-center">
                Enter your phone number and I'll text you with more information about SaaSSuite, 
                including pricing, features, and how it can help your agency.
              </DialogDescription>
            </DialogHeader>
            
            <form onSubmit={handleSubmit} className="space-y-4 mt-4">
              <Input 
                type="text" 
                placeholder="First name" 
                value={name} 
                onChange={(e) => setName(e.target.value)}
                className="text-lg h-12" 
                disabled={isSubmitting}
                required
              />
              
              <div className="flex gap-2">
                <Select value={countryCode} onValueChange={setCountryCode}>
                  <SelectTrigger className="w-[70px] h-12 text-lg">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="+1">🇺🇸 +1</SelectItem>
                    <SelectItem value="+44">🇬🇧 +44</SelectItem>
                    <SelectItem value="+61">🇦🇺 +61</SelectItem>
                    <SelectItem value="+91">🇮🇳 +91</SelectItem>
                    <SelectItem value="+86">🇨🇳 +86</SelectItem>
                    <SelectItem value="+81">🇯🇵 +81</SelectItem>
                    <SelectItem value="+49">🇩🇪 +49</SelectItem>
                    <SelectItem value="+33">🇫🇷 +33</SelectItem>
                    <SelectItem value="+39">🇮🇹 +39</SelectItem>
                    <SelectItem value="+34">🇪🇸 +34</SelectItem>
                    <SelectItem value="+52">🇲🇽 +52</SelectItem>
                    <SelectItem value="+55">🇧🇷 +55</SelectItem>
                  </SelectContent>
                </Select>
                
                <Input 
                  type="tel" 
                  placeholder="Phone number" 
                  value={phoneNumber} 
                  onChange={handlePhoneChange}
                  className="text-lg h-12 flex-1" 
                  disabled={isSubmitting}
                  maxLength={20}
                />
              </div>
              
              <Button 
                type="submit" 
                className="w-full h-12 text-lg bg-primary hover:bg-primary/90" 
                disabled={isSubmitting}
              >
                {isSubmitting ? "Submitting..." : "Send Me More Info"}
              </Button>
            </form>
          </>
        ) : (
          <div className="text-center py-8 space-y-4">
            <div className="flex justify-center">
              <div className="rounded-full bg-green-500/10 p-3">
                <Check className="w-12 h-12 text-green-500" />
              </div>
            </div>
            <DialogTitle className="text-2xl font-bold">Thank You!</DialogTitle>
            <DialogDescription className="text-lg">
              Check your texts! I'll send you more information about SaaSSuite shortly.
            </DialogDescription>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default TextRequestDialog;

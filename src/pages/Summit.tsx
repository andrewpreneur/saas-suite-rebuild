import { useState } from "react";
import { useMetaPixel } from "@/hooks/useMetaPixel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import TestimonialsCarousel from "@/components/TestimonialsCarousel";
import Footer from "@/components/Footer";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Check, ArrowDown } from "lucide-react";
import andrewPhoto from "@/assets/andrew-george.png";
import { Link } from "react-router-dom";
const Summit = () => {
  useMetaPixel();
  const [name, setName] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [countryCode, setCountryCode] = useState("+1");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const scrollToForm = () => {
    const formElement = document.getElementById("learn-more-form");
    formElement?.scrollIntoView({ behavior: "smooth", block: "center" });
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
      const cleanNumber = phoneNumber.replace(/[^0-9]/g, '');
      const fullPhoneNumber = `${countryCode}${cleanNumber}`;
      const { error } = await supabase.from('levelup_connections').insert([{
        name: name.trim(),
        phone_number: fullPhoneNumber
      }]);
      if (error) throw error;
      setIsSuccess(true);
    } catch (error) {
      console.error('Error submitting phone:', error);
      toast.error("Something went wrong. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

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
        if (numbers.length <= 5) return `${numbers.slice(0, 3)} ${numbers.slice(3)}`;
        if (numbers.length <= 7) return `${numbers.slice(0, 3)} ${numbers.slice(3, 5)} ${numbers.slice(5)}`;
        return `${numbers.slice(0, 3)} ${numbers.slice(3, 5)} ${numbers.slice(5, 7)} ${numbers.slice(7, 9)}`;
      
      case '+52': // Mexico
        if (numbers.length <= 3) return numbers;
        if (numbers.length <= 6) return `${numbers.slice(0, 3)} ${numbers.slice(3)}`;
        return `${numbers.slice(0, 3)} ${numbers.slice(3, 6)} ${numbers.slice(6, 10)}`;
      
      case '+55': // Brazil
        if (numbers.length <= 2) return numbers;
        if (numbers.length <= 7) return `(${numbers.slice(0, 2)}) ${numbers.slice(2)}`;
        return `(${numbers.slice(0, 2)}) ${numbers.slice(2, 7)}-${numbers.slice(7, 11)}`;
      
      default:
        return numbers;
    }
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/[^0-9]/g, '');
    const formatted = formatPhoneNumber(value, countryCode);
    setPhoneNumber(formatted);
  };
  return <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card">
        <div className="max-w-6xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <img src="/assets/saassuite-logo.png" alt="SaaSSuite Logo" className="w-10 h-10" />
              <h1 className="text-2xl font-bold text-foreground">SaaSSuite</h1>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-6xl mx-auto px-6 py-12">
        {/* Hero Section */}
        <section className="text-center mb-8">
          <h1 className="text-4xl md:text-5xl font-bold text-foreground animate-[fadeInFromBlur_0.8s_ease-out]">
            Nice Meeting You at LevelUp Summit! 🎉
          </h1>
        </section>

        {/* Learn More Section */}
        <section id="learn-more-form" className="max-w-2xl mx-auto mb-20">
          <div className="bg-card border border-border rounded-lg shadow-lg p-8 animate-[fadeInFromBlur_1s_ease-out]">
            {!isSuccess ? (
              <>
                <h2 className="text-3xl font-bold text-foreground text-center mb-4">
                  Want to Learn More?
                </h2>
                <p className="text-center text-muted-foreground mb-8">
                  Enter your phone number and I'll text you with more information about SaaSSuite, 
                  including pricing, features, and how it can help your agency.
                </p>
                
                <form onSubmit={handleSubmit} className="space-y-4">
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
                  <Button type="submit" className="w-full h-12 text-lg bg-primary hover:bg-primary/90" disabled={isSubmitting}>
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
                <h2 className="text-3xl font-bold text-foreground">Thank You!</h2>
                <p className="text-lg text-muted-foreground">
                  Check your texts! I'll send you more information about SaaSSuite shortly.
                </p>
              </div>
            )}
          </div>
        </section>

        {/* Introduction Section */}
        <section className="mb-20">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div>
              <img src={andrewPhoto} alt="Andrew George" className="rounded-lg shadow-xl w-full max-w-md mx-auto" />
            </div>
            <div>
              <h2 className="text-3xl font-bold text-foreground mb-6">
                Hi, I'm Andrew George
              </h2>
              <div className="space-y-4 text-muted-foreground">
                <p className="text-lg">
                  I've been creating HighLevel content for over 2 years and running my own agency for more than 5 years. 
                  Through this journey, I've learned exactly what agency owners need to succeed with GoHighLevel.
                </p>
                <p className="text-lg">
                  That's why I built <span className="font-semibold text-foreground">SaaSSuite</span> — a comprehensive toolkit 
                  designed to streamline your HighLevel experience with powerful white-label tools and automation.
                </p>
                <p className="text-lg">
                  Whether you're just getting started or scaling your agency, SaaSSuite gives you instant access to 
                  white-labeled CSS, launchpad installs, onboarding videos, and AI-powered assistance that actually 
                  understands GoHighLevel.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Scroll to Form Button */}
        <div className="text-center mb-20">
          <Button 
            onClick={scrollToForm}
            variant="outline"
            size="lg"
            className="gap-2"
          >
            Learn More
            <ArrowDown className="w-4 h-4" />
          </Button>
        </div>

        {/* Testimonials */}
        <section className="mb-20">
          <TestimonialsCarousel />
        </section>

        {/* Book a Call CTA */}
        <section className="max-w-4xl mx-auto mb-20">
          <div className="bg-gradient-to-r from-primary/10 to-primary/5 border border-primary/20 rounded-lg p-12 text-center">
            <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
              Ready to Get Started?
            </h2>
            <p className="text-lg text-muted-foreground mb-8 max-w-2xl mx-auto">
              Book a call with me to discuss how SaaSSuite can transform your agency's workflow 
              and help you deliver exceptional results to your clients.
            </p>
            <Link to="/book">
              <Button size="lg" className="text-lg px-8 h-14">
                Book a Call Now
              </Button>
            </Link>
          </div>
        </section>
      </main>

      <Footer />
    </div>;
};
export default Summit;
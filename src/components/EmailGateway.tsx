
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useUser } from "@/contexts/UserContext";
import { toast } from "sonner";
import { ExternalLink, X } from "lucide-react";

interface EmailGatewayProps {
  onEmailSubmitted: () => void;
}

const EmailGateway = ({ onEmailSubmitted }: EmailGatewayProps) => {
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showApprovalDialog, setShowApprovalDialog] = useState(false);
  const { setUser } = useUser();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email.trim()) {
      toast.error("Please enter your email address");
      return;
    }

    setIsLoading(true);

    try {
      const emailLower = email.trim().toLowerCase();
      
      // Check if user already exists using secure function
      const { data: existingUsers, error: fetchError } = await supabase.rpc('get_user_by_email', {
        user_email: emailLower
      });

      if (fetchError) {
        throw fetchError;
      }

      let userData;
      const existingUser = existingUsers?.[0];

      if (existingUser) {
        // Update last_accessed for existing user using secure function
        const updateSuccess = await supabase.rpc('update_user_access', {
          user_email: emailLower
        });

        if (!updateSuccess.data) {
          throw new Error('Failed to update user access');
        }
        
        userData = existingUser;
        toast.success("Welcome back!");
      } else {
        // Create new user using secure function
        const { data: newUserId, error: insertError } = await supabase.rpc('register_user_safe', {
          user_email: emailLower,
          user_approval: 'PENDING'
        });

        if (insertError) throw insertError;
        
        // Get the newly created user data
        const { data: newUserData, error: newUserError } = await supabase.rpc('get_user_by_email', {
          user_email: emailLower
        });

        if (newUserError) throw newUserError;
        userData = newUserData?.[0];
        toast.success("Welcome! Your account has been created.");
      }

      // Set user in context
      setUser(userData.email, userData.id, userData.approval);
      
      if (userData.approval === "NO") {
        setShowApprovalDialog(true);
      } else {
        onEmailSubmitted();
        toast.success(existingUser ? "Welcome back! Access granted." : "Welcome! Access granted.");
      }

    } catch (error) {
      console.error('Error handling email submission:', error);
      toast.error("Something went wrong. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-white flex items-center justify-center px-6">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="flex items-center justify-center mb-4">
              <img 
                src="/lovable-uploads/f3f326f8-20fd-4406-a246-f4b2dbc34614.png" 
                alt="SaaSSuite Logo" 
                className="w-12 h-12"
              />
            </div>
            <CardTitle className="text-2xl font-bold text-gray-900">
              Welcome to SaaSSuite
            </CardTitle>
            <CardDescription className="text-gray-600">
              Enter your email to access the HighLevel White-Label Tool
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Input
                  type="email"
                  placeholder="Enter your email address"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={isLoading}
                  className="w-full"
                />
              </div>
              <Button 
                type="submit" 
                className="w-full" 
                disabled={isLoading}
              >
                {isLoading ? "Processing..." : "Continue"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>

      {/* Approval Required Dialog */}
      <Dialog open={showApprovalDialog} onOpenChange={setShowApprovalDialog}>
        <DialogContent className="sm:max-w-md bg-white/95 backdrop-blur-sm border border-gray-200">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-gray-900">
              Approval Required
            </DialogTitle>
            <DialogDescription className="text-gray-600">
              Your account is pending approval to access SaaSSuite
            </DialogDescription>
          </DialogHeader>
          <div className="text-center space-y-4">
            <p className="text-sm text-gray-700">
              To get access to SaaSSuite, sign up, upgrade, or transfer your agency through our affiliate links below.
            </p>
            <Button 
              asChild 
              variant="default" 
              className="w-full"
            >
              <a 
                href="https://howtousehighlevel.com/go" 
                target="_blank" 
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center"
              >
                Get Access
                <ExternalLink className="w-4 h-4 ml-2" />
              </a>
            </Button>
            <p className="text-sm text-gray-500">
              Once approved, you'll be able to access all SaaSSuite features.
            </p>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default EmailGateway;

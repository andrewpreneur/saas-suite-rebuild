import { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { navigateWithParams } from "@/utils/preserveParams";
import { LEARNING_HUB_PATH } from "@/lib/onboardingArrival";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
} from "@/components/ui/alert-dialog";
import { CheckCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export const ConfirmationDialog = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [isOpen, setIsOpen] = useState(false);
  const [animateIn, setAnimateIn] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const confirmed = searchParams.get('confirmed');
    if (confirmed === 'true') {
      setIsOpen(true);
      requestAnimationFrame(() => setAnimateIn(true));

      // After 2s animation, check auth state and route accordingly
      const timer = setTimeout(async () => {
        setIsOpen(false);
        const newParams = new URLSearchParams(searchParams);
        newParams.delete('confirmed');
        setSearchParams(newParams, { replace: true });

        // Check if user has an active auth session (i.e. they already have an account)
        const { data: { session } } = await supabase.auth.getSession();

        if (session?.user) {
          // User is logged in — check if they need initial questions
          const userEmail = session.user.email;
          const { data } = await supabase.rpc('get_user_initial_questions_status', {
            user_email: userEmail || ''
          });
          
          if (!data) {
            window.location.href = navigateWithParams(LEARNING_HUB_PATH);
          } else {
            window.location.href = navigateWithParams("/app");
          }
        } else {
          // No auth session — new user, send to signup
          window.location.href = navigateWithParams("/signup");
        }
      }, 2000);

      return () => clearTimeout(timer);
    }
  }, []);

  return (
    <AlertDialog open={isOpen}>
      <AlertDialogContent className="sm:max-w-md">
        <AlertDialogHeader className="text-center">
          <div
            className={`mx-auto w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mb-4 transition-all duration-500 ease-out ${
              animateIn ? "scale-100 opacity-100" : "scale-50 opacity-0"
            }`}
          >
            <CheckCircle
              className={`w-12 h-12 text-green-500 transition-all duration-500 delay-200 ease-out ${
                animateIn ? "scale-100 opacity-100" : "scale-0 opacity-0"
              }`}
            />
          </div>
          <AlertDialogTitle className="text-xl font-semibold text-center">
            Payment Successful!
          </AlertDialogTitle>
          <AlertDialogDescription className="text-center text-muted-foreground">
            Setting up your account...
          </AlertDialogDescription>
        </AlertDialogHeader>
      </AlertDialogContent>
    </AlertDialog>
  );
};

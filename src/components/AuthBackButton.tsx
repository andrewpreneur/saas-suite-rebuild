import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';

/**
 * Back button for the standalone auth screens (login / signup / auth).
 * In the iOS / Android webview there may be no in-app history (the auth
 * screen can be the first page), so fall back to the home page.
 */
const AuthBackButton = () => {
  const navigate = useNavigate();

  const goBack = () => {
    // react-router's navigate(-1) mirrors the native back gesture; when this
    // is the only entry in the webview stack, head home instead.
    if (window.history.length > 1) {
      navigate(-1);
    } else {
      navigate('/');
    }
  };

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={goBack}
      aria-label="Go back"
      className="absolute left-3 top-3 -m-1 h-8 gap-1.5 px-2 text-muted-foreground hover:text-foreground"
    >
      <ArrowLeft className="h-4 w-4" />
      <span className="text-sm font-medium">Back</span>
    </Button>
  );
};

export default AuthBackButton;

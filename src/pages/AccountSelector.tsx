import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useUser } from '@/contexts/UserContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Building2, User, ArrowRight, Loader2 } from 'lucide-react';
import { readNextPath } from '@/utils/deepLink';
import { navigateWithParams } from '@/utils/preserveParams';

interface AccountOption {
  email: string;
  type: 'own' | 'admin';
  ownerName?: string;
  agencyName?: string;
}

const AccountSelector = () => {
  const [accounts, setAccounts] = useState<AccountOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [selecting, setSelecting] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const { email, setUser, user, isLoading: authLoading } = useUser();

  useEffect(() => {
    // Wait for auth to finish loading before checking email
    if (authLoading) return;
    
    if (!email) {
      navigate('/login');
      return;
    }
    
    fetchAccounts();
  }, [email, navigate, authLoading]);

  const fetchAccounts = async () => {
    if (!email) return;
    
    setLoading(true);
    setError('');

    try {
      // Get user's own account info
      const { data: ownAccount, error: ownError } = await supabase
        .from('saas_suite_users')
        .select('email, agency_name, full_name')
        .ilike('email', email)
        .maybeSingle();

      // Get accounts where user is an admin (accepted or pending status)
      // Use ilike for case-insensitive matching
      const { data: adminAccounts, error: adminError } = await supabase
        .from('account_admins')
        .select('owner_email, admin_name, status')
        .ilike('admin_email', email)
        .in('status', ['accepted', 'pending']);

      if (adminError) {
        console.error('Error fetching admin accounts:', adminError);
      }

      const accountOptions: AccountOption[] = [];

      // Check if user is an admin of any accounts
      const isAdminOfOtherAccounts = adminAccounts && adminAccounts.length > 0;

      // Add own account if it exists and is not explicitly suspended.
      // But hide it if user is admin-only (has admin invites but no real own account setup).
      if (ownAccount && ownAccount.email) {
        const { data: approvalData } = await supabase
          .from('saas_suite_users')
          .select('approval, agency_id')
          .ilike('email', email)
          .maybeSingle();
        
        const hasRealAccount = !!approvalData?.agency_id;
        const isSuspended = approvalData?.approval === 'NO';
        
        // Only hide own account when it is explicitly suspended, or when this
        // is just an empty admin-login shell and there are owner accounts to use.
        if (!isSuspended && (hasRealAccount || !isAdminOfOtherAccounts)) {
          accountOptions.push({
            email: ownAccount.email!,
            type: 'own',
            ownerName: ownAccount.full_name || undefined,
            agencyName: ownAccount.agency_name || undefined,
          });
        }
      }

      // Add admin accounts and auto-accept pending invitations
      if (adminAccounts && adminAccounts.length > 0) {
        for (const admin of adminAccounts) {
          // Auto-accept pending invitations when the admin logs in
          if (admin.status === 'pending') {
            await supabase.rpc('admin_accept_invitation', { p_admin_email: email });
          }

          // Get the owner's account info
          const { data: ownerInfo } = await supabase
            .from('saas_suite_users')
            .select('full_name, agency_name')
            .ilike('email', admin.owner_email)
            .maybeSingle();

          accountOptions.push({
            email: admin.owner_email,
            type: 'admin',
            ownerName: ownerInfo?.full_name || admin.owner_email,
            agencyName: ownerInfo?.agency_name || undefined,
          });
        }
      }

      setAccounts(accountOptions);

      // Invite links carry ?account=<owner> — open exactly that account.
      const invited = new URLSearchParams(window.location.search).get('account')?.toLowerCase();
      const invitedMatch = invited && accountOptions.find((a) => a.email.toLowerCase() === invited);
      if (invitedMatch) {
        handleSelectAccount(invitedMatch);
      } else if (accountOptions.length === 1) {
        handleSelectAccount(accountOptions[0]);
      } else if (accountOptions.length === 0) {
        setError('No accounts found. Please contact support.');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load accounts');
    } finally {
      setLoading(false);
    }
  };

  const handleSelectAccount = async (account: AccountOption) => {
    setSelecting(true);
    setError('');

    try {
      // Store the selected account email in session storage for the app to use
      sessionStorage.setItem('selectedAccountEmail', account.email);
      
      // Update the user context with the selected account
      // The setUser function takes (email, userId, approval) but we need to 
      // update it to work with the selected account's email
      
      // Navigate to app
      navigate(readNextPath() || navigateWithParams('/app'));
    } catch (err: any) {
      setError(err.message || 'Failed to select account');
      setSelecting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/20 via-background to-secondary/20 p-4">
        <Card className="w-full max-w-md">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
            <p className="text-muted-foreground">Loading accounts...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/20 via-background to-secondary/20 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold">Select Account</CardTitle>
          <CardDescription>
            You have access to multiple accounts. Select which one you'd like to access.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="space-y-3">
            {accounts.map((account) => (
              <Button
                key={account.email}
                variant="outline"
                className="w-full h-auto py-4 px-4 flex items-center justify-between hover:bg-accent"
                onClick={() => handleSelectAccount(account)}
                disabled={selecting}
              >
                <div className="flex items-center gap-3">
                  {account.type === 'own' ? (
                    <User className="h-5 w-5 text-primary" />
                  ) : (
                    <Building2 className="h-5 w-5 text-blue-500" />
                  )}
                  <div className="text-left">
                    <div className="font-medium">
                      {account.agencyName || account.ownerName || account.email}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {account.type === 'own' ? 'Your Account' : `Admin access • ${account.email}`}
                    </div>
                  </div>
                </div>
                <ArrowRight className="h-4 w-4 text-muted-foreground" />
              </Button>
            ))}
          </div>

          <div className="pt-4 border-t">
            <Button
              variant="ghost"
              className="w-full"
              onClick={() => {
                void import("@/lib/hardSignOut").then((m) => m.hardSignOut());
                navigate('/login');
              }}
            >
              Sign out
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default AccountSelector;

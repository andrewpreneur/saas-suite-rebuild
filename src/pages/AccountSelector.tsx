import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useUser } from '@/contexts/UserContext';
import { motion } from 'framer-motion';
import { riseItem, staggerParent } from '@/lib/motion';
import { Tag } from '@/components/ui/tag';
import { EntryShell } from '@/components/premium/entry/EntryShell';
import { FormMessage } from '@/components/premium/entry/fields';
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

  const signOut = (
    <button
      type="button"
      className="font-semibold text-brand underline-offset-4 hover:text-brand-hover hover:underline"
      onClick={() => {
        void import("@/lib/hardSignOut").then((m) => m.hardSignOut());
        navigate('/login');
      }}
    >
      Sign out
    </button>
  );

  if (loading) {
    return (
      <EntryShell title="Choose an account" description="Loading the accounts you can open.">
        <div className="space-y-3" role="status" aria-label="Loading accounts">
          <div className="px-skeleton h-16 rounded-lg" />
          <div className="px-skeleton h-16 rounded-lg" />
        </div>
      </EntryShell>
    );
  }

  return (
    <EntryShell
      title="Choose an account"
      description={
        accounts.length > 0
          ? "You can open more than one account. Pick the one you want to work in."
          : "We couldn't find an account for this login."
      }
      footer={<>Wrong login? {signOut}</>}
    >
      <div className="space-y-4">
        {error && (
          <FormMessage>
            {/no accounts found/i.test(error)
              ? "No accounts are linked to this login. Sign out and use a different email, or write to support@saassuite.ai."
              : error}
          </FormMessage>
        )}

        <motion.ul variants={staggerParent} initial="hidden" animate="show" className="space-y-3">
          {accounts.map((account) => (
            <motion.li key={account.email} variants={riseItem}>
              <button
                type="button"
                className="px-surface-interactive group flex min-h-16 w-full cursor-pointer items-center gap-3 rounded-lg p-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
                onClick={() => handleSelectAccount(account)}
                disabled={selecting}
              >
                <span className="px-icon-chip shrink-0">
                  {account.type === 'own' ? (
                    <User className="size-5" aria-hidden="true" />
                  ) : (
                    <Building2 className="size-5" aria-hidden="true" />
                  )}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-small font-semibold text-foreground">
                    {account.agencyName || account.ownerName || account.email}
                  </span>
                  <span className="mt-0.5 flex min-w-0 items-center gap-2">
                    <Tag tone={account.type === 'own' ? 'brand' : 'neutral'} className="shrink-0">
                      {account.type === 'own' ? 'Your account' : 'Admin access'}
                    </Tag>
                    {account.type !== 'own' && (
                      <span className="truncate text-caption font-normal text-muted-foreground">{account.email}</span>
                    )}
                  </span>
                </span>
                {selecting ? (
                  <Loader2 className="size-4 shrink-0 animate-spin text-muted-foreground" aria-hidden="true" />
                ) : (
                  <ArrowRight className="size-4 shrink-0 text-muted-foreground transition-transform duration-150 group-hover:translate-x-0.5 group-hover:text-brand" aria-hidden="true" />
                )}
              </button>
            </motion.li>
          ))}
        </motion.ul>
      </div>
    </EntryShell>
  );
};

export default AccountSelector;

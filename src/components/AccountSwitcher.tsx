import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useUser } from '@/contexts/UserContext';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Building2, User, ChevronDown, Check, RefreshCw } from 'lucide-react';

interface AccountOption {
  email: string;
  type: 'own' | 'admin';
  ownerName?: string;
  agencyName?: string;
}

export const AccountSwitcher = () => {
  const [accounts, setAccounts] = useState<AccountOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [switching, setSwitching] = useState(false);
  const navigate = useNavigate();
  const { actualEmail } = useUser();

  // Always build the account list from the signed-in (real) account. Using the
  // effective/switched email hid the switcher once a user landed inside one of
  // the accounts they only administer.
  const email = actualEmail;

  const selectedAccountEmail = sessionStorage.getItem('selectedAccountEmail') || email;

  useEffect(() => {
    if (!email) return;
    fetchAccounts();
  }, [email]);

  const fetchAccounts = async () => {
    if (!email) return;
    
    setLoading(true);

    try {
      // Get user's own account info - use ilike for case-insensitive matching
      const { data: ownAccount } = await supabase
        .from('saas_suite_users')
        .select('email, agency_name, full_name')
        .ilike('email', email)
        .maybeSingle();

      // Get accounts where user is an admin (accepted or pending status)
      // Use ilike for case-insensitive matching
      const { data: adminAccounts } = await supabase
        .from('account_admins')
        .select('owner_email, admin_name, status')
        .ilike('admin_email', email)
        .in('status', ['accepted', 'pending']);

      const accountOptions: AccountOption[] = [];

      // Add own account if it exists
      if (ownAccount) {
        accountOptions.push({
          email: ownAccount.email!,
          type: 'own',
          ownerName: ownAccount.full_name || undefined,
          agencyName: ownAccount.agency_name || undefined,
        });
      }

      // Add admin accounts (filter out if same as own account)
      if (adminAccounts && adminAccounts.length > 0) {
        const hasPendingInvite = adminAccounts.some((admin) => admin.status === 'pending');
        if (hasPendingInvite) {
          await supabase.rpc('admin_accept_invitation', { p_admin_email: email });
        }

        for (const admin of adminAccounts) {
          // Skip if this is the user's own account
          if (ownAccount && admin.owner_email.toLowerCase() === ownAccount.email?.toLowerCase()) {
            continue;
          }
          
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

      console.log('AccountSwitcher: Found accounts', accountOptions);
      setAccounts(accountOptions);
    } catch (err) {
      console.error('Failed to load accounts:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSwitchAccount = (account: AccountOption) => {
    if (account.email === selectedAccountEmail) return;
    
    setSwitching(true);
    sessionStorage.setItem('selectedAccountEmail', account.email);
    
    // Reload the page to refresh all data with the new account context
    window.location.reload();
  };

  // Show whenever there's somewhere else to go: several accounts, or a team
  // account they're not currently viewing (fallback if auto-switch misses).
  const viewingEmail = (selectedAccountEmail || '').toLowerCase();
  const onlyAccount = accounts.length === 1 ? accounts[0] : null;
  if (loading || accounts.length === 0 || (onlyAccount && onlyAccount.email.toLowerCase() === viewingEmail)) {
    return null;
  }

  const currentAccount =
    accounts.find(a => a.email.toLowerCase() === viewingEmail) ||
    ({ email: viewingEmail, type: 'own', ownerName: 'Your login' } as AccountOption);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2" aria-label={`Switch account. Current: ${currentAccount.agencyName || currentAccount.ownerName || currentAccount.email}`}>
          {currentAccount.type === 'own' ? (
            <User className="text-brand" aria-hidden="true" />
          ) : (
            <Building2 className="text-brand" aria-hidden="true" />
          )}
          <span className="hidden max-w-[120px] truncate sm:inline">
            {currentAccount.agencyName || currentAccount.ownerName || currentAccount.email}
          </span>
          <ChevronDown className="!size-3 text-muted-foreground" aria-hidden="true" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-72 max-w-[calc(100vw-1.5rem)]">
        <DropdownMenuLabel className="px-eyebrow">Switch account</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {accounts.map((account) => {
          const active = account.email === selectedAccountEmail;
          return (
            <DropdownMenuItem
              key={account.email}
              onClick={() => handleSwitchAccount(account)}
              className="flex min-h-11 cursor-pointer items-center gap-3"
              disabled={switching}
              aria-current={active ? 'true' : undefined}
            >
              <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-brand-subtle text-brand">
                {account.type === 'own' ? (
                  <User className="size-4" aria-hidden="true" />
                ) : (
                  <Building2 className="size-4" aria-hidden="true" />
                )}
              </span>
              <div className="min-w-0 flex-1">
                <div className="truncate text-small font-medium">
                  {account.agencyName || account.ownerName || account.email}
                </div>
                <div className="truncate text-caption font-normal text-muted-foreground">
                  {account.type === 'own' ? 'Your account' : `Admin • ${account.email}`}
                </div>
              </div>
              {active && (
                <>
                  <Check className="size-4 shrink-0 text-brand" aria-hidden="true" />
                  <span className="sr-only">Current account</span>
                </>
              )}
            </DropdownMenuItem>
          );
        })}
        {switching && (
          <>
            <DropdownMenuSeparator />
            <div role="status" className="flex items-center justify-center gap-2 py-2 text-small text-muted-foreground">
              <RefreshCw className="size-4 animate-spin" aria-hidden="true" />
              Switching accounts
            </div>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

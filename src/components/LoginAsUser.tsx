import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useUser } from '@/contexts/UserContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { UserCog, Search, LogIn } from 'lucide-react';
import { toast } from 'sonner';
import { isPlatformAdminEmail } from '@/lib/platformAdmins';

interface UserOption {
  email: string;
  full_name: string | null;
  agency_name: string | null;
  /** Team admins have no account of their own — they open their owner's account. */
  owner_email?: string;
}

export const LoginAsUser = () => {
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [users, setUsers] = useState<UserOption[]>([]);
  const [loading, setLoading] = useState(false);
  const { actualEmail } = useUser();

  // Security check - only allow for admin email (use actualEmail, not effectiveEmail)
  const isAdmin = isPlatformAdminEmail(actualEmail);

  // Fetch users when dialog opens
  useEffect(() => {
    if (open && isAdmin && users.length === 0) {
      fetchUsers();
    }
  }, [open, isAdmin]);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('saas_suite_users')
        .select('email, full_name, agency_name')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching users:', error);
        return;
      }

      const owners = (data || []).filter(u => u.email) as UserOption[];
      const byEmail = new Map(owners.map(o => [o.email.toLowerCase(), o]));
      const { data: admins } = await supabase
        .from('account_admins')
        .select('admin_email, admin_name, owner_email, status')
        .in('status', ['accepted', 'pending']);
      const team: UserOption[] = (admins || [])
        .filter(a => a.admin_email && !byEmail.has(a.admin_email.toLowerCase()))
        .map(a => ({
          email: a.admin_email.toLowerCase(),
          full_name: a.admin_name || null,
          agency_name: byEmail.get(a.owner_email.toLowerCase())?.agency_name || a.owner_email,
          owner_email: a.owner_email.toLowerCase(),
        }));
      setUsers([...owners, ...team]);
    } catch (err) {
      console.error('Error:', err);
    } finally {
      setLoading(false);
    }
  };

  // Don't render anything if not admin
  if (!isAdmin) {
    return null;
  }

  const filteredUsers = users.filter(user => {
    if (!user.email) return false;
    const query = searchQuery.toLowerCase();
    return (
      user.email.toLowerCase().includes(query) ||
      user.full_name?.toLowerCase().includes(query) ||
      user.agency_name?.toLowerCase().includes(query)
    );
  }).slice(0, 20); // Limit to 20 results for performance

  const handleLoginAs = (userEmail: string) => {
    // Store the impersonation info
    sessionStorage.setItem('selectedAccountEmail', userEmail);
    sessionStorage.setItem('isImpersonating', 'true');
    sessionStorage.setItem('impersonatedBy', (actualEmail || '').toLowerCase());
    
    toast.success(`Now viewing as ${userEmail}`);
    setOpen(false);
    
    // Reload to apply the new context
    window.location.reload();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2" aria-label="Login As">
          <UserCog aria-hidden="true" />
          <span className="hidden sm:inline">Login As</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3 text-h4">
            <span className="px-icon-chip shrink-0">
              <UserCog className="size-5" aria-hidden="true" />
            </span>
            Login As User
          </DialogTitle>
          <DialogDescription>
            View the app as another user to help them with their account. Only available for admin.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="search-user">Search User</Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
              <Input
                id="search-user"
                placeholder="Search by email, name, or agency..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-11 pl-9"
                autoComplete="off"
              />
            </div>
          </div>

          <div className="max-h-[300px] overflow-y-auto rounded-lg border border-border" aria-live="polite">
            {loading ? (
              <div className="space-y-2 p-3" role="status" aria-label="Loading users">
                <div className="px-skeleton h-11 rounded-md" />
                <div className="px-skeleton h-11 rounded-md" />
                <div className="px-skeleton h-11 rounded-md" />
              </div>
            ) : searchQuery.length < 2 ? (
              <div className="p-6 text-center text-small text-muted-foreground">
                Type at least 2 characters to search
              </div>
            ) : filteredUsers.length === 0 ? (
              <div className="p-6 text-center text-small text-muted-foreground">
                No users found. Try the email address instead.
              </div>
            ) : (
              <div className="divide-y divide-border">
                {filteredUsers.map((user) => (
                  <button
                    key={`${user.email}:${user.owner_email || ''}`}
                    onClick={() => handleLoginAs(user.owner_email || user.email)}
                    className="group flex min-h-11 w-full cursor-pointer items-center justify-between px-4 py-3 text-left transition-colors hover:bg-muted/60 focus-visible:bg-muted/60 focus-visible:outline-none"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-small font-medium">
                        {user.full_name || user.email}
                      </div>
                      {user.full_name && (
                        <div className="truncate text-small text-muted-foreground">
                          {user.email}
                        </div>
                      )}
                      {user.agency_name && (
                        <div className="truncate text-caption font-normal text-muted-foreground">
                          {user.owner_email ? `Team admin → opens ${user.agency_name}` : user.agency_name}
                        </div>
                      )}
                    </div>
                    <LogIn className="ml-2 size-4 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100" aria-hidden="true" />
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

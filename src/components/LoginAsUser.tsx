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
        <Button variant="outline" size="sm" className="gap-2">
          <UserCog className="h-4 w-4" />
          <span className="hidden sm:inline">Login As</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserCog className="h-5 w-5" />
            Login As User
          </DialogTitle>
          <DialogDescription>
            View the app as another user to help them with their account. Only available for admin.
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="search-user">Search User</Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                id="search-user"
                placeholder="Search by email, name, or agency..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>

          <div className="border rounded-lg max-h-[300px] overflow-y-auto">
            {loading ? (
              <div className="p-4 text-center text-sm text-muted-foreground">
                Loading users...
              </div>
            ) : searchQuery.length < 2 ? (
              <div className="p-4 text-center text-sm text-muted-foreground">
                Type at least 2 characters to search
              </div>
            ) : filteredUsers.length === 0 ? (
              <div className="p-4 text-center text-sm text-muted-foreground">
                No users found
              </div>
            ) : (
              <div className="divide-y">
                {filteredUsers.map((user) => (
                  <button
                    key={`${user.email}:${user.owner_email || ''}`}
                    onClick={() => handleLoginAs(user.owner_email || user.email)}
                    className="w-full px-4 py-3 text-left hover:bg-muted/50 transition-colors flex items-center justify-between group"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="font-medium truncate">
                        {user.full_name || user.email}
                      </div>
                      {user.full_name && (
                        <div className="text-sm text-muted-foreground truncate">
                          {user.email}
                        </div>
                      )}
                      {user.agency_name && (
                        <div className="text-xs text-muted-foreground truncate">
                          {user.owner_email ? `Team admin → opens ${user.agency_name}` : user.agency_name}
                        </div>
                      )}
                    </div>
                    <LogIn className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0 ml-2" />
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

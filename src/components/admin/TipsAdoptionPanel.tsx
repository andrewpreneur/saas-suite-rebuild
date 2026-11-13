import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { Lightbulb, Search, ToggleLeft, RefreshCw, CheckCircle, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import { ALL_TIPS } from '@/components/tips-bot';

interface UserTipsData {
  email: string;
  tips_bot_enabled: boolean;
  dismissed_tips: string[];
  full_name: string | null;
}

interface TipStats {
  tipId: string;
  tipTitle: string;
  category: string;
  dismissedCount: number;
  dismissedByUsers: string[];
}

export const TipsAdoptionPanel: React.FC = () => {
  const [users, setUsers] = useState<UserTipsData[]>([]);
  const [tipStats, setTipStats] = useState<TipStats[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [updatingUser, setUpdatingUser] = useState<string | null>(null);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      // Fetch users with tips_bot_enabled
      const { data: usersData, error: usersError } = await supabase
        .from('saas_suite_users')
        .select('email, tips_bot_enabled, full_name')
        .order('email');

      if (usersError) throw usersError;

      // Fetch all dismissed tips
      const { data: dismissedData, error: dismissedError } = await supabase
        .from('user_dismissed_tips')
        .select('*');

      if (dismissedError) throw dismissedError;

      // Build user data with dismissed tips
      const userTipsMap = new Map<string, string[]>();
      dismissedData?.forEach(d => {
        const email = d.user_email.toLowerCase();
        if (!userTipsMap.has(email)) {
          userTipsMap.set(email, []);
        }
        userTipsMap.get(email)!.push(d.tip_id);
      });

      const usersWithTips: UserTipsData[] = (usersData || []).map(u => ({
        email: u.email || '',
        tips_bot_enabled: u.tips_bot_enabled || false,
        full_name: u.full_name,
        dismissed_tips: userTipsMap.get((u.email || '').toLowerCase()) || [],
      }));

      setUsers(usersWithTips);

      // Build tip stats
      const stats: TipStats[] = ALL_TIPS.map(tip => {
        const dismissedBy = dismissedData
          ?.filter(d => d.tip_id === tip.id)
          .map(d => d.user_email) || [];
        
        return {
          tipId: tip.id,
          tipTitle: tip.title,
          category: tip.category,
          dismissedCount: dismissedBy.length,
          dismissedByUsers: dismissedBy,
        };
      });

      setTipStats(stats.sort((a, b) => b.dismissedCount - a.dismissedCount));
    } catch (error) {
      console.error('Error fetching tips data:', error);
      toast.error('Failed to load tips data');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const toggleTipsBot = async (email: string, enabled: boolean) => {
    setUpdatingUser(email);
    try {
      const { error } = await supabase
        .from('saas_suite_users')
        .update({ tips_bot_enabled: enabled })
        .ilike('email', email);

      if (error) throw error;

      setUsers(prev => prev.map(u => 
        u.email.toLowerCase() === email.toLowerCase() 
          ? { ...u, tips_bot_enabled: enabled }
          : u
      ));

      toast.success(`Tips bot ${enabled ? 'enabled' : 'disabled'} for ${email}`);
    } catch (error) {
      console.error('Error toggling tips bot:', error);
      toast.error('Failed to update tips bot status');
    } finally {
      setUpdatingUser(null);
    }
  };

  const enableForAllUsers = async () => {
    try {
      const { error } = await supabase
        .from('saas_suite_users')
        .update({ tips_bot_enabled: true })
        .neq('email', ''); // Update all

      if (error) throw error;

      setUsers(prev => prev.map(u => ({ ...u, tips_bot_enabled: true })));
      toast.success('Tips bot enabled for all users');
    } catch (error) {
      console.error('Error enabling for all:', error);
      toast.error('Failed to enable for all users');
    }
  };

  const disableForAllUsers = async () => {
    try {
      const { error } = await supabase
        .from('saas_suite_users')
        .update({ tips_bot_enabled: false })
        .neq('email', ''); // Update all

      if (error) throw error;

      setUsers(prev => prev.map(u => ({ ...u, tips_bot_enabled: false })));
      toast.success('Tips bot disabled for all users');
    } catch (error) {
      console.error('Error disabling for all:', error);
      toast.error('Failed to disable for all users');
    }
  };

  const filteredUsers = users.filter(u => 
    u.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (u.full_name && u.full_name.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const enabledCount = users.filter(u => u.tips_bot_enabled).length;

  const getCategoryBadge = (category: string) => {
    const colors: Record<string, string> = {
      navigation: 'bg-blue-500/10 text-blue-600 border-blue-500/20',
      customization: 'bg-brand-subtle text-brand border-brand/20',
      features: 'bg-green-500/10 text-green-600 border-green-500/20',
      content: 'bg-orange-500/10 text-orange-600 border-orange-500/20',
    };
    return (
      <Badge variant="outline" className={colors[category] || ''}>
        {category}
      </Badge>
    );
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Overview Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <Lightbulb className="w-8 h-8 text-yellow-500" />
              <div>
                <p className="text-2xl font-bold">{ALL_TIPS.length}</p>
                <p className="text-xs text-muted-foreground">Total Tips</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <ToggleLeft className="w-8 h-8 text-green-500" />
              <div>
                <p className="text-2xl font-bold">{enabledCount}</p>
                <p className="text-xs text-muted-foreground">Users Enabled</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <CheckCircle className="w-8 h-8 text-blue-500" />
              <div>
                <p className="text-2xl font-bold">
                  {tipStats.reduce((sum, t) => sum + t.dismissedCount, 0)}
                </p>
                <p className="text-xs text-muted-foreground">Tips Dismissed</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <XCircle className="w-8 h-8 text-muted-foreground" />
              <div>
                <p className="text-2xl font-bold">{users.length - enabledCount}</p>
                <p className="text-xs text-muted-foreground">Users Disabled</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Bulk Actions */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Lightbulb className="w-5 h-5" />
            Tips Bot Management
          </CardTitle>
          <CardDescription>
            Control the Product Adoption Bot for users. When enabled, users will see helpful tips pointing them to unused features.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={enableForAllUsers}>
              <CheckCircle className="w-4 h-4 mr-2" />
              Enable for All
            </Button>
            <Button variant="outline" size="sm" onClick={disableForAllUsers}>
              <XCircle className="w-4 h-4 mr-2" />
              Disable for All
            </Button>
            <Button variant="outline" size="sm" onClick={fetchData}>
              <RefreshCw className="w-4 h-4 mr-2" />
              Refresh
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Tip Dismissal Stats */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Tip Engagement</CardTitle>
          <CardDescription>See which tips users are engaging with (dismissing after seeing)</CardDescription>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[300px]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tip</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead className="text-right">Times Dismissed</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tipStats.map(stat => (
                  <TableRow key={stat.tipId}>
                    <TableCell className="font-medium">{stat.tipTitle}</TableCell>
                    <TableCell>{getCategoryBadge(stat.category)}</TableCell>
                    <TableCell className="text-right">
                      <Badge variant="secondary">{stat.dismissedCount}</Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </ScrollArea>
        </CardContent>
      </Card>

      {/* User Management */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">User Tips Bot Status</CardTitle>
          <CardDescription>Toggle the tips bot on/off for individual users</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
            <Input
              placeholder="Search users..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          <ScrollArea className="h-[400px]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Tips Dismissed</TableHead>
                  <TableHead className="text-right">Enabled</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredUsers.map(user => (
                  <TableRow key={user.email}>
                    <TableCell>
                      <div>
                        <p className="font-medium">{user.email}</p>
                        {user.full_name && (
                          <p className="text-xs text-muted-foreground">{user.full_name}</p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">
                        {user.dismissed_tips.length} / {ALL_TIPS.length}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Switch
                        checked={user.tips_bot_enabled}
                        onCheckedChange={(checked) => toggleTipsBot(user.email, checked)}
                        disabled={updatingUser === user.email}
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
};

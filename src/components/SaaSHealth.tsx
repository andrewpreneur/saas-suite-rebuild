import { useState, useEffect, useMemo } from "react";
import { LoadNotice } from "@/components/platform/LoadNotice";
import { LOAD_TIMEOUT_MESSAGE, armLoadDeadline, loadErrorText } from "@/lib/loadSettle";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { Tooltip as UITooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { 
  Users, 
  TrendingUp, 
  AlertTriangle, 
  CheckCircle2, 
  Clock, 
  Activity,
  Ticket,
  MessageSquare,
  Sparkles,
  Filter
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { moduleCompletionUserIds } from "../../supabase/functions/_shared/moduleCompletionIds.ts";
import { useUser } from "@/contexts/UserContext";
import { toast } from "sonner";
import { PanelSkeleton } from "@/components/ui/loading-skeletons";

// Status types
type ActivityStatus = "active" | "at-risk" | "inactive";
type OnboardingStatus = "onboarded" | "onboarding" | "stalled";
type FilterStatus = "all" | ActivityStatus | OnboardingStatus;

interface ClientHealth {
  id: string;
  email: string | null;
  name: string | null;
  lastLogin: string;
  daysInactive: number;
  videosCompleted: number;
  totalVideos: number;
  activityStatus: ActivityStatus;
  onboardingStatus: OnboardingStatus;
  ticketsOpened: number;
  isOldAgency?: boolean;
  oldAgencyId?: string | null;
}

interface AgencyStats {
  totalUsers: number;
  activeUsers: number;
  atRiskUsers: number;
  inactiveUsers: number;
  avgCompletionRate: number;
  totalTickets: number;
  avgLoginFrequency: number;
  onboardedUsers: number;
  onboardingUsers: number;
  stalledUsers: number;
}

export default function SaaSHealth() {
  const { email } = useUser();
  const [clients, setClients] = useState<ClientHealth[]>([]);
  const [stats, setStats] = useState<AgencyStats>({
    totalUsers: 0,
    activeUsers: 0,
    atRiskUsers: 0,
    inactiveUsers: 0,
    avgCompletionRate: 0,
    totalTickets: 0,
    avgLoginFrequency: 0,
    onboardedUsers: 0,
    onboardingUsers: 0,
    stalledUsers: 0
  });
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [statusFilter, setStatusFilter] = useState<FilterStatus>("all");

  const TOTAL_VIDEOS = 23;

  useEffect(() => {
    if (email) fetchHealthData();
    else {
      setLoading(false);
      setLoadError(null);
    }
  }, [email, loadAttempt]);

  const getActivityStatus = (daysInactive: number): ActivityStatus => {
    if (daysInactive >= 14) return "inactive";
    if (daysInactive >= 7) return "at-risk";
    return "active";
  };

  const getOnboardingStatus = (videosCompleted: number, totalVideos: number): OnboardingStatus => {
    if (videosCompleted >= totalVideos) return "onboarded";
    if (videosCompleted > 0) return "onboarding";
    return "stalled";
  };

  const fetchHealthData = async () => {
    const stop = armLoadDeadline(() => {
      setLoading(false);
      setLoadError(LOAD_TIMEOUT_MESSAGE);
    });
    try {
      setLoading(true);
      setLoadError(null);

      // Get current user's agency information
      const { data: currentUser } = await supabase
        .from('saas_suite_users')
        .select('agency_id, agency_id_basic, agency_id_advanced, agency_id_elite, original_agency_id, original_agency_id_basic, original_agency_id_advanced, original_agency_id_elite, agency_name')
        .ilike('email', email!)
        .single();

      if (!currentUser) return;

      const currentIdSet = new Set(
        [
          currentUser.agency_id,
          currentUser.agency_id_basic,
          currentUser.agency_id_advanced,
          currentUser.agency_id_elite,
          currentUser.agency_name,
        ].filter(Boolean) as string[]
      );
      const originalIds = [
        currentUser.original_agency_id,
        currentUser.original_agency_id_basic,
        currentUser.original_agency_id_advanced,
        currentUser.original_agency_id_elite,
      ].filter(Boolean) as string[];
      const agencyIds = Array.from(new Set([...currentIdSet, ...originalIds]));
      const isOldId = (id: string | null | undefined) =>
        !!id && !currentIdSet.has(id) && originalIds.includes(id);

      if (agencyIds.length === 0) return;

      // Fetch V1 user progress (users whose agency_id matches)
      const { data: userProgressData } = await supabase
        .from('user_progress')
        .select('*')
        .in('agency_id', agencyIds);

      const agencyUserIds = moduleCompletionUserIds((userProgressData || []).map((user) => user.id));

      // Fetch V1 module completion once real progress ids exist.
      const moduleCompletionData = agencyUserIds.length
        ? (
            await supabase
              .from("module_completion")
              .select("*")
              .in("user_id", agencyUserIds)
          ).data
        : [];

      // Fetch V2 checklist completions (users tracked via user_onboarding_checklist_completion)
      const { data: v2ChecklistCompletions } = await supabase
        .from('user_onboarding_checklist_completion')
        .select('user_identifier, checklist_item_id, completed_at')
        .in('agency_id', agencyIds);

      // Fetch total checklist items for this agency (for V2 progress calculation)
      const { data: checklistItems } = await supabase
        .from('agency_onboarding_checklist')
        .select('id')
        .in('agency_id', agencyIds);

      const totalChecklistItems = (checklistItems || []).length;

      // Fetch support tickets
      const { data: ticketsData } = await supabase.rpc('get_agency_tickets', {
        user_email: email!
      });

      // Build V1 clients from user_progress (existing logic)
      const v1Emails = new Set<string>();
      const processedClients: ClientHealth[] = (userProgressData || []).map(user => {
        const userCompletions = (moduleCompletionData || []).filter(c => c.user_id === user.id);
        const videosCompleted = userCompletions.length;
        
        // last_accessed comes from page load tracking, not checklist completions
        const lastAccessDate = user.last_accessed ?? user.created_at;
        const daysInactive = Math.floor(
          (new Date().getTime() - new Date(lastAccessDate).getTime()) / (1000 * 3600 * 24)
        );

        const userTickets = (ticketsData || []).filter((t: any) => 
          t.customer_email === user.email
        ).length;

        if (user.email) v1Emails.add(user.email.toLowerCase());

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          lastLogin: lastAccessDate,
          daysInactive,
          videosCompleted,
          totalVideos: TOTAL_VIDEOS,
          activityStatus: getActivityStatus(daysInactive),
          onboardingStatus: getOnboardingStatus(videosCompleted, TOTAL_VIDEOS),
          ticketsOpened: userTickets,
          isOldAgency: isOldId((user as any).agency_id),
          oldAgencyId: isOldId((user as any).agency_id) ? (user as any).agency_id : null,
        };
      });

      // Build V2 clients from checklist completions (only users not already in V1)
      const v2UserMap = new Map<string, { itemsCompleted: number; agencyId: string | null }>();
      (v2ChecklistCompletions || []).forEach(row => {
        const identifier = row.user_identifier;
        if (v1Emails.has(identifier.toLowerCase())) return; // skip duplicates
        const existing = v2UserMap.get(identifier) || { itemsCompleted: 0, agencyId: (row as any).agency_id ?? null };
        existing.itemsCompleted += 1;
        // Prefer a current agency_id over an old one when the same identifier appears in both
        const rowAgency = (row as any).agency_id ?? null;
        if (rowAgency && (!existing.agencyId || (isOldId(existing.agencyId) && !isOldId(rowAgency)))) {
          existing.agencyId = rowAgency;
        }
        v2UserMap.set(identifier, existing);
      });

      // For V2 users, get last_accessed from user_progress (page load tracking)
      const v2Identifiers = Array.from(v2UserMap.keys());
      let v2ProgressMap = new Map<string, { last_accessed: string | null; created_at: string; id: string; name: string | null }>();
      
      if (v2Identifiers.length > 0) {
        const { data: v2ProgressData } = await supabase
          .from('user_progress')
          .select('id, email, name, last_accessed, created_at')
          .in('email', v2Identifiers);

        (v2ProgressData || []).forEach(up => {
          if (up.email) {
            v2ProgressMap.set(up.email.toLowerCase(), {
              last_accessed: up.last_accessed,
              created_at: up.created_at,
              id: up.id,
              name: up.name
            });
          }
        });
      }

      const v2TotalItems = totalChecklistItems > 0 ? totalChecklistItems : 1;

      v2UserMap.forEach((data, identifier) => {
        const progressInfo = v2ProgressMap.get(identifier.toLowerCase());
        // Use last_accessed from user_progress (page load), NOT checklist completion dates
        const lastAccessDate = progressInfo?.last_accessed ?? progressInfo?.created_at ?? new Date().toISOString();
        const daysInactive = Math.floor(
          (new Date().getTime() - new Date(lastAccessDate).getTime()) / (1000 * 3600 * 24)
        );

        const userTickets = (ticketsData || []).filter((t: any) =>
          t.customer_email === identifier
        ).length;

        processedClients.push({
          id: progressInfo?.id ?? identifier,
          email: identifier,
          name: progressInfo?.name ?? null,
          lastLogin: lastAccessDate,
          daysInactive,
          videosCompleted: data.itemsCompleted,
          totalVideos: v2TotalItems,
          activityStatus: getActivityStatus(daysInactive),
          onboardingStatus: getOnboardingStatus(data.itemsCompleted, v2TotalItems),
          ticketsOpened: userTickets,
          isOldAgency: isOldId(data.agencyId),
          oldAgencyId: isOldId(data.agencyId) ? data.agencyId : null,
        });
      });

      // Calculate stats
      const activeUsers = processedClients.filter(c => c.activityStatus === "active").length;
      const atRiskUsers = processedClients.filter(c => c.activityStatus === "at-risk").length;
      const inactiveUsers = processedClients.filter(c => c.activityStatus === "inactive").length;
      const onboardedUsers = processedClients.filter(c => c.onboardingStatus === "onboarded").length;
      const onboardingUsers = processedClients.filter(c => c.onboardingStatus === "onboarding").length;
      const stalledUsers = processedClients.filter(c => c.onboardingStatus === "stalled").length;

      const avgCompletionRate = processedClients.length > 0
        ? Math.round(processedClients.reduce((sum, c) => sum + (c.videosCompleted / c.totalVideos) * 100, 0) / processedClients.length)
        : 0;

      const avgLoginFrequency = processedClients.length > 0
        ? Math.round(processedClients.reduce((sum, c) => sum + Math.max(0, 14 - c.daysInactive), 0) / processedClients.length)
        : 0;

      setClients(processedClients);
      setStats({
        totalUsers: processedClients.length,
        activeUsers,
        atRiskUsers,
        inactiveUsers,
        avgCompletionRate,
        totalTickets: (ticketsData || []).length,
        avgLoginFrequency,
        onboardedUsers,
        onboardingUsers,
        stalledUsers
      });

      setLoadError(null);
    } catch (error) {
      console.error('Error fetching health data:', error);
      setLoadError(loadErrorText(error, "Couldn't load SaaS health."));
    } finally {
      stop();
      setLoading(false);
    }
  };

  const filteredClients = useMemo(() => {
    if (statusFilter === "all") return clients;
    return clients.filter(c => 
      c.activityStatus === statusFilter || c.onboardingStatus === statusFilter
    );
  }, [clients, statusFilter]);

  // Sort by priority: inactive/stalled first, then at-risk, then active
  const sortedClients = useMemo(() => {
    return [...filteredClients].sort((a, b) => {
      const priorityOrder: Record<ActivityStatus, number> = { inactive: 0, "at-risk": 1, active: 2 };
      return priorityOrder[a.activityStatus] - priorityOrder[b.activityStatus];
    });
  }, [filteredClients]);

  const getStatusBadge = (status: ActivityStatus) => {
    switch (status) {
      case "inactive":
        return <Badge variant="destructive" className="text-xs">Inactive</Badge>;
      case "at-risk":
        return <Badge variant="outline" className="text-xs border-yellow-500 text-yellow-600 bg-yellow-50">At Risk</Badge>;
      case "active":
        return <Badge variant="default" className="text-xs bg-green-500">Active</Badge>;
    }
  };

  const getOnboardingBadge = (status: OnboardingStatus) => {
    switch (status) {
      case "onboarded":
        return <Badge variant="secondary" className="text-xs bg-blue-100 text-blue-700">Onboarded</Badge>;
      case "onboarding":
        return <Badge variant="secondary" className="text-xs">Onboarding</Badge>;
      case "stalled":
        return <Badge variant="outline" className="text-xs border-orange-500 text-orange-600 bg-orange-50">Stalled</Badge>;
    }
  };

  const formatDaysAgo = (days: number) => {
    if (days === 0) return "Today";
    if (days === 1) return "1 day ago";
    return `${days} days ago`;
  };

  const handleAskAI = (context: string) => {
    toast.info(`AI Analysis: ${context}`, {
      description: "AI insights feature coming soon. This will provide actionable recommendations based on your data.",
      duration: 5000
    });
  };

  if (loadError) return <LoadNotice error={loadError} onRetry={() => setLoadAttempt((attempt) => attempt + 1)} />;
  if (loading) {
    return <PanelSkeleton stats={4} rows={6} />;
  }

  const activePercent = stats.totalUsers > 0 ? Math.round((stats.activeUsers / stats.totalUsers) * 100) : 0;
  const atRiskPercent = stats.totalUsers > 0 ? Math.round((stats.atRiskUsers / stats.totalUsers) * 100) : 0;
  const inactivePercent = stats.totalUsers > 0 ? Math.round((stats.inactiveUsers / stats.totalUsers) * 100) : 0;

  return (
    <div className="space-y-6">
      {/* Churn Prevention Alert */}
      {stats.atRiskUsers > 0 && (
        <Card className="border-yellow-500/50 bg-yellow-50/50 dark:bg-yellow-900/10">
          <CardContent className="flex items-center justify-between py-4">
            <div className="flex items-center gap-3">
              <AlertTriangle className="h-5 w-5 text-yellow-600" />
              <div>
                <p className="font-medium text-yellow-800 dark:text-yellow-200">
                  {stats.atRiskUsers} user{stats.atRiskUsers > 1 ? 's' : ''} at risk of churning
                </p>
                <p className="text-sm text-yellow-700 dark:text-yellow-300">
                  No activity in 7-14 days. Consider reaching out.
                </p>
              </div>
            </div>
            <Button 
              size="sm" 
              variant="outline" 
              className="border-yellow-500 text-yellow-700 hover:bg-yellow-100"
              onClick={() => handleAskAI("Why are these users at risk and what can I do?")}
            >
              <Sparkles className="w-4 h-4 mr-1" /> Ask AI
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Stats Overview */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="border-border/50">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Users</CardTitle>
            <Users className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalUsers}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {activePercent}% active
            </p>
          </CardContent>
        </Card>

        <Card className="border-border/50">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Active Users</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{stats.activeUsers}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Logged in within 7 days
            </p>
          </CardContent>
        </Card>

        <Card className="border-border/50">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Avg Completion</CardTitle>
            <TrendingUp className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.avgCompletionRate}%</div>
            <p className="text-xs text-muted-foreground mt-1">
              Onboarding progress
            </p>
          </CardContent>
        </Card>

        <Card className="border-border/50">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Support Tickets</CardTitle>
            <Ticket className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalTickets}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Total opened
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Activity Breakdown & Onboarding Status Pie Charts */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="border-border/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center justify-between">
              <span>Activity Breakdown</span>
              <Button 
                size="sm" 
                variant="ghost" 
                className="h-7 text-xs"
                onClick={() => handleAskAI("How can I improve user activity rates?")}
              >
                <Sparkles className="w-3 h-3 mr-1" /> Ask AI
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4">
              <div className="w-[120px] h-[120px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={[
                        { name: "Active", value: stats.activeUsers, color: "#22c55e" },
                        { name: "At Risk", value: stats.atRiskUsers, color: "#eab308" },
                        { name: "Inactive", value: stats.inactiveUsers, color: "#ef4444" }
                      ].filter(d => d.value > 0)}
                      cx="50%"
                      cy="50%"
                      innerRadius={30}
                      outerRadius={50}
                      paddingAngle={2}
                      dataKey="value"
                    >
                      {[
                        { name: "Active", value: stats.activeUsers, color: "#22c55e" },
                        { name: "At Risk", value: stats.atRiskUsers, color: "#eab308" },
                        { name: "Inactive", value: stats.inactiveUsers, color: "#ef4444" }
                      ].filter(d => d.value > 0).map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value: number) => [value, "Users"]} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="flex-1 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-green-500" />
                    <span className="text-sm">Active</span>
                  </div>
                  <span className="text-sm font-medium">{stats.activeUsers} ({activePercent}%)</span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-yellow-500" />
                    <span className="text-sm">At Risk</span>
                  </div>
                  <span className="text-sm font-medium">{stats.atRiskUsers} ({atRiskPercent}%)</span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-red-500" />
                    <span className="text-sm">Inactive</span>
                  </div>
                  <span className="text-sm font-medium">{stats.inactiveUsers} ({inactivePercent}%)</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center justify-between">
              <span>Onboarding Status</span>
              <Button 
                size="sm" 
                variant="ghost" 
                className="h-7 text-xs"
                onClick={() => handleAskAI("How can I help stalled users complete onboarding?")}
              >
                <Sparkles className="w-3 h-3 mr-1" /> Ask AI
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {(() => {
              const onboardedPercent = stats.totalUsers > 0 ? Math.round((stats.onboardedUsers / stats.totalUsers) * 100) : 0;
              const onboardingPercent = stats.totalUsers > 0 ? Math.round((stats.onboardingUsers / stats.totalUsers) * 100) : 0;
              const stalledPercent = stats.totalUsers > 0 ? Math.round((stats.stalledUsers / stats.totalUsers) * 100) : 0;
              
              return (
                <div className="flex items-center gap-4">
                  <div className="w-[120px] h-[120px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={[
                            { name: "Onboarded", value: stats.onboardedUsers, color: "#3b82f6" },
                            { name: "Onboarding", value: stats.onboardingUsers, color: "#9ca3af" },
                            { name: "Stalled", value: stats.stalledUsers, color: "#f97316" }
                          ].filter(d => d.value > 0)}
                          cx="50%"
                          cy="50%"
                          innerRadius={30}
                          outerRadius={50}
                          paddingAngle={2}
                          dataKey="value"
                        >
                          {[
                            { name: "Onboarded", value: stats.onboardedUsers, color: "#3b82f6" },
                            { name: "Onboarding", value: stats.onboardingUsers, color: "#9ca3af" },
                            { name: "Stalled", value: stats.stalledUsers, color: "#f97316" }
                          ].filter(d => d.value > 0).map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip formatter={(value: number) => [value, "Users"]} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-blue-500" />
                        <span className="text-sm">Onboarded</span>
                      </div>
                      <span className="text-sm font-medium">{stats.onboardedUsers} ({onboardedPercent}%)</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-gray-400" />
                        <span className="text-sm">Onboarding</span>
                      </div>
                      <span className="text-sm font-medium">{stats.onboardingUsers} ({onboardingPercent}%)</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-orange-500" />
                        <span className="text-sm">Stalled</span>
                      </div>
                      <span className="text-sm font-medium">{stats.stalledUsers} ({stalledPercent}%)</span>
                    </div>
                  </div>
                </div>
              );
            })()}
          </CardContent>
        </Card>
      </div>

      {/* Clients Table */}
      <Card className="border-border/50">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-lg font-semibold">Client Health</CardTitle>
            <p className="text-sm text-muted-foreground">Clients needing attention are shown first</p>
          </div>
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-muted-foreground" />
            <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as FilterStatus)}>
              <SelectTrigger className="w-[140px] h-8">
                <SelectValue placeholder="Filter" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="at-risk">At Risk</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
                <SelectItem value="onboarded">Onboarded</SelectItem>
                <SelectItem value="onboarding">Onboarding</SelectItem>
                <SelectItem value="stalled">Stalled</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {sortedClients.length === 0 ? (
            <div className="text-center py-8">
              <Users className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">No clients found</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Client</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Progress</TableHead>
                    <TableHead>Last Active</TableHead>
                    <TableHead>Tickets</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedClients.map((client) => (
                    <TableRow key={client.id}>
                      <TableCell>
                        <div className="flex flex-col">
                          {client.name && (
                            <span className="font-semibold flex items-center gap-1.5">
                              {client.name}
                              {client.isOldAgency && client.oldAgencyId && (
                                <TooltipProvider delayDuration={150}>
                                  <UITooltip>
                                    <TooltipTrigger asChild>
                                      <AlertTriangle className="w-3.5 h-3.5 text-amber-500 cursor-help" />
                                    </TooltipTrigger>
                                    <TooltipContent className="max-w-xs">
                                      This user signed up under your old agency id "{client.oldAgencyId}". Their progress will not load on the new url you've created.
                                    </TooltipContent>
                                  </UITooltip>
                                </TooltipProvider>
                              )}
                            </span>
                          )}
                          {client.email && (
                            <span className={`flex items-center gap-1.5 ${client.name ? "text-sm text-muted-foreground" : ""}`}>
                              {client.email}
                              {!client.name && client.isOldAgency && client.oldAgencyId && (
                                <TooltipProvider delayDuration={150}>
                                  <UITooltip>
                                    <TooltipTrigger asChild>
                                      <AlertTriangle className="w-3.5 h-3.5 text-amber-500 cursor-help" />
                                    </TooltipTrigger>
                                    <TooltipContent className="max-w-xs">
                                      This user signed up under your old agency id "{client.oldAgencyId}". Their progress will not load on the new url you've created.
                                    </TooltipContent>
                                  </UITooltip>
                                </TooltipProvider>
                              )}
                            </span>
                          )}
                          {!client.name && !client.email && (
                            <span className="text-muted-foreground">Unknown</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-1">
                          {getStatusBadge(client.activityStatus)}
                          {getOnboardingBadge(client.onboardingStatus)}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className="w-16 h-2 bg-muted rounded-full overflow-hidden">
                            <div 
                              className="h-full bg-primary rounded-full transition-all"
                              style={{ width: `${(client.videosCompleted / client.totalVideos) * 100}%` }}
                            />
                          </div>
                          <span className="text-xs text-muted-foreground">
                            {client.videosCompleted}/{client.totalVideos}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className={`text-sm ${client.daysInactive >= 7 ? 'text-yellow-600' : 'text-muted-foreground'}`}>
                          {formatDaysAgo(client.daysInactive)}
                        </span>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm">{client.ticketsOpened}</span>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

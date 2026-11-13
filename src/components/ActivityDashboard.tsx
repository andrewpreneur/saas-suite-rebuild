import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Users, TrendingUp, PlayCircle, BarChart3 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { moduleCompletionUserIds } from "../../supabase/functions/_shared/moduleCompletionIds.ts";
import { useUser } from "@/contexts/UserContext";
import { toast } from "sonner";
import { PanelSkeleton } from "@/components/ui/loading-skeletons";
import { LoadNotice } from "@/components/platform/LoadNotice";
import { LOAD_TIMEOUT_MESSAGE, armLoadDeadline, loadErrorText } from "@/lib/loadSettle";

interface DashboardMetrics {
  usersOnboarded: number;
  averageCompletionRate: number;
  mostWatchedVideo: string;
}

interface UserActivity {
  id: string;
  email: string | null;
  name: string | null;
  videosCompleted: number;
  totalVideos: number;
  lastCategory: string;
  lastVideo: string;
  lastLogin: string;
}

export default function ActivityDashboard() {
  const { email } = useUser();
  const [metrics, setMetrics] = useState<DashboardMetrics>({
    usersOnboarded: 0,
    averageCompletionRate: 0,
    mostWatchedVideo: "N/A"
  });
  const [userActivities, setUserActivities] = useState<UserActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loadAttempt, setLoadAttempt] = useState(0);

  useEffect(() => {
    if (email) {
      fetchDashboardData();
    } else {
      setLoading(false);
      setLoadError(null);
    }
  }, [email, loadAttempt]);

  const fetchDashboardData = async () => {
    const stop = armLoadDeadline(() => {
      setLoading(false);
      setLoadError(LOAD_TIMEOUT_MESSAGE);
    });
    try {
      setLoading(true);
      setLoadError(null);

      // Get current user's agency information (all current and original IDs)
      const { data: currentUser } = await supabase
        .from('saas_suite_users')
        .select('agency_id, agency_id_basic, agency_id_advanced, agency_id_elite, original_agency_id, original_agency_id_basic, original_agency_id_advanced, original_agency_id_elite, agency_name')
        .eq('email', email!)
        .single();

      if (!currentUser) {
        toast.error("Could not find user data");
        return;
      }

      // Get all agency IDs for this user (current + original versions)
      const agencyIds = [
        currentUser.agency_id,
        currentUser.agency_id_basic,
        currentUser.agency_id_advanced,
        currentUser.agency_id_elite,
        currentUser.original_agency_id,
        currentUser.original_agency_id_basic,
        currentUser.original_agency_id_advanced,
        currentUser.original_agency_id_elite,
        currentUser.agency_name
      ].filter(Boolean) as string[];

      if (agencyIds.length === 0) {
        return;
      }

      // Fetch V1 user progress data
      const { data: userProgressData } = await supabase
        .from('user_progress')
        .select('*')
        .in('agency_id', agencyIds);

      // Get user IDs from the agency's V1 user progress data
      const agencyUserIds = moduleCompletionUserIds((userProgressData || []).map((user) => user.id));

      // Fetch V1 module completion data once real progress ids exist.
      const moduleCompletionData = agencyUserIds.length
        ? (
            await supabase
              .from("module_completion")
              .select("*")
              .in("user_id", agencyUserIds)
          ).data
        : [];

      // Fetch V2 checklist completions
      const { data: v2ChecklistCompletions } = await supabase
        .from('user_onboarding_checklist_completion')
        .select('user_identifier, checklist_item_id, completed_at')
        .in('agency_id', agencyIds);

      // Fetch total checklist items for this agency
      const { data: checklistItems } = await supabase
        .from('agency_onboarding_checklist')
        .select('id')
        .in('agency_id', agencyIds);

      const totalChecklistItems = (checklistItems || []).length;

      // Build set of V1 emails to avoid duplicates
      const v1Emails = new Set<string>();
      (userProgressData || []).forEach(u => {
        if (u.email) v1Emails.add(u.email.toLowerCase());
      });

      // Get unique V2 users not in V1
      const v2UserMap = new Map<string, { itemsCompleted: number; lastCompletedAt: string }>();
      (v2ChecklistCompletions || []).forEach(row => {
        const identifier = row.user_identifier;
        if (v1Emails.has(identifier.toLowerCase())) return;
        const existing = v2UserMap.get(identifier);
        if (!existing) {
          v2UserMap.set(identifier, { itemsCompleted: 1, lastCompletedAt: row.completed_at });
        } else {
          existing.itemsCompleted += 1;
          if (row.completed_at > existing.lastCompletedAt) existing.lastCompletedAt = row.completed_at;
        }
      });

      // Get last_accessed from user_progress for V2 users (page load tracking)
      const v2Identifiers = Array.from(v2UserMap.keys());
      let v2ProgressMap = new Map<string, { last_accessed: string | null; created_at: string; id: string; email: string | null; name: string | null }>();
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
              email: up.email,
              name: up.name
            });
          }
        });
      }

      // Build combined user list for V2 users as pseudo user_progress entries
      const v2AsProgressEntries = Array.from(v2UserMap.entries()).map(([identifier, data]) => {
        const progressInfo = v2ProgressMap.get(identifier.toLowerCase());
        return {
          id: progressInfo?.id ?? identifier,
          email: identifier,
          name: progressInfo?.name ?? null,
          last_accessed: progressInfo?.last_accessed ?? progressInfo?.created_at ?? null,
          created_at: progressInfo?.created_at ?? new Date().toISOString()
        };
      });

      // Build V2 pseudo module completions for metrics processing
      const v2AsModuleCompletions = Array.from(v2UserMap.entries()).flatMap(([identifier, data]) => {
        const progressInfo = v2ProgressMap.get(identifier.toLowerCase());
        const userId = progressInfo?.id ?? identifier;
        return Array.from({ length: data.itemsCompleted }, (_, i) => ({
          user_id: userId,
          category_id: 'checklist',
          module_id: `item-${i}`,
          completed_at: data.lastCompletedAt
        }));
      });

      const allUserProgress = [...(userProgressData || []), ...v2AsProgressEntries];
      const allModuleCompletions = [...(moduleCompletionData || []), ...v2AsModuleCompletions];

      // Process the data to calculate metrics
      const processedMetrics = processMetrics(allUserProgress, allModuleCompletions);
      const processedActivities = processUserActivities(allUserProgress, allModuleCompletions);

      setMetrics(processedMetrics);
      setUserActivities(processedActivities);

      setLoadError(null);
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
      setLoadError(loadErrorText(error, "Couldn't load activity."));
    } finally {
      stop();
      setLoading(false);
    }
  };

  const processMetrics = (userProgress: any[], moduleCompletion: any[]): DashboardMetrics => {
    const totalVideos = 22;
    
    // Users onboarded = count of user_progress records
    const usersOnboarded = userProgress.length;

    // Calculate average completion rate
    let totalCompletionSum = 0;
    const userCompletions = new Map<string, number>();

    // Count completions per user
    moduleCompletion.forEach(completion => {
      const userId = completion.user_id;
      userCompletions.set(userId, (userCompletions.get(userId) || 0) + 1);
    });

    // Calculate average completion rate
    const completionRates = Array.from(userCompletions.values()).map(count => (count / totalVideos) * 100);
    const averageCompletionRate = completionRates.length > 0 
      ? completionRates.reduce((sum, rate) => sum + rate, 0) / completionRates.length 
      : 0;

    // Find most watched video
    const videoFrequency = new Map<string, number>();
    moduleCompletion.forEach(completion => {
      const videoKey = `${completion.category_id} - ${completion.module_id}`;
      videoFrequency.set(videoKey, (videoFrequency.get(videoKey) || 0) + 1);
    });

    let mostWatchedVideo = "N/A";
    let maxFrequency = 0;
    videoFrequency.forEach((frequency, video) => {
      if (frequency > maxFrequency) {
        maxFrequency = frequency;
        mostWatchedVideo = video;
      }
    });

    return {
      usersOnboarded,
      averageCompletionRate: Math.round(averageCompletionRate),
      mostWatchedVideo
    };
  };

  const processUserActivities = (userProgress: any[], moduleCompletion: any[]): UserActivity[] => {
    const totalVideos = 22;
    
    return userProgress.map(user => {
      // Get completions for this user
      const userCompletions = moduleCompletion.filter(completion => completion.user_id === user.id);
      
      // Find most recent completion
      const sortedCompletions = userCompletions.sort((a, b) => 
        new Date(b.completed_at).getTime() - new Date(a.completed_at).getTime()
      );
      
      const lastCompletion = sortedCompletions[0];

      // Use last_accessed from user_progress, only fallback to created_at if last_accessed is null/undefined
      const lastAccessDate = user.last_accessed ?? user.created_at;

      return {
        id: user.id,
        email: user.email || null,
        name: user.name || null,
        videosCompleted: userCompletions.length,
        totalVideos,
        lastCategory: lastCompletion ? lastCompletion.category_id : "N/A",
        lastVideo: lastCompletion ? lastCompletion.module_id : "N/A",
        lastLogin: lastAccessDate
      };
    });
  };

  const formatDaysAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInTime = now.getTime() - date.getTime();
    const diffInDays = Math.floor(diffInTime / (1000 * 3600 * 24));
    
    if (diffInDays === 0) {
      return "Today";
    } else if (diffInDays === 1) {
      return "1 day ago";
    } else {
      return `${diffInDays} days ago`;
    }
  };

  const getCompletionBadgeVariant = (completed: number, total: number) => {
    const percentage = (completed / total) * 100;
    if (percentage >= 80) return "default";
    if (percentage >= 50) return "secondary";
    return "outline";
  };

  if (loadError) return <LoadNotice error={loadError} onRetry={() => setLoadAttempt((attempt) => attempt + 1)} />;
  if (loading) {
    return <PanelSkeleton stats={4} rows={6} />;
  }

  return (
    <div className="space-y-6">

      {/* Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="border-border/50 shadow-card hover:shadow-elevated transition-all duration-200">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Users Onboarded</CardTitle>
            <Users className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">{metrics.usersOnboarded}</div>
            <p className="text-xs text-muted-foreground">Total users who accessed your onboarding</p>
          </CardContent>
        </Card>

        <Card className="border-border/50 shadow-card hover:shadow-elevated transition-all duration-200">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Avg. Completion Rate</CardTitle>
            <TrendingUp className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">{metrics.averageCompletionRate}%</div>
            <p className="text-xs text-muted-foreground">Average videos watched per user</p>
          </CardContent>
        </Card>

        <Card className="border-border/50 shadow-card hover:shadow-elevated transition-all duration-200">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Most Watched Video</CardTitle>
            <PlayCircle className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-sm font-bold text-foreground truncate" title={metrics.mostWatchedVideo}>
              {metrics.mostWatchedVideo}
            </div>
            <p className="text-xs text-muted-foreground">Most popular video content</p>
          </CardContent>
        </Card>
      </div>

      {/* User Activities Table */}
      <Card className="border-border/50 shadow-card">
        <CardHeader>
          <CardTitle className="text-lg font-semibold text-foreground">User Activity</CardTitle>
          <p className="text-sm text-muted-foreground">Detailed view of all users who have accessed your onboarding platform</p>
        </CardHeader>
        <CardContent>
          {userActivities.length === 0 ? (
            <div className="text-center py-8">
              <Users className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">No user activity data available</p>
              <p className="text-sm text-muted-foreground">Users will appear here once they start using your onboarding platform</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>User</TableHead>
                    <TableHead>Videos Completed</TableHead>
                    <TableHead>Last Category</TableHead>
                    <TableHead>Last Video</TableHead>
                    <TableHead>Last Login</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {userActivities.map((activity) => (
                    <TableRow key={activity.id}>
                      <TableCell className="font-medium">
                        <div className="flex flex-col">
                          {activity.name && (
                            <span className="font-semibold">{activity.name}</span>
                          )}
                          {activity.email && (
                            <span className={activity.name ? "text-sm text-muted-foreground" : ""}>{activity.email}</span>
                          )}
                          {!activity.name && !activity.email && (
                            <span className="text-muted-foreground">Unknown User</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={getCompletionBadgeVariant(activity.videosCompleted, activity.totalVideos)}>
                          {activity.videosCompleted} / {activity.totalVideos}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm font-medium">{activity.lastCategory}</span>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm">{activity.lastVideo}</span>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm text-muted-foreground">{formatDaysAgo(activity.lastLogin)}</span>
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
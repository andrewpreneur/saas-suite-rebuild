import { useState, useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { toast } from "sonner";
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from "recharts";
import { 
  Users, Activity, CheckCircle, XCircle, Clock, TrendingUp, 
  LogIn, Settings, Search, RefreshCw, Shield, LogOut,
  Calendar, Video, MessageSquare, Ticket, Palette, Mail,
  ListPlus, List, UserPlus, Trash2, Send, Ban, Download
} from "lucide-react";
import { LoginAsUser } from "@/components/LoginAsUser";
import { TipsAdoptionPanel } from "@/components/admin/TipsAdoptionPanel";
import { UserProgressPanel } from "@/components/admin/UserProgressPanel";
import OnboardingFunnelPanel from "@/components/admin/OnboardingFunnelPanel";
import PlatformEmailsPanel from "@/components/admin/PlatformEmailsPanel";
import AffiliateManagerPanel from "@/components/admin/AffiliateManagerPanel";
import CopilotConversationsPanel from "@/components/admin/CopilotConversationsPanel";
import FulfillmentPanel from "@/components/admin/FulfillmentPanel";
import CustomDomainsPanel from "@/components/admin/CustomDomainsPanel";
import PageAnalyticsPanel from "@/components/admin/PageAnalyticsPanel";
import RevenueAnalyticsPanel from "@/components/admin/RevenueAnalyticsPanel";
import SignupStatsPanel from "@/components/admin/SignupStatsPanel";
import MenuLinkOutreachPanel from "@/components/admin/MenuLinkOutreachPanel";
import { isPlatformAdminEmail } from "@/lib/platformAdmins";
// Limited admin: can only use the Platform Emails tool.
const EMAIL_ONLY_ADMIN = "rendersgallery0@gmail.com";

interface UserData {
  id: number;
  email: string | null;
  approval: string | null;
  created_at: string;
  last_accessed: string | null;
  login_count: number | null;
  onboarding_completed: boolean | null;
  primary_color: string | null;
  secondary_color: string | null;
  tertiary_color: string | null;
  agency_id: string | null;
  agency_id_basic: string | null;
  agency_id_advanced: string | null;
  agency_id_elite: string | null;
  original_agency_id: string | null;
  original_agency_id_basic: string | null;
  original_agency_id_advanced: string | null;
  original_agency_id_elite: string | null;
  trial_start_date: string | null;
  trial_length: number;
  branded_ai_support: boolean;
  support_ticketing_enabled: boolean;
  email_warmup_access: boolean;
  free_leads_access: boolean;
  client_hub_enabled: boolean;
  videos_watched_count: number | null;
  ai_questions_count: number | null;
  tickets_opened_count: number | null;
  full_name: string | null;
  source: string | null;
  agency_user_count?: number;
  v2_navigation_enabled: boolean;
  plan?: string;
}

interface AdminList {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
  member_count?: number;
}

interface DashboardStats {
  totalUsers: number;
  approvedUsers: number;
  rejectedUsers: number;
  canceledUsers: number;
  unknownUsers: number;
  activeWithin7Days: number;
  activeWithin14Days: number;
  activeWithin30Days: number;
  inactiveUsers: number;
  onboardingCompleted: number;
  hasColors: number;
  hasBrandedAI: number;
  hasSupportTicketing: number;
  hasEmailWarmup: number;
  hasFreeLeads: number;
  hasClientHub: number;
}

const Admin = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loginLoading, setLoginLoading] = useState(false);
  const [users, setUsers] = useState<UserData[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<UserData[]>([]);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [approvalFilter, setApprovalFilter] = useState<string>("all");
  const [activityFilter, setActivityFilter] = useState<string>("all");
  const [versionFilter, setVersionFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [agencyUserSort, setAgencyUserSort] = useState<"asc" | "desc" | null>(null);
  const [hasUsersFilter, setHasUsersFilter] = useState<string>("all");
  const [loginCountOperator, setLoginCountOperator] = useState<string>("all");
  const [loginCountValue, setLoginCountValue] = useState<string>("");
  const [planFilter, setPlanFilter] = useState<string>("all");

  // Selection state
  const [selectedUsers, setSelectedUsers] = useState<Set<string>>(new Set());
  const [selectAll, setSelectAll] = useState(false);

  // Email state
  const [emailDialogOpen, setEmailDialogOpen] = useState(false);
  const [emailSubject, setEmailSubject] = useState("");
  const [emailBody, setEmailBody] = useState("");
  const [sendingEmail, setSendingEmail] = useState(false);

  // Lists state
  const [lists, setLists] = useState<AdminList[]>([]);
  const [listsDialogOpen, setListsDialogOpen] = useState(false);
  const [newListName, setNewListName] = useState("");
  const [newListDescription, setNewListDescription] = useState("");
  const [creatingList, setCreatingList] = useState(false);
  const [addToListDialogOpen, setAddToListDialogOpen] = useState(false);
  const [selectedListId, setSelectedListId] = useState<string>("");
  const [addingToList, setAddingToList] = useState(false);

  // Pie chart colors
  const ACTIVITY_COLORS = {
    "Active (7d)": "#22c55e",
    "Active (14d)": "#3b82f6", 
    "Active (30d)": "#eab308",
    "Inactive": "#ef4444",
    "Never": "#6b7280"
  };

  // Compute activity breakdown for approved users
  const approvedActivityData = useMemo(() => {
    const approvedUsers = users.filter(u => u.approval?.toUpperCase() === "YES");
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const counts = {
      "Active (7d)": 0,
      "Active (14d)": 0,
      "Active (30d)": 0,
      "Inactive": 0,
      "Never": 0
    };

    approvedUsers.forEach(user => {
      if (!user.last_accessed) {
        counts["Never"]++;
      } else {
        const loginDate = new Date(user.last_accessed);
        if (loginDate >= sevenDaysAgo) {
          counts["Active (7d)"]++;
        } else if (loginDate >= fourteenDaysAgo) {
          counts["Active (14d)"]++;
        } else if (loginDate >= thirtyDaysAgo) {
          counts["Active (30d)"]++;
        } else {
          counts["Inactive"]++;
        }
      }
    });

    return Object.entries(counts)
      .filter(([_, value]) => value > 0)
      .map(([name, value]) => ({ name, value, fill: ACTIVITY_COLORS[name as keyof typeof ACTIVITY_COLORS] }));
  }, [users]);

  useEffect(() => {
    checkAuth();
  }, []);

  useEffect(() => {
    filterUsers();
  }, [users, approvalFilter, activityFilter, versionFilter, searchQuery, agencyUserSort, hasUsersFilter, loginCountOperator, loginCountValue, planFilter]);

  useEffect(() => {
    if (selectAll) {
      setSelectedUsers(new Set(filteredUsers.map(u => u.email || "")));
    }
  }, [selectAll, filteredUsers]);

  const [emailOnly, setEmailOnly] = useState(false);

  const checkAuth = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    const sessEmail = session?.user?.email?.toLowerCase();
    if (sessEmail === EMAIL_ONLY_ADMIN) {
      setEmailOnly(true);
      setIsAuthenticated(true);
    } else if (isPlatformAdminEmail(sessEmail)) {
      setIsAuthenticated(true);
      fetchData();
      fetchLists();
    }
    setIsLoading(false);
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginLoading(true);

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password,
      });

      if (error) {
        toast.error("Invalid credentials");
        setLoginLoading(false);
        return;
      }

      if (data.user?.email?.toLowerCase() === EMAIL_ONLY_ADMIN) {
        setEmailOnly(true);
        setIsAuthenticated(true);
        setLoginLoading(false);
        return;
      }
      if (!isPlatformAdminEmail(data.user?.email)) {
        await (await import("@/lib/hardSignOut")).hardSignOut();
        toast.error("Unauthorized access");
        setLoginLoading(false);
        return;
      }

      setIsAuthenticated(true);
      toast.success("Welcome back, Admin!");
      fetchData();
      fetchLists();
    } catch (err) {
      toast.error("Login failed");
    } finally {
      setLoginLoading(false);
    }
  };

  const handleLogout = async () => {
    await (await import("@/lib/hardSignOut")).hardSignOut();
    setIsAuthenticated(false);
    setEmailOnly(false);
    setUsers([]);
    setStats(null);
    setLists([]);
  };

  const fetchData = async () => {
    setRefreshing(true);
    try {
      // Fetch all users - need to paginate to get all 300+ records
      let allUsers: UserData[] = [];
      let from = 0;
      const pageSize = 1000;
      
      while (true) {
        const { data, error } = await supabase
          .from("saas_suite_users")
          .select("*")
          .order("created_at", { ascending: false })
          .range(from, from + pageSize - 1);
        
        if (error) {
          console.error("Error fetching users:", error);
          toast.error("Failed to fetch user data");
          return;
        }
        
        if (!data || data.length === 0) break;
        
        allUsers = [...allUsers, ...(data as UserData[])];
        
        if (data.length < pageSize) break;
        from += pageSize;
      }
      
      console.log(`Fetched ${allUsers.length} total users`);

      // Fetch agency user counts from user_progress table
      const { data: progressData } = await supabase
        .from("user_progress")
        .select("agency_id");

      // Count users per agency
      const agencyCounts: Record<string, number> = {};
      if (progressData) {
        progressData.forEach(p => {
          if (p.agency_id) {
            agencyCounts[p.agency_id] = (agencyCounts[p.agency_id] || 0) + 1;
          }
        });
      }

      // Add agency user counts to user data
      const userData = allUsers.map(user => {
        let count = 0;
        // Check all possible agency IDs (deduplicate to avoid double-counting)
        const agencyIds = [...new Set([
          user.agency_id,
          user.agency_id_basic,
          user.agency_id_advanced,
          user.agency_id_elite,
          user.original_agency_id,
          user.original_agency_id_basic,
          user.original_agency_id_advanced,
          user.original_agency_id_elite,
        ].filter(Boolean))];

        agencyIds.forEach(id => {
          if (id && agencyCounts[id]) {
            count += agencyCounts[id];
          }
        });

        return { ...user, agency_user_count: count };
      });

      setUsers(userData);
      calculateStats(userData);
    } catch (err) {
      console.error("Error:", err);
      toast.error("An error occurred");
    } finally {
      setRefreshing(false);
    }
  };

  const fetchLists = async () => {
    try {
      const { data: listsData, error: listsError } = await supabase
        .from("admin_lists")
        .select("*")
        .order("created_at", { ascending: false });

      if (listsError) {
        console.error("Error fetching lists:", listsError);
        return;
      }

      // Get member counts for each list
      const { data: membersData } = await supabase
        .from("admin_list_members")
        .select("list_id");

      const memberCounts: Record<string, number> = {};
      if (membersData) {
        membersData.forEach(m => {
          memberCounts[m.list_id] = (memberCounts[m.list_id] || 0) + 1;
        });
      }

      const listsWithCounts = (listsData || []).map(list => ({
        ...list,
        member_count: memberCounts[list.id] || 0
      }));

      setLists(listsWithCounts);
    } catch (err) {
      console.error("Error fetching lists:", err);
    }
  };

  const calculateStats = (userData: UserData[]) => {
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    // Canceled users: approval is NO AND agency_id ends with 'NO'
    const canceledUsers = userData.filter(u => 
      u.approval?.toUpperCase() === "NO" && 
      u.agency_id?.endsWith("NO")
    );
    // Rejected users: approval is NO but NOT canceled
    const rejectedUsers = userData.filter(u => 
      u.approval?.toUpperCase() === "NO" && 
      !u.agency_id?.endsWith("NO")
    );

    const stats: DashboardStats = {
      totalUsers: userData.length,
      approvedUsers: userData.filter(u => u.approval?.toUpperCase() === "YES").length,
      rejectedUsers: rejectedUsers.length,
      canceledUsers: canceledUsers.length,
      unknownUsers: userData.filter(u => !u.approval || !["YES", "NO"].includes(u.approval.toUpperCase())).length,
      activeWithin7Days: userData.filter(u => u.last_accessed && new Date(u.last_accessed) >= sevenDaysAgo).length,
      activeWithin14Days: userData.filter(u => u.last_accessed && new Date(u.last_accessed) >= fourteenDaysAgo && new Date(u.last_accessed) < sevenDaysAgo).length,
      activeWithin30Days: userData.filter(u => u.last_accessed && new Date(u.last_accessed) >= thirtyDaysAgo && new Date(u.last_accessed) < fourteenDaysAgo).length,
      inactiveUsers: userData.filter(u => !u.last_accessed || new Date(u.last_accessed) < thirtyDaysAgo).length,
      onboardingCompleted: userData.filter(u => u.onboarding_completed).length,
      hasColors: userData.filter(u => u.primary_color || u.secondary_color || u.tertiary_color).length,
      hasBrandedAI: userData.filter(u => u.branded_ai_support).length,
      hasSupportTicketing: userData.filter(u => u.support_ticketing_enabled).length,
      hasEmailWarmup: userData.filter(u => u.email_warmup_access).length,
      hasFreeLeads: userData.filter(u => u.free_leads_access).length,
      hasClientHub: userData.filter(u => u.client_hub_enabled).length,
    };

    setStats(stats);
  };

  const filterUsers = () => {
    let filtered = [...users];

    if (approvalFilter !== "all") {
      if (approvalFilter === "unknown") {
        filtered = filtered.filter(u => !u.approval || !["YES", "NO"].includes(u.approval.toUpperCase()));
      } else if (approvalFilter === "canceled") {
        // Canceled users: approval is NO AND agency_id ends with 'NO' (from suspend function)
        filtered = filtered.filter(u => 
          u.approval?.toUpperCase() === "NO" && 
          u.agency_id?.endsWith("NO")
        );
      } else if (approvalFilter === "no") {
        // Rejected users: approval is NO but NOT canceled (agency_id doesn't end with 'NO')
        filtered = filtered.filter(u => 
          u.approval?.toUpperCase() === "NO" && 
          !u.agency_id?.endsWith("NO")
        );
      } else {
        filtered = filtered.filter(u => u.approval?.toUpperCase() === approvalFilter.toUpperCase());
      }
    }

    if (activityFilter !== "all") {
      const now = new Date();
      const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

      switch (activityFilter) {
        case "7days":
          filtered = filtered.filter(u => u.last_accessed && new Date(u.last_accessed) >= sevenDaysAgo);
          break;
        case "14days":
          filtered = filtered.filter(u => u.last_accessed && new Date(u.last_accessed) >= fourteenDaysAgo && new Date(u.last_accessed) < sevenDaysAgo);
          break;
        case "30days":
          filtered = filtered.filter(u => u.last_accessed && new Date(u.last_accessed) >= thirtyDaysAgo && new Date(u.last_accessed) < fourteenDaysAgo);
          break;
        case "inactive":
          filtered = filtered.filter(u => u.last_accessed && new Date(u.last_accessed) < thirtyDaysAgo);
          break;
        case "never":
          filtered = filtered.filter(u => !u.last_accessed);
          break;
      }
    }

    // Filter by V1/V2 version
    if (versionFilter !== "all") {
      if (versionFilter === "v2") {
        filtered = filtered.filter(u => u.v2_navigation_enabled === true);
      } else if (versionFilter === "v1") {
        filtered = filtered.filter(u => u.v2_navigation_enabled === false);
      }
    }

    // Filter by has users
    if (hasUsersFilter !== "all") {
      if (hasUsersFilter === "yes") {
        filtered = filtered.filter(u => (u.agency_user_count || 0) > 0);
      } else if (hasUsersFilter === "no") {
        filtered = filtered.filter(u => (u.agency_user_count || 0) === 0);
      }
    }

    // Filter by plan
    if (planFilter !== "all") {
      filtered = filtered.filter(u => u.plan === planFilter);
    }

    // Filter by login count
    if (loginCountOperator !== "all" && loginCountValue !== "") {
      const target = parseInt(loginCountValue, 10);
      if (!isNaN(target)) {
        filtered = filtered.filter(u => {
          const count = u.login_count || 0;
          switch (loginCountOperator) {
            case "lt": return count < target;
            case "gt": return count > target;
            case "eq": return count === target;
            default: return true;
          }
        });
      }
    }

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(u => 
        u.email?.toLowerCase().includes(query) ||
        u.full_name?.toLowerCase().includes(query) ||
        u.agency_id?.toLowerCase().includes(query)
      );
    }

    // Apply agency user sort
    if (agencyUserSort) {
      filtered.sort((a, b) => {
        const countA = a.agency_user_count || 0;
        const countB = b.agency_user_count || 0;
        return agencyUserSort === "asc" ? countA - countB : countB - countA;
      });
    }

    setFilteredUsers(filtered);
  };

  const toggleUserSelection = (email: string) => {
    const newSelected = new Set(selectedUsers);
    if (newSelected.has(email)) {
      newSelected.delete(email);
    } else {
      newSelected.add(email);
    }
    setSelectedUsers(newSelected);
    setSelectAll(false);
  };

  const toggleSelectAll = () => {
    if (selectAll) {
      setSelectedUsers(new Set());
      setSelectAll(false);
    } else {
      setSelectedUsers(new Set(filteredUsers.map(u => u.email || "").filter(Boolean)));
      setSelectAll(true);
    }
  };

  const handleSendEmail = async () => {
    if (selectedUsers.size === 0) {
      toast.error("Please select at least one recipient");
      return;
    }

    if (!emailSubject.trim() || !emailBody.trim()) {
      toast.error("Please fill in subject and body");
      return;
    }

    setSendingEmail(true);
    try {
      const recipients = Array.from(selectedUsers).filter(Boolean);
      
      const { data, error } = await supabase.functions.invoke('send-admin-email', {
        body: {
          recipients,
          subject: emailSubject,
          body: emailBody,
        }
      });

      if (error) throw error;

      toast.success(`Email sent to ${recipients.length} recipient(s)`);
      setEmailDialogOpen(false);
      setEmailSubject("");
      setEmailBody("");
      setSelectedUsers(new Set());
      setSelectAll(false);
    } catch (err) {
      console.error("Error sending email:", err);
      toast.error("Failed to send email");
    } finally {
      setSendingEmail(false);
    }
  };

  const handleCreateList = async () => {
    if (!newListName.trim()) {
      toast.error("Please enter a list name");
      return;
    }

    setCreatingList(true);
    try {
      const { error } = await supabase
        .from("admin_lists")
        .insert({
          name: newListName.trim(),
          description: newListDescription.trim() || null
        });

      if (error) throw error;

      toast.success("List created successfully");
      setNewListName("");
      setNewListDescription("");
      fetchLists();
    } catch (err) {
      console.error("Error creating list:", err);
      toast.error("Failed to create list");
    } finally {
      setCreatingList(false);
    }
  };

  const handleDeleteList = async (listId: string) => {
    try {
      const { error } = await supabase
        .from("admin_lists")
        .delete()
        .eq("id", listId);

      if (error) throw error;

      toast.success("List deleted");
      fetchLists();
    } catch (err) {
      console.error("Error deleting list:", err);
      toast.error("Failed to delete list");
    }
  };

  const handleAddToList = async () => {
    if (!selectedListId) {
      toast.error("Please select a list");
      return;
    }

    if (selectedUsers.size === 0) {
      toast.error("Please select at least one user");
      return;
    }

    setAddingToList(true);
    try {
      const members = Array.from(selectedUsers)
        .filter(Boolean)
        .map(email => ({
          list_id: selectedListId,
          user_email: email
        }));

      const { error } = await supabase
        .from("admin_list_members")
        .upsert(members, { onConflict: 'list_id,user_email' });

      if (error) throw error;

      toast.success(`Added ${members.length} user(s) to list`);
      setAddToListDialogOpen(false);
      setSelectedListId("");
      setSelectedUsers(new Set());
      setSelectAll(false);
      fetchLists();
    } catch (err) {
      console.error("Error adding to list:", err);
      toast.error("Failed to add users to list");
    } finally {
      setAddingToList(false);
    }
  };

  const handleExportCSV = () => {
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const getActivityLabel = (user: UserData): string => {
      if (!user.last_accessed) return "Never";
      const loginDate = new Date(user.last_accessed);
      if (loginDate >= sevenDaysAgo) return "Active (7d)";
      if (loginDate >= fourteenDaysAgo) return "Active (14d)";
      if (loginDate >= thirtyDaysAgo) return "Active (30d)";
      return "Inactive";
    };

    const getStatusLabel = (user: UserData): string => {
      const approval = user.approval?.toUpperCase();
      if (approval === "NO" && user.agency_id?.endsWith("NO")) return "Canceled";
      if (approval === "NO") return "Rejected";
      if (approval === "YES") return "Approved";
      return "Unknown";
      return "Unknown";
    };

    const headers = ["Email", "Plan", "Agency Name", "Agency ID", "Status", "Activity", "Agency Users", "Last Login"];
    const rows = filteredUsers.map(user => [
      user.email || "",
      (user as any).plan || "",
      (user as any).agency_name || "",
      user.agency_id || "",
      getStatusLabel(user),
      getActivityLabel(user),
      user.agency_user_count?.toString() || "0",
      user.last_accessed ? new Date(user.last_accessed).toLocaleDateString() : "Never"
    ]);

    const csvContent = [
      headers.join(","),
      ...rows.map(row => row.map(cell => `"${cell.replace(/"/g, '""')}"`).join(","))
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `users-export-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    toast.success(`Exported ${filteredUsers.length} users to CSV`);
  };

  const getApprovalBadge = (approval: string | null) => {
    const status = approval?.toUpperCase();
    switch (status) {
      case "YES":
        return <Badge className="bg-green-500/20 text-green-400 border-green-500/30">Approved</Badge>;
      case "NO":
        return <Badge className="bg-red-500/20 text-red-400 border-red-500/30">Rejected</Badge>;
      case "TRIALING":
        return <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30">Legacy</Badge>;
      default:
        return <Badge className="bg-gray-500/20 text-gray-400 border-gray-500/30">Unknown</Badge>;
    }
  };

  const getActivityBadge = (lastLogin: string | null) => {
    if (!lastLogin) return <Badge className="bg-gray-500/20 text-gray-400 border-gray-500/30">Never</Badge>;
    
    const now = new Date();
    const loginDate = new Date(lastLogin);
    const daysSince = Math.floor((now.getTime() - loginDate.getTime()) / (1000 * 60 * 60 * 24));

    if (daysSince <= 7) {
      return <Badge className="bg-green-500/20 text-green-400 border-green-500/30">Active (7d)</Badge>;
    } else if (daysSince <= 14) {
      return <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30">Active (14d)</Badge>;
    } else if (daysSince <= 30) {
      return <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30">Active (30d)</Badge>;
    } else {
      return <Badge className="bg-red-500/20 text-red-400 border-red-500/30">Inactive</Badge>;
    }
  };

  const formatDate = (date: string | null) => {
    if (!date) return "Never";
    return new Date(date).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mb-4">
              <Shield className="w-6 h-6 text-primary" />
            </div>
            <CardTitle>Admin Access</CardTitle>
            <CardDescription>Enter your credentials to access the admin dashboard</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Enter your email"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  required
                />
              </div>
              <Button type="submit" className="w-full" disabled={loginLoading}>
                {loginLoading ? "Signing in..." : "Sign In"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (emailOnly) {
    return (
      <div className="min-h-screen bg-background">
        <div className="border-b bg-card">
          <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
            <h1 className="text-xl font-bold">Platform Emails</h1>
            <Button variant="outline" size="sm" onClick={handleLogout}>Log out</Button>
          </div>
        </div>
        <div className="max-w-7xl mx-auto px-4 py-6">
          <PlatformEmailsPanel />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b bg-card">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
              <Shield className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h1 className="text-xl font-bold">SaaS Suite Admin</h1>
              <p className="text-sm text-muted-foreground">Software Management Dashboard</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <LoginAsUser />
            <Button variant="outline" size="sm" onClick={fetchData} disabled={refreshing}>
              <RefreshCw className={`w-4 h-4 mr-2 ${refreshing ? "animate-spin" : ""}`} />
              Refresh
            </Button>
            <Button variant="ghost" size="sm" onClick={handleLogout}>
              <LogOut className="w-4 h-4 mr-2" />
              Logout
            </Button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
        {/* Stats Overview */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <Users className="w-8 h-8 text-primary" />
                  <div>
                    <p className="text-2xl font-bold">{stats.totalUsers}</p>
                    <p className="text-xs text-muted-foreground">Total Users</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <CheckCircle className="w-8 h-8 text-green-500" />
                  <div>
                    <p className="text-2xl font-bold">{stats.approvedUsers}</p>
                    <p className="text-xs text-muted-foreground">Approved</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <Clock className="w-8 h-8 text-yellow-500" />
                  <div>
                    <p className="text-2xl font-bold">{stats.unknownUsers}</p>
                    <p className="text-xs text-muted-foreground">Unknown</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <XCircle className="w-8 h-8 text-red-500" />
                  <div>
                    <p className="text-2xl font-bold">{stats.rejectedUsers}</p>
                    <p className="text-xs text-muted-foreground">Rejected</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <Ban className="w-8 h-8 text-orange-500" />
                  <div>
                    <p className="text-2xl font-bold">{stats.canceledUsers}</p>
                    <p className="text-xs text-muted-foreground">Canceled</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <Activity className="w-8 h-8 text-blue-500" />
                  <div>
                    <p className="text-2xl font-bold">{stats.activeWithin7Days}</p>
                    <p className="text-xs text-muted-foreground">Active (7d)</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <TrendingUp className="w-8 h-8 text-purple-500" />
                  <div>
                    <p className="text-2xl font-bold">{stats.onboardingCompleted}</p>
                    <p className="text-xs text-muted-foreground">Onboarded</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Approved Users Activity Breakdown Chart */}
        {stats && approvedActivityData.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Approved Users Activity Breakdown</CardTitle>
              <CardDescription>Distribution of {stats.approvedUsers} approved users by login activity</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[280px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={approvedActivityData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={100}
                      paddingAngle={2}
                      dataKey="value"
                      label={({ name, value, percent }) => `${name}: ${value} (${(percent * 100).toFixed(0)}%)`}
                      labelLine={true}
                      style={{ cursor: "pointer" }}
                      onClick={(data) => {
                        const name = data.name;
                        setApprovalFilter("yes");
                        if (name === "Active (7d)") setActivityFilter("7days");
                        else if (name === "Active (14d)") setActivityFilter("14days");
                        else if (name === "Active (30d)") setActivityFilter("30days");
                        else if (name === "Inactive") setActivityFilter("inactive");
                        else if (name === "Never") setActivityFilter("never");
                      }}
                    >
                      {approvedActivityData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.fill} style={{ cursor: "pointer" }} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value: number) => [value, "Users"]} />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        )}

        <Tabs defaultValue="users" className="space-y-4">
          <div className="flex items-center justify-between gap-3">
          <TabsList className="flex-wrap h-auto">
            <TabsTrigger value="users">Users</TabsTrigger>
            <TabsTrigger value="progress">User Progress</TabsTrigger>
            <TabsTrigger value="funnel">Onboarding Funnel</TabsTrigger>
            <TabsTrigger value="page-analytics">Page Analytics</TabsTrigger>
            <TabsTrigger value="revenue">Revenue &amp; Churn</TabsTrigger>
            <TabsTrigger value="signups">30-Day Signups</TabsTrigger>
            <TabsTrigger value="menu-link">Menu Link Outreach</TabsTrigger>


            <TabsTrigger value="lists">Lists</TabsTrigger>
            <TabsTrigger value="activity">Activity</TabsTrigger>
            <TabsTrigger value="features">Features</TabsTrigger>
            <TabsTrigger value="tips">Tips Bot</TabsTrigger>
            <TabsTrigger value="platform-emails">Platform Emails</TabsTrigger>
            <TabsTrigger value="affiliates">Affiliates</TabsTrigger>
            <TabsTrigger value="copilot">CoPilot Chats</TabsTrigger>
            <TabsTrigger value="fulfillment">Fulfillment</TabsTrigger>
            <TabsTrigger value="domains">Custom Domains</TabsTrigger>
          </TabsList>
          <div className="flex items-center gap-2 shrink-0">
          <Link
            to="/admin/kit-customers"
            className="text-sm font-medium px-3 py-1.5 rounded-md border border-purple-300 text-purple-800 hover:bg-purple-50 whitespace-nowrap dark:border-purple-700 dark:text-purple-200 dark:hover:bg-purple-950"
          >
            One Feature Kit
          </Link>
          <a
            href="/admin/setup-tracker"
            className="text-sm font-medium px-3 py-1.5 rounded-md border bg-card hover:bg-muted whitespace-nowrap"
          >
            AI Studio Setup Tracker
          </a>
          <a
            href="/admin/support"
            className="text-sm font-medium px-3 py-1.5 rounded-md border bg-primary text-primary-foreground hover:opacity-90 whitespace-nowrap"
          >
            Support Inbox →
          </a>
          </div>
          </div>

          <TabsContent value="users" className="space-y-4">
            {/* Action Bar */}
            {selectedUsers.size > 0 && (
              <Card className="border-primary/50 bg-primary/5">
                <CardContent className="p-4 flex items-center justify-between">
                  <p className="font-medium">{selectedUsers.size} user(s) selected</p>
                  <div className="flex gap-2">
                    <Dialog open={emailDialogOpen} onOpenChange={setEmailDialogOpen}>
                      <DialogTrigger asChild>
                        <Button size="sm">
                          <Mail className="w-4 h-4 mr-2" />
                          Email
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="max-w-lg">
                        <DialogHeader>
                          <DialogTitle>Send Email</DialogTitle>
                          <DialogDescription>
                            Send an email to {selectedUsers.size} selected user(s)
                          </DialogDescription>
                        </DialogHeader>
                        <div className="space-y-4">
                          <div className="space-y-2">
                            <Label>To</Label>
                            <div className="text-sm text-muted-foreground max-h-24 overflow-y-auto p-2 bg-muted rounded">
                              {Array.from(selectedUsers).join(", ")}
                            </div>
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="subject">Subject</Label>
                            <Input
                              id="subject"
                              value={emailSubject}
                              onChange={(e) => setEmailSubject(e.target.value)}
                              placeholder="Email subject..."
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="body">Message</Label>
                            <Textarea
                              id="body"
                              value={emailBody}
                              onChange={(e) => setEmailBody(e.target.value)}
                              placeholder="Write your message..."
                              rows={6}
                            />
                          </div>
                        </div>
                        <DialogFooter>
                          <Button variant="outline" onClick={() => setEmailDialogOpen(false)}>
                            Cancel
                          </Button>
                          <Button onClick={handleSendEmail} disabled={sendingEmail}>
                            {sendingEmail ? (
                              <>Sending...</>
                            ) : (
                              <>
                                <Send className="w-4 h-4 mr-2" />
                                Send Email
                              </>
                            )}
                          </Button>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>

                    <Dialog open={addToListDialogOpen} onOpenChange={setAddToListDialogOpen}>
                      <DialogTrigger asChild>
                        <Button size="sm" variant="outline">
                          <ListPlus className="w-4 h-4 mr-2" />
                          Add to List
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Add to List</DialogTitle>
                          <DialogDescription>
                            Add {selectedUsers.size} user(s) to a list
                          </DialogDescription>
                        </DialogHeader>
                        <div className="space-y-4">
                          <div className="space-y-2">
                            <Label>Select List</Label>
                            <Select value={selectedListId} onValueChange={setSelectedListId}>
                              <SelectTrigger>
                                <SelectValue placeholder="Choose a list..." />
                              </SelectTrigger>
                              <SelectContent>
                                {lists.map(list => (
                                  <SelectItem key={list.id} value={list.id}>
                                    {list.name} ({list.member_count} members)
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                        <DialogFooter>
                          <Button variant="outline" onClick={() => setAddToListDialogOpen(false)}>
                            Cancel
                          </Button>
                          <Button onClick={handleAddToList} disabled={addingToList || !selectedListId}>
                            {addingToList ? "Adding..." : "Add to List"}
                          </Button>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>

                    <Button size="sm" variant="ghost" onClick={() => { setSelectedUsers(new Set()); setSelectAll(false); }}>
                      Clear
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Filters */}
            <Card>
              <CardContent className="p-4">
                <div className="flex flex-wrap gap-4">
                  <div className="flex-1 min-w-[200px]">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input
                        placeholder="Search by email, name, or agency ID..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-10"
                      />
                    </div>
                  </div>
                  <Select value={approvalFilter} onValueChange={setApprovalFilter}>
                    <SelectTrigger className="w-[150px]">
                      <SelectValue placeholder="Approval" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Status</SelectItem>
                      <SelectItem value="yes">Approved</SelectItem>
                      <SelectItem value="starter">Starter</SelectItem>
                      <SelectItem value="trialing">Trialing</SelectItem>
                      <SelectItem value="no">Rejected</SelectItem>
                      <SelectItem value="canceled">Canceled</SelectItem>
                      <SelectItem value="unknown">Unknown</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={activityFilter} onValueChange={setActivityFilter}>
                    <SelectTrigger className="w-[150px]">
                      <SelectValue placeholder="Activity" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Activity</SelectItem>
                      <SelectItem value="7days">Active (7d)</SelectItem>
                      <SelectItem value="14days">Active (14d)</SelectItem>
                      <SelectItem value="30days">Active (30d)</SelectItem>
                      <SelectItem value="inactive">Inactive</SelectItem>
                      <SelectItem value="never">Never</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={versionFilter} onValueChange={setVersionFilter}>
                    <SelectTrigger className="w-[130px]">
                      <SelectValue placeholder="Version" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Versions</SelectItem>
                      <SelectItem value="v1">Using V1</SelectItem>
                      <SelectItem value="v2">Using V2</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={planFilter} onValueChange={setPlanFilter}>
                    <SelectTrigger className="w-[130px]">
                      <SelectValue placeholder="Plan" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Plans</SelectItem>
                      <SelectItem value="STARTER">Starter</SelectItem>
                      <SelectItem value="BASIC">Basic</SelectItem>
                      <SelectItem value="ADVANCED">Advanced</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={hasUsersFilter} onValueChange={setHasUsersFilter}>
                    <SelectTrigger className="w-[130px]">
                      <SelectValue placeholder="Has Users?" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Users</SelectItem>
                      <SelectItem value="yes">Has Users</SelectItem>
                      <SelectItem value="no">No Users</SelectItem>
                    </SelectContent>
                  </Select>
                  <div className="flex items-center gap-1">
                    <Select value={loginCountOperator} onValueChange={setLoginCountOperator}>
                      <SelectTrigger className="w-[120px]">
                        <SelectValue placeholder="Logins" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Logins</SelectItem>
                        <SelectItem value="lt">Logins &lt;</SelectItem>
                        <SelectItem value="gt">Logins &gt;</SelectItem>
                        <SelectItem value="eq">Logins =</SelectItem>
                      </SelectContent>
                    </Select>
                    {loginCountOperator !== "all" && (
                      <Input
                        type="number"
                        placeholder="#"
                        value={loginCountValue}
                        onChange={(e) => setLoginCountValue(e.target.value)}
                        className="w-[70px]"
                      />
                    )}
                  </div>
                  <Button 
                    size="sm" 
                    variant="outline" 
                    onClick={handleExportCSV}
                    className="flex items-center gap-2"
                  >
                    <Download className="w-4 h-4" />
                    Export CSV
                  </Button>
                </div>
                <p className="text-sm text-muted-foreground mt-2">
                  Showing {filteredUsers.length} of {users.length} users
                </p>
              </CardContent>
            </Card>

            {/* Users Table */}
            <Card>
              <ScrollArea className="h-[500px]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">
                        <Checkbox
                          checked={selectAll}
                          onCheckedChange={toggleSelectAll}
                        />
                      </TableHead>
                      <TableHead>User</TableHead>
                      <TableHead>Agency ID</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Activity</TableHead>
                      <TableHead>Onboarding</TableHead>
                      <TableHead>Colors</TableHead>
                      <TableHead 
                        className="cursor-pointer hover:bg-muted/50 select-none"
                        onClick={() => {
                          if (agencyUserSort === null) setAgencyUserSort("desc");
                          else if (agencyUserSort === "desc") setAgencyUserSort("asc");
                          else setAgencyUserSort(null);
                        }}
                      >
                        <div className="flex items-center gap-1">
                          Agency Users
                          {agencyUserSort === "desc" && <span>↓</span>}
                          {agencyUserSort === "asc" && <span>↑</span>}
                        </div>
                      </TableHead>
                      <TableHead>V2</TableHead>
                      <TableHead>Logins</TableHead>
                      <TableHead>Last Login</TableHead>
                      <TableHead>Created</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredUsers.map((user) => (
                      <TableRow key={user.id}>
                        <TableCell>
                          <Checkbox
                            checked={selectedUsers.has(user.email || "")}
                            onCheckedChange={() => toggleUserSelection(user.email || "")}
                            disabled={!user.email}
                          />
                        </TableCell>
                        <TableCell>
                          <div>
                            <p className="font-medium">{user.email || "No email"}</p>
                            {user.full_name && (
                              <p className="text-sm text-muted-foreground">{user.full_name}</p>
                            )}
                            {user.agency_id && (
                              <p className="text-xs text-muted-foreground font-mono">{user.agency_id}</p>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          {user.agency_id ? (
                            <span className="text-xs font-mono text-muted-foreground break-all">{user.agency_id}</span>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell>{getApprovalBadge(user.approval)}</TableCell>
                        <TableCell>{getActivityBadge(user.last_accessed)}</TableCell>
                        <TableCell>
                          {user.onboarding_completed ? (
                            <CheckCircle className="w-5 h-5 text-green-500" />
                          ) : (
                            <XCircle className="w-5 h-5 text-gray-400" />
                          )}
                        </TableCell>
                        <TableCell>
                          {(user.primary_color || user.secondary_color || user.tertiary_color) ? (
                            <div className="flex gap-1">
                              {user.primary_color && (
                                <div 
                                  className="w-5 h-5 rounded border" 
                                  style={{ backgroundColor: user.primary_color }}
                                  title={user.primary_color}
                                />
                              )}
                              {user.secondary_color && (
                                <div 
                                  className="w-5 h-5 rounded border" 
                                  style={{ backgroundColor: user.secondary_color }}
                                  title={user.secondary_color}
                                />
                              )}
                              {user.tertiary_color && (
                                <div 
                                  className="w-5 h-5 rounded border" 
                                  style={{ backgroundColor: user.tertiary_color }}
                                  title={user.tertiary_color}
                                />
                              )}
                            </div>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="font-mono">
                            <UserPlus className="w-3 h-3 mr-1" />
                            {user.agency_user_count || 0}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {user.v2_navigation_enabled ? (
                            <Badge className="bg-green-500/20 text-green-400 border-green-500/30">V2</Badge>
                          ) : (
                            <Badge className="bg-gray-500/20 text-gray-400 border-gray-500/30">V1</Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <span className="font-mono">{user.login_count || 0}</span>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {formatDate(user.last_accessed)}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {formatDate(user.created_at)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollArea>
            </Card>
          </TabsContent>

          <TabsContent value="progress" className="space-y-4">
            <UserProgressPanel />
          </TabsContent>

          <TabsContent value="funnel" className="space-y-4">
            <OnboardingFunnelPanel />
          </TabsContent>

          <TabsContent value="page-analytics" className="space-y-4">
            <PageAnalyticsPanel />
          </TabsContent>

          <TabsContent value="revenue" className="space-y-4">
            <RevenueAnalyticsPanel />
          </TabsContent>

          <TabsContent value="signups" className="space-y-4">
            <SignupStatsPanel />
          </TabsContent>

          <TabsContent value="menu-link" className="space-y-4">
            <MenuLinkOutreachPanel />
          </TabsContent>


          <TabsContent value="lists" className="space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Create List */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <ListPlus className="w-5 h-5" />
                    Create New List
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="listName">List Name</Label>
                    <Input
                      id="listName"
                      value={newListName}
                      onChange={(e) => setNewListName(e.target.value)}
                      placeholder="e.g., Active Trial Users"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="listDesc">Description (optional)</Label>
                    <Textarea
                      id="listDesc"
                      value={newListDescription}
                      onChange={(e) => setNewListDescription(e.target.value)}
                      placeholder="Describe this list..."
                      rows={3}
                    />
                  </div>
                  <Button onClick={handleCreateList} disabled={creatingList} className="w-full">
                    {creatingList ? "Creating..." : "Create List"}
                  </Button>
                </CardContent>
              </Card>

              {/* Lists */}
              <Card className="lg:col-span-2">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <List className="w-5 h-5" />
                    Your Lists
                  </CardTitle>
                  <CardDescription>Manage your smart lists</CardDescription>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-[300px]">
                    {lists.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground">
                        <List className="w-12 h-12 mx-auto mb-3 opacity-50" />
                        <p>No lists created yet</p>
                        <p className="text-sm">Create a list to organize your users</p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {lists.map(list => (
                          <div key={list.id} className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
                            <div>
                              <p className="font-medium">{list.name}</p>
                              {list.description && (
                                <p className="text-sm text-muted-foreground">{list.description}</p>
                              )}
                              <p className="text-xs text-muted-foreground mt-1">
                                {list.member_count} member(s) • Created {formatDate(list.created_at)}
                              </p>
                            </div>
                            <Button
                              variant="ghost"
                              size="icon" aria-label="Delete"
                              onClick={() => handleDeleteList(list.id)}
                              className="text-destructive hover:text-destructive"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}
                  </ScrollArea>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="activity" className="space-y-4">
            {stats && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-green-500" />
                      Active Within 7 Days
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-3xl font-bold">{stats.activeWithin7Days}</p>
                    <p className="text-sm text-muted-foreground">
                      {((stats.activeWithin7Days / stats.totalUsers) * 100).toFixed(1)}% of total
                    </p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-blue-500" />
                      Active Within 14 Days
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-3xl font-bold">{stats.activeWithin14Days}</p>
                    <p className="text-sm text-muted-foreground">
                      {((stats.activeWithin14Days / stats.totalUsers) * 100).toFixed(1)}% of total
                    </p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-yellow-500" />
                      Active Within 30 Days
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-3xl font-bold">{stats.activeWithin30Days}</p>
                    <p className="text-sm text-muted-foreground">
                      {((stats.activeWithin30Days / stats.totalUsers) * 100).toFixed(1)}% of total
                    </p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-red-500" />
                      Inactive (30+ Days)
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-3xl font-bold">{stats.inactiveUsers}</p>
                    <p className="text-sm text-muted-foreground">
                      {((stats.inactiveUsers / stats.totalUsers) * 100).toFixed(1)}% of total
                    </p>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* Recent Activity */}
            <Card>
              <CardHeader>
                <CardTitle>Recent Logins</CardTitle>
                <CardDescription>Users who logged in recently</CardDescription>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[300px]">
                  <div className="space-y-3">
                    {users
                      .filter(u => u.last_accessed)
                      .sort((a, b) => new Date(b.last_accessed!).getTime() - new Date(a.last_accessed!).getTime())
                      .slice(0, 20)
                      .map(user => (
                        <div key={user.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                          <div className="flex items-center gap-3">
                            <LogIn className="w-4 h-4 text-muted-foreground" />
                            <div>
                              <p className="font-medium">{user.email}</p>
                              <p className="text-xs text-muted-foreground">{user.full_name}</p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-sm">{formatDate(user.last_accessed)}</p>
                            <p className="text-xs text-muted-foreground">{user.login_count} total logins</p>
                          </div>
                        </div>
                      ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="features" className="space-y-4">
            {stats && (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-lg flex items-center gap-2">
                        <CheckCircle className="w-5 h-5 text-green-500" />
                        Onboarding Completed
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-3xl font-bold">{stats.onboardingCompleted}</p>
                      <div className="w-full bg-muted rounded-full h-2 mt-2">
                        <div 
                          className="bg-green-500 h-2 rounded-full" 
                          style={{ width: `${(stats.onboardingCompleted / stats.totalUsers) * 100}%` }}
                        />
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">
                        {((stats.onboardingCompleted / stats.totalUsers) * 100).toFixed(1)}% completion rate
                      </p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-lg flex items-center gap-2">
                        <Palette className="w-5 h-5 text-purple-500" />
                        Colors Configured
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-3xl font-bold">{stats.hasColors}</p>
                      <div className="w-full bg-muted rounded-full h-2 mt-2">
                        <div 
                          className="bg-purple-500 h-2 rounded-full" 
                          style={{ width: `${(stats.hasColors / stats.totalUsers) * 100}%` }}
                        />
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">
                        {((stats.hasColors / stats.totalUsers) * 100).toFixed(1)}% have custom colors
                      </p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-lg flex items-center gap-2">
                        <MessageSquare className="w-5 h-5 text-blue-500" />
                        Branded AI Support
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-3xl font-bold">{stats.hasBrandedAI}</p>
                      <div className="w-full bg-muted rounded-full h-2 mt-2">
                        <div 
                          className="bg-blue-500 h-2 rounded-full" 
                          style={{ width: `${(stats.hasBrandedAI / stats.totalUsers) * 100}%` }}
                        />
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">
                        {((stats.hasBrandedAI / stats.totalUsers) * 100).toFixed(1)}% enabled
                      </p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-lg flex items-center gap-2">
                        <Ticket className="w-5 h-5 text-orange-500" />
                        Support Ticketing
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-3xl font-bold">{stats.hasSupportTicketing}</p>
                      <div className="w-full bg-muted rounded-full h-2 mt-2">
                        <div 
                          className="bg-orange-500 h-2 rounded-full" 
                          style={{ width: `${(stats.hasSupportTicketing / stats.totalUsers) * 100}%` }}
                        />
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">
                        {((stats.hasSupportTicketing / stats.totalUsers) * 100).toFixed(1)}% enabled
                      </p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-lg flex items-center gap-2">
                        <Settings className="w-5 h-5 text-cyan-500" />
                        Client Hub
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-3xl font-bold">{stats.hasClientHub}</p>
                      <div className="w-full bg-muted rounded-full h-2 mt-2">
                        <div 
                          className="bg-cyan-500 h-2 rounded-full" 
                          style={{ width: `${(stats.hasClientHub / stats.totalUsers) * 100}%` }}
                        />
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">
                        {((stats.hasClientHub / stats.totalUsers) * 100).toFixed(1)}% enabled
                      </p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-lg flex items-center gap-2">
                        <Calendar className="w-5 h-5 text-pink-500" />
                        Email Warmup Access
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-3xl font-bold">{stats.hasEmailWarmup}</p>
                      <div className="w-full bg-muted rounded-full h-2 mt-2">
                        <div 
                          className="bg-pink-500 h-2 rounded-full" 
                          style={{ width: `${(stats.hasEmailWarmup / stats.totalUsers) * 100}%` }}
                        />
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">
                        {((stats.hasEmailWarmup / stats.totalUsers) * 100).toFixed(1)}% have access
                      </p>
                    </CardContent>
                  </Card>
                </div>

                {/* Engagement Stats */}
                <Card>
                  <CardHeader>
                    <CardTitle>User Engagement Summary</CardTitle>
                    <CardDescription>Aggregated engagement metrics across all users</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      <div className="text-center p-4 bg-muted/50 rounded-lg">
                        <Video className="w-8 h-8 mx-auto mb-2 text-primary" />
                        <p className="text-2xl font-bold">
                          {users.reduce((sum, u) => sum + (u.videos_watched_count || 0), 0)}
                        </p>
                        <p className="text-sm text-muted-foreground">Total Videos Watched</p>
                      </div>
                      <div className="text-center p-4 bg-muted/50 rounded-lg">
                        <MessageSquare className="w-8 h-8 mx-auto mb-2 text-primary" />
                        <p className="text-2xl font-bold">
                          {users.reduce((sum, u) => sum + (u.ai_questions_count || 0), 0)}
                        </p>
                        <p className="text-sm text-muted-foreground">AI Questions Asked</p>
                      </div>
                      <div className="text-center p-4 bg-muted/50 rounded-lg">
                        <Ticket className="w-8 h-8 mx-auto mb-2 text-primary" />
                        <p className="text-2xl font-bold">
                          {users.reduce((sum, u) => sum + (u.tickets_opened_count || 0), 0)}
                        </p>
                        <p className="text-sm text-muted-foreground">Support Tickets Opened</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </>
            )}
          </TabsContent>

          {/* Tips Bot Tab */}
          <TabsContent value="tips">
            <TipsAdoptionPanel />
          </TabsContent>

          {/* Platform Emails Tab */}
          <TabsContent value="platform-emails">
            <PlatformEmailsPanel />
          </TabsContent>

          {/* Affiliates Tab */}
          <TabsContent value="affiliates">
            <AffiliateManagerPanel />
          </TabsContent>

          {/* CoPilot Conversations Tab */}
          <TabsContent value="copilot">
            <CopilotConversationsPanel />
          </TabsContent>

          <TabsContent value="fulfillment">
            <FulfillmentPanel />
          </TabsContent>

          <TabsContent value="domains">
            <CustomDomainsPanel />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default Admin;

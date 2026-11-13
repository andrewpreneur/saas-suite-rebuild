import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Search, Ban, ShieldOff, Users, RefreshCw, ArrowUpDown, ChevronUp, ChevronDown } from "lucide-react";

interface UserProgressRow {
  id: string;
  email: string | null;
  name: string | null;
  agency_id: string | null;
  approval: string | null;
  last_accessed: string | null;
  created_at: string;
  checklist_minimized: boolean | null;
  is_banned?: boolean;
}

interface BannedUser {
  user_identifier: string;
  agency_id: string;
  reason: string | null;
  created_at: string;
}

type SortField = "email" | "name" | "agency_id" | "approval" | "last_accessed" | "created_at";
type SortDir = "asc" | "desc";

// Detect if an agency_id looks like a customized slug (not a UUID/hex string)
const isCustomizedAgencyId = (id: string): boolean => {
  // UUIDs and GHL IDs are 32 hex chars (no dashes) or UUID format
  const hexPattern = /^[0-9a-f]{20,}$/i;
  const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return !hexPattern.test(id) && !uuidPattern.test(id);
};

export const UserProgressPanel = () => {
  const [progressData, setProgressData] = useState<UserProgressRow[]>([]);
  const [bannedUsers, setBannedUsers] = useState<BannedUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [agencyFilter, setAgencyFilter] = useState("all");
  const [approvalFilter, setApprovalFilter] = useState("all");
  const [sortField, setSortField] = useState<SortField>("last_accessed");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  // Ban dialog
  const [banDialogOpen, setBanDialogOpen] = useState(false);
  const [banTarget, setBanTarget] = useState<UserProgressRow | null>(null);
  const [banAgencyId, setBanAgencyId] = useState("");
  const [banReason, setBanReason] = useState("");
  const [banning, setBanning] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch all user_progress records (paginated)
      let allProgress: UserProgressRow[] = [];
      let from = 0;
      const pageSize = 1000;

      while (true) {
        const { data, error } = await supabase
          .from("user_progress")
          .select("*")
          .order("created_at", { ascending: false })
          .range(from, from + pageSize - 1);

        if (error) {
          console.error("Error fetching user_progress:", error);
          toast.error("Failed to fetch user progress data");
          return;
        }

        if (!data || data.length === 0) break;
        allProgress = [...allProgress, ...(data as UserProgressRow[])];
        if (data.length < pageSize) break;
        from += pageSize;
      }

      // Fetch banned users
      const { data: bans } = await supabase
        .from("banned_users")
        .select("user_identifier, agency_id, reason, created_at");

      const bannedList = (bans || []) as BannedUser[];
      setBannedUsers(bannedList);

      // Mark banned users
      const bannedSet = new Set(bannedList.map(b => `${b.user_identifier}::${b.agency_id}`));
      const enriched = allProgress.map(u => ({
        ...u,
        is_banned: bannedSet.has(`${u.email || u.name}::${u.agency_id}`)
      }));

      setProgressData(enriched);
    } catch (err) {
      console.error("Error:", err);
      toast.error("An error occurred");
    } finally {
      setLoading(false);
    }
  };

  // Get unique customized agency IDs for filter dropdown
  const agencyOptions = useMemo(() => {
    const agencyIds = new Map<string, number>();
    progressData.forEach(u => {
      if (u.agency_id) {
        agencyIds.set(u.agency_id, (agencyIds.get(u.agency_id) || 0) + 1);
      }
    });

    const customized: { id: string; count: number }[] = [];
    let otherCount = 0;

    agencyIds.forEach((count, id) => {
      if (isCustomizedAgencyId(id)) {
        customized.push({ id, count });
      } else {
        otherCount += count;
      }
    });

    customized.sort((a, b) => b.count - a.count);
    return { customized, otherCount };
  }, [progressData]);

  // Filter and sort
  const filteredData = useMemo(() => {
    let data = [...progressData];

    // Search
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      data = data.filter(u =>
        u.email?.toLowerCase().includes(q) ||
        u.name?.toLowerCase().includes(q) ||
        u.agency_id?.toLowerCase().includes(q)
      );
    }

    // Agency filter
    if (agencyFilter === "other") {
      data = data.filter(u => u.agency_id && !isCustomizedAgencyId(u.agency_id));
    } else if (agencyFilter === "none") {
      data = data.filter(u => !u.agency_id);
    } else if (agencyFilter !== "all") {
      data = data.filter(u => u.agency_id === agencyFilter);
    }

    // Approval filter
    if (approvalFilter === "banned") {
      data = data.filter(u => u.is_banned);
    } else if (approvalFilter === "no") {
      data = data.filter(u => u.approval?.toUpperCase() === "NO");
    } else if (approvalFilter !== "all") {
      data = data.filter(u => u.approval?.toUpperCase() === approvalFilter.toUpperCase());
    }

    // Sort
    data.sort((a, b) => {
      const aVal = a[sortField] || "";
      const bVal = b[sortField] || "";
      const cmp = String(aVal).localeCompare(String(bVal));
      return sortDir === "asc" ? cmp : -cmp;
    });

    return data;
  }, [progressData, searchQuery, agencyFilter, approvalFilter, sortField, sortDir]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir(d => d === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDir("desc");
    }
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <ArrowUpDown className="w-3 h-3 ml-1 opacity-40" />;
    return sortDir === "asc" 
      ? <ChevronUp className="w-3 h-3 ml-1" /> 
      : <ChevronDown className="w-3 h-3 ml-1" />;
  };

  const handleBan = async () => {
    if (!banTarget) return;
    const identifier = banTarget.email || banTarget.name;
    if (!identifier) {
      toast.error("User has no email or name to identify");
      return;
    }
    if (!banAgencyId.trim()) {
      toast.error("Please enter an agency ID to ban from");
      return;
    }

    setBanning(true);
    try {
      const { error } = await supabase.rpc("ban_user_from_page", {
        p_user_identifier: identifier,
        p_agency_id: banAgencyId.trim(),
        p_reason: banReason.trim() || null
      });

      if (error) throw error;

      toast.success(`Banned ${identifier} from ${banAgencyId}`);
      setBanDialogOpen(false);
      setBanTarget(null);
      setBanAgencyId("");
      setBanReason("");
      fetchData();
    } catch (err) {
      console.error("Error banning user:", err);
      toast.error("Failed to ban user");
    } finally {
      setBanning(false);
    }
  };

  const handleUnban = async (userIdentifier: string, agencyId: string) => {
    try {
      const { error } = await supabase.rpc("unban_user_from_page", {
        p_user_identifier: userIdentifier,
        p_agency_id: agencyId
      });

      if (error) throw error;

      toast.success(`Unbanned ${userIdentifier} from ${agencyId}`);
      fetchData();
    } catch (err) {
      console.error("Error unbanning user:", err);
      toast.error("Failed to unban user");
    }
  };

  const formatDate = (date: string | null) => {
    if (!date) return "Never";
    return new Date(date).toLocaleDateString("en-US", {
      month: "short", day: "numeric", year: "numeric",
    });
  };

  const getApprovalBadge = (approval: string | null, isBanned: boolean) => {
    if (isBanned) return <Badge className="bg-red-500/20 text-red-400 border-red-500/30">Banned</Badge>;
    if (!approval) return <Badge className="bg-gray-500/20 text-gray-400 border-gray-500/30">—</Badge>;
    if (approval.toUpperCase() === "NO") return <Badge className="bg-red-500/20 text-red-400 border-red-500/30">NO</Badge>;
    return <Badge className="bg-green-500/20 text-green-400 border-green-500/30">{approval}</Badge>;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <RefreshCw className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Stats row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <Users className="w-8 h-8 text-primary" />
              <div>
                <p className="text-2xl font-bold">{progressData.length}</p>
                <p className="text-xs text-muted-foreground">Total Progress Records</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <Ban className="w-8 h-8 text-red-500" />
              <div>
                <p className="text-2xl font-bold">{bannedUsers.length}</p>
                <p className="text-xs text-muted-foreground">Banned Users</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div>
              <p className="text-2xl font-bold">{agencyOptions.customized.length}</p>
              <p className="text-xs text-muted-foreground">Custom Agency IDs</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div>
              <p className="text-2xl font-bold">{agencyOptions.otherCount}</p>
              <p className="text-xs text-muted-foreground">Users w/ Default IDs</p>
            </div>
          </CardContent>
        </Card>
      </div>

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
            <Select value={agencyFilter} onValueChange={setAgencyFilter}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Agency ID" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Agencies</SelectItem>
                <SelectItem value="none">No Agency</SelectItem>
                {agencyOptions.customized.map(a => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.id} ({a.count})
                  </SelectItem>
                ))}
                {agencyOptions.otherCount > 0 && (
                  <SelectItem value="other">Other ({agencyOptions.otherCount})</SelectItem>
                )}
              </SelectContent>
            </Select>
            <Select value={approvalFilter} onValueChange={setApprovalFilter}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="banned">Banned</SelectItem>
                <SelectItem value="no">Approval: NO</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm" onClick={fetchData} disabled={loading}>
              <RefreshCw className={`w-4 h-4 mr-2 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </Button>
          </div>
          <p className="text-sm text-muted-foreground mt-2">
            Showing {filteredData.length} of {progressData.length} records
          </p>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <ScrollArea className="h-[500px]">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead
                  className="cursor-pointer hover:bg-muted/50 select-none"
                  onClick={() => handleSort("email")}
                >
                  <div className="flex items-center">Email <SortIcon field="email" /></div>
                </TableHead>
                <TableHead
                  className="cursor-pointer hover:bg-muted/50 select-none"
                  onClick={() => handleSort("name")}
                >
                  <div className="flex items-center">Name <SortIcon field="name" /></div>
                </TableHead>
                <TableHead
                  className="cursor-pointer hover:bg-muted/50 select-none"
                  onClick={() => handleSort("agency_id")}
                >
                  <div className="flex items-center">Agency ID <SortIcon field="agency_id" /></div>
                </TableHead>
                <TableHead
                  className="cursor-pointer hover:bg-muted/50 select-none"
                  onClick={() => handleSort("approval")}
                >
                  <div className="flex items-center">Status <SortIcon field="approval" /></div>
                </TableHead>
                <TableHead
                  className="cursor-pointer hover:bg-muted/50 select-none"
                  onClick={() => handleSort("last_accessed")}
                >
                  <div className="flex items-center">Last Active <SortIcon field="last_accessed" /></div>
                </TableHead>
                <TableHead
                  className="cursor-pointer hover:bg-muted/50 select-none"
                  onClick={() => handleSort("created_at")}
                >
                  <div className="flex items-center">Created <SortIcon field="created_at" /></div>
                </TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredData.map((user) => (
                <TableRow key={user.id} className={user.is_banned ? "bg-red-500/5" : ""}>
                  <TableCell className="font-medium text-sm">
                    {user.email || "—"}
                  </TableCell>
                  <TableCell className="text-sm">
                    {user.name || "—"}
                  </TableCell>
                  <TableCell>
                    {user.agency_id ? (
                      <span className={`text-xs font-mono ${isCustomizedAgencyId(user.agency_id) ? "text-primary" : "text-muted-foreground"}`}>
                        {user.agency_id}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {getApprovalBadge(user.approval, user.is_banned || false)}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {formatDate(user.last_accessed)}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {formatDate(user.created_at)}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      {user.is_banned ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-green-500 hover:text-green-400 h-8 px-2"
                          onClick={() => handleUnban(
                            user.email || user.name || "",
                            user.agency_id || ""
                          )}
                        >
                          <ShieldOff className="w-4 h-4 mr-1" />
                          Unban
                        </Button>
                      ) : (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-red-500 hover:text-red-400 h-8 px-2"
                          onClick={() => {
                            setBanTarget(user);
                            setBanAgencyId(user.agency_id || "");
                            setBanDialogOpen(true);
                          }}
                        >
                          <Ban className="w-4 h-4 mr-1" />
                          Ban
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </ScrollArea>
      </Card>

      {/* Banned Users Summary */}
      {bannedUsers.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Ban className="w-5 h-5 text-red-500" />
              Banned Users
            </CardTitle>
            <CardDescription>Users currently banned from specific agency pages</CardDescription>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[200px]">
              <div className="space-y-2">
                {bannedUsers.map((ban, i) => (
                  <div key={i} className="flex items-center justify-between p-3 bg-red-500/5 rounded-lg border border-red-500/10">
                    <div>
                      <p className="font-medium text-sm">{ban.user_identifier}</p>
                      <p className="text-xs text-muted-foreground">
                        Banned from <span className="font-mono text-primary">{ban.agency_id}</span>
                        {ban.reason && ` — ${ban.reason}`}
                      </p>
                      <p className="text-xs text-muted-foreground">{formatDate(ban.created_at)}</p>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-green-500 hover:text-green-400"
                      onClick={() => handleUnban(ban.user_identifier, ban.agency_id)}
                    >
                      <ShieldOff className="w-4 h-4 mr-1" />
                      Unban
                    </Button>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      )}

      {/* Ban Dialog */}
      <Dialog open={banDialogOpen} onOpenChange={setBanDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Ban User from Agency Page</DialogTitle>
            <DialogDescription>
              Ban <strong>{banTarget?.email || banTarget?.name}</strong> from accessing a specific agency page.
              You can ban them from any agency ID, not just the one they're currently on.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Agency ID to ban from</Label>
              <Input
                value={banAgencyId}
                onChange={(e) => setBanAgencyId(e.target.value)}
                placeholder="e.g., atlas, software-onboarding"
              />
              <p className="text-xs text-muted-foreground">
                Enter any agency ID — the user will be blocked from accessing this page.
              </p>
            </div>
            <div className="space-y-2">
              <Label>Reason (optional)</Label>
              <Textarea
                value={banReason}
                onChange={(e) => setBanReason(e.target.value)}
                placeholder="Why is this user being banned?"
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBanDialogOpen(false)}>Cancel</Button>
            <Button
              variant="destructive"
              onClick={handleBan}
              disabled={banning || !banAgencyId.trim()}
            >
              {banning ? "Banning..." : "Ban User"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

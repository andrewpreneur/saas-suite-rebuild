import React, { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { 
  Users, DollarSign, Eye, MousePointer, ShoppingCart, 
  Edit, ExternalLink, Search, RefreshCw, Plus, Copy, TrendingUp
} from "lucide-react";
import AffiliateReferralsPanel from "@/components/affiliate/AffiliateReferralsPanel";

function commissionPeriodLabel(periodIndex: number, periodStart?: string | null) {
  const when = periodStart ? new Date(periodStart).toLocaleDateString() : "";
  if (periodIndex >= 1_000_000) return when || "Paid invoice";
  return when ? `#${periodIndex + 1} · ${when}` : `#${periodIndex + 1}`;
}

interface Affiliate {
  id: string;
  full_name: string;
  email: string;
  company: string | null;
  network_size: string;
  audience_description: string | null;
  status: string | null;
  affiliate_slug: string | null;
  user_email_linked: string | null;
  created_at: string;
}

interface AffiliateStats {
  affiliateId: string;
  views: number;
  clicks: number;
  purchases: number;
  pageBreakdown: Record<string, { views: number; clicks: number; purchases: number }>;
}

interface Referral {
  id: string;
  affiliate_id: string;
  referred_email: string;
  referred_name: string | null;
  plan: string | null;
  commission_rate: number;
  status: string;
  created_at: string;
}

interface Payout {
  id: string;
  affiliate_id: string;
  amount: number;
  status: string;
  notes: string | null;
  paid_at: string | null;
  created_at: string;
}

interface Commission {
  id: string;
  affiliate_id: string;
  referral_id: string;
  referred_email: string;
  plan: string;
  plan_amount: number;
  commission_rate: number;
  amount: number;
  period_index: number;
  period_start: string;
  status: string;
  paid_at: string | null;
  notes: string | null;
  created_at: string;
}

const SALES_PAGES = ['home', 'branding-tool', 'email-warmup', 'support', 'webinar'];
const BASE_URL = 'https://saassuite.ai';

export default function AffiliateManagerPanel() {
  const [affiliates, setAffiliates] = useState<Affiliate[]>([]);
  const [events, setEvents] = useState<any[]>([]);
  const [referrals, setReferrals] = useState<Referral[]>([]);
  const [payouts, setPayouts] = useState<Payout[]>([]);
  const [commissions, setCommissions] = useState<Commission[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  
  // Edit slug dialog
  const [editingAffiliate, setEditingAffiliate] = useState<Affiliate | null>(null);
  const [newSlug, setNewSlug] = useState("");
  
  // Detail view
  const [selectedAffiliate, setSelectedAffiliate] = useState<Affiliate | null>(null);
  
  // Payout dialog
  const [payoutDialogOpen, setPayoutDialogOpen] = useState(false);
  const [payoutAffiliateId, setPayoutAffiliateId] = useState("");
  const [payoutAmount, setPayoutAmount] = useState("");
  const [payoutNotes, setPayoutNotes] = useState("");
  const [payoutStatus, setPayoutStatus] = useState("paid");
  const [payoutInfoAffiliate, setPayoutInfoAffiliate] = useState<Affiliate | null>(null);

  useEffect(() => {
    fetchAll();
  }, []);

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [affiliatesRes, eventsRes, referralsRes, payoutsRes, commissionsRes] = await Promise.all([
        supabase.from('affiliates').select('*').order('created_at', { ascending: false }),
        supabase.from('affiliate_events').select('*'),
        supabase.from('affiliate_referrals').select('*').order('created_at', { ascending: false }),
        supabase.from('affiliate_payouts').select('*').order('created_at', { ascending: false }),
        supabase.from('affiliate_commissions').select('*').order('period_start', { ascending: false }),
      ]);

      if (affiliatesRes.data) setAffiliates(affiliatesRes.data as Affiliate[]);
      if (eventsRes.data) setEvents(eventsRes.data);
      if (referralsRes.data) setReferrals(referralsRes.data as Referral[]);
      if (payoutsRes.data) setPayouts(payoutsRes.data as Payout[]);
      if (commissionsRes.data) setCommissions(commissionsRes.data as Commission[]);
    } catch (err) {
      console.error('Error fetching affiliate data:', err);
      toast.error('Failed to load affiliate data');
    } finally {
      setLoading(false);
    }
  };

  // Compute stats per affiliate
  const affiliateStats = useMemo(() => {
    const statsMap: Record<string, AffiliateStats> = {};
    
    affiliates.forEach(a => {
      statsMap[a.id] = {
        affiliateId: a.id,
        views: 0,
        clicks: 0,
        purchases: 0,
        pageBreakdown: {}
      };
      SALES_PAGES.forEach(page => {
        statsMap[a.id].pageBreakdown[page] = { views: 0, clicks: 0, purchases: 0 };
      });
    });

    events.forEach(event => {
      const stat = statsMap[event.affiliate_id];
      if (!stat) return;
      
      if (event.event_type === 'view') stat.views++;
      else if (event.event_type === 'click') stat.clicks++;
      else if (event.event_type === 'purchase') stat.purchases++;
      
      const pageStat = stat.pageBreakdown[event.page];
      if (pageStat) {
        if (event.event_type === 'view') pageStat.views++;
        else if (event.event_type === 'click') pageStat.clicks++;
        else if (event.event_type === 'purchase') pageStat.purchases++;
      }
    });

    return statsMap;
  }, [affiliates, events]);

  const filteredAffiliates = useMemo(() => {
    if (!searchQuery) return affiliates;
    const q = searchQuery.toLowerCase();
    return affiliates.filter(a => 
      a.full_name.toLowerCase().includes(q) || 
      a.email.toLowerCase().includes(q) ||
      a.affiliate_slug?.toLowerCase().includes(q)
    );
  }, [affiliates, searchQuery]);

  const totalStats = useMemo(() => {
    return {
      totalAffiliates: affiliates.length,
      totalViews: events.filter(e => e.event_type === 'view').length,
      totalClicks: events.filter(e => e.event_type === 'click').length,
      totalPurchases: events.filter(e => e.event_type === 'purchase').length,
      totalReferrals: referrals.length,
      totalPaidOut: payouts.filter(p => p.status === 'paid').reduce((sum, p) => sum + Number(p.amount), 0),
      pendingPayouts: payouts.filter(p => p.status === 'pending').reduce((sum, p) => sum + Number(p.amount), 0),
    };
  }, [affiliates, events, referrals, payouts]);

  const handleUpdateSlug = async () => {
    if (!editingAffiliate || !newSlug.trim()) return;
    
    const slug = newSlug.trim().toLowerCase().replace(/[^a-z0-9-]/g, '');
    
    const { error } = await supabase
      .from('affiliates')
      .update({ affiliate_slug: slug })
      .eq('id', editingAffiliate.id);

    if (error) {
      toast.error(error.message.includes('unique') ? 'This slug is already taken' : 'Failed to update slug');
      return;
    }

    toast.success('Affiliate slug updated');
    setEditingAffiliate(null);
    fetchAll();
  };

  const handleUpdateStatus = async (affiliateId: string, newStatus: string) => {
    const { error } = await supabase
      .from('affiliates')
      .update({ status: newStatus })
      .eq('id', affiliateId);

    if (error) {
      toast.error('Failed to update status');
      return;
    }

    // Sync is_affiliate flag to saas_suite_users when approved/rejected
    const affiliate = affiliates.find(a => a.id === affiliateId);
    const isApproved = newStatus === 'APPROVED';
    
    if (affiliate?.email) {
      await supabase
        .from('saas_suite_users')
        .update({ 
          is_affiliate: isApproved, 
          affiliate_slug: isApproved ? (affiliate.affiliate_slug || null) : null 
        })
        .eq('email', affiliate.email);
      
      // Also try matching by linked email
      if (affiliate.user_email_linked && affiliate.user_email_linked !== affiliate.email) {
        await supabase
          .from('saas_suite_users')
          .update({ 
            is_affiliate: isApproved, 
            affiliate_slug: isApproved ? (affiliate.affiliate_slug || null) : null 
          })
          .eq('email', affiliate.user_email_linked);
      }
    }

    // Auto-generate Stripe coupon code when approving an affiliate
    if (isApproved && affiliate?.affiliate_slug) {
      try {
        const { data: couponData, error: couponError } = await supabase.functions.invoke(
          'create-affiliate-coupon',
          {
            body: {
              affiliateSlug: affiliate.affiliate_slug,
              affiliateName: affiliate.full_name,
            },
          }
        );
        if (couponError) {
          console.error('Failed to create affiliate coupon:', couponError);
          toast.error('Affiliate approved but coupon code creation failed');
        } else if (couponData?.promoCode) {
          toast.success(`Affiliate approved! Coupon code: ${couponData.promoCode}`);
          fetchAll();
          return;
        }
      } catch (e) {
        console.error('Coupon creation error:', e);
      }
    }

    toast.success('Status updated');
    fetchAll();
  };

  const handleRecordPayout = async () => {
    if (!payoutAffiliateId || !payoutAmount) {
      toast.error('Please fill in required fields');
      return;
    }

    const { error } = await supabase
      .from('affiliate_payouts')
      .insert({
        affiliate_id: payoutAffiliateId,
        amount: parseFloat(payoutAmount),
        status: payoutStatus,
        notes: payoutNotes || null,
        paid_at: payoutStatus === 'paid' ? new Date().toISOString() : null,
      });

    if (error) {
      toast.error('Failed to record payout');
      return;
    }

    toast.success('Payout recorded');
    setPayoutDialogOpen(false);
    setPayoutAmount("");
    setPayoutNotes("");
    fetchAll();
  };

  const copyUrl = (slug: string, page: string) => {
    const path = page === 'home' ? '/' : `/${page}`;
    const url = `${BASE_URL}${path}?ref=${slug}`;
    navigator.clipboard.writeText(url);
    toast.success('URL copied!');
  };

  const affiliateReferrals = (affiliateId: string) => referrals.filter(r => r.affiliate_id === affiliateId);
  const affiliatePayouts = (affiliateId: string) => payouts.filter(p => p.affiliate_id === affiliateId);
  const affiliateCommissions = (affiliateId: string) => commissions.filter(c => c.affiliate_id === affiliateId);

  const handleMarkCommissionPaid = async (commissionId: string, paid: boolean) => {
    const { error } = await supabase
      .from('affiliate_commissions')
      .update({
        status: paid ? 'paid' : 'pending',
        paid_at: paid ? new Date().toISOString() : null,
      })
      .eq('id', commissionId);
    if (error) {
      toast.error('Failed to update commission');
      return;
    }
    toast.success(paid ? 'Marked as sent' : 'Reverted to pending');
    fetchAll();
  };

  const handleTriggerWebhook = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('accrue-affiliate-commissions', {
        body: { test: true },
      });
      if (error) throw error;
      toast.success(`Test sent — ${data?.webhooksFired ?? 0} webhooks fired, ${data?.accruedRows ?? 0} new commissions`);
      fetchAll();
    } catch (err) {
      console.error(err);
      toast.error('Failed to trigger webhook test');
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center py-12"><RefreshCw className="w-6 h-6 animate-spin" /></div>;
  }

  // Detail view for selected affiliate
  if (selectedAffiliate) {
    const stats = affiliateStats[selectedAffiliate.id];
    const refs = affiliateReferrals(selectedAffiliate.id);
    const pays = affiliatePayouts(selectedAffiliate.id);
    const comms = affiliateCommissions(selectedAffiliate.id);
    const totalEarned = comms.reduce((s, c) => s + Number(c.amount), 0);
    const totalPaid = comms.filter(c => c.status === 'paid').reduce((s, c) => s + Number(c.amount), 0);
    const totalPending = totalEarned - totalPaid;
    const hasPayoutInfo = !!(selectedAffiliate as any).payout_method;

    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <Button variant="ghost" size="sm" onClick={() => setSelectedAffiliate(null)} className="mb-2">
              ← Back to all affiliates
            </Button>
            <h3 className="text-2xl font-bold">{selectedAffiliate.full_name}</h3>
            <p className="text-muted-foreground">{selectedAffiliate.email}</p>
          </div>
          <Badge variant={selectedAffiliate.status === 'APPROVED' ? 'default' : 'secondary'}>
            {selectedAffiliate.status || 'PENDING'}
          </Badge>
        </div>

        {/* Stats cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card><CardContent className="pt-4">
            <div className="text-2xl font-bold">{stats?.views || 0}</div>
            <p className="text-xs text-muted-foreground">Total Views</p>
          </CardContent></Card>
          <Card><CardContent className="pt-4">
            <div className="text-2xl font-bold">{stats?.clicks || 0}</div>
            <p className="text-xs text-muted-foreground">Total Clicks</p>
          </CardContent></Card>
          <Card><CardContent className="pt-4">
            <div className="text-2xl font-bold">{stats?.purchases || 0}</div>
            <p className="text-xs text-muted-foreground">Purchases</p>
          </CardContent></Card>
          <Card><CardContent className="pt-4">
            <div className="text-2xl font-bold text-green-600">${totalEarned.toFixed(2)}</div>
            <p className="text-xs text-muted-foreground">Total Earned (${totalPending.toFixed(2)} pending)</p>
          </CardContent></Card>
        </div>

        {/* Page breakdown */}
        <Card>
          <CardHeader><CardTitle className="text-lg">Page Breakdown</CardTitle></CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Page</TableHead>
                  <TableHead>URL</TableHead>
                  <TableHead className="text-right">Views</TableHead>
                  <TableHead className="text-right">Clicks</TableHead>
                  <TableHead className="text-right">Purchases</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {SALES_PAGES.map(page => {
                  const ps = stats?.pageBreakdown[page];
                  return (
                    <TableRow key={page}>
                      <TableCell className="font-medium capitalize">{page.replace('-', ' ')}</TableCell>
                      <TableCell>
                        <Button variant="ghost" size="sm" onClick={() => copyUrl(selectedAffiliate.affiliate_slug || '', page)}>
                          <Copy className="w-3 h-3 mr-1" /> Copy
                        </Button>
                      </TableCell>
                      <TableCell className="text-right">{ps?.views || 0}</TableCell>
                      <TableCell className="text-right">{ps?.clicks || 0}</TableCell>
                      <TableCell className="text-right">{ps?.purchases || 0}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <AffiliateReferralsPanel mode="admin" affiliateId={selectedAffiliate.id} fallbackReferrals={refs} />

        {/* Payouts */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg">Payouts</CardTitle>
            <Button size="sm" onClick={() => {
              setPayoutAffiliateId(selectedAffiliate.id);
              setPayoutDialogOpen(true);
            }}>
              <Plus className="w-4 h-4 mr-1" /> Record Payout
            </Button>
          </CardHeader>
          <CardContent>
            {(() => {
              const pm: any = (selectedAffiliate as any).payout_method;
              if (!pm) {
                return (
                  <div className="mb-4 rounded-md border border-dashed p-3 text-sm text-muted-foreground">
                    No payout method on file.
                  </div>
                );
              }
              const method = pm.method || pm.type || 'Unknown';
              const entries = Object.entries(pm).filter(
                ([k]) => !['method', 'type'].includes(k)
              );
              return (
                <div className="mb-4 rounded-md border bg-muted/30 p-3 text-sm space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold">Payout Method</span>
                    <Badge variant="outline" className="uppercase">{String(method)}</Badge>
                  </div>
                  {entries.length === 0 ? (
                    <div className="text-muted-foreground text-xs">No additional details provided.</div>
                  ) : (
                    <dl className="grid grid-cols-[max-content_1fr] gap-x-3 gap-y-1 text-xs">
                      {entries.map(([k, v]) => (
                        <React.Fragment key={k}>
                          <dt className="text-muted-foreground capitalize">{k.replace(/_/g, ' ')}</dt>
                          <dd className="font-mono break-all">
                            {typeof v === 'object' ? JSON.stringify(v) : String(v)}
                          </dd>
                        </React.Fragment>
                      ))}
                    </dl>
                  )}
                </div>
              );
            })()}
            {pays.length === 0 ? (
              <p className="text-muted-foreground text-sm">No payouts recorded</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Amount</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Notes</TableHead>
                    <TableHead>Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pays.map(p => (
                    <TableRow key={p.id}>
                      <TableCell className="font-bold">${Number(p.amount).toFixed(2)}</TableCell>
                      <TableCell>
                        <Badge variant={p.status === 'paid' ? 'default' : p.status === 'pending' ? 'secondary' : 'destructive'}>
                          {p.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{p.notes || '-'}</TableCell>
                      <TableCell>{new Date(p.paid_at || p.created_at).toLocaleDateString()}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Commissions */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-lg">Commissions ({comms.length})</CardTitle>
              <CardDescription>
                {hasPayoutInfo
                  ? 'Payout info on file. Pending invoice commissions are pinged to LeadConnector daily. Rows with no invoice id are older list-price estimates and are not sent.'
                  : 'No payout info on file — the payout webhook waits until the affiliate submits payout details. Rows with no invoice id are older estimates and are not sent.'}
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            {comms.length === 0 ? (
              <p className="text-muted-foreground text-sm">No commissions accrued yet</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Referred</TableHead>
                    <TableHead>Plan</TableHead>
                    <TableHead>Period</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {comms.map(c => (
                    <TableRow key={c.id}>
                      <TableCell className="text-xs">{c.referred_email}</TableCell>
                      <TableCell><Badge variant="outline">{c.plan}</Badge></TableCell>
                      <TableCell className="text-xs">
                        {commissionPeriodLabel(c.period_index, c.period_start)}
                      </TableCell>
                      <TableCell className="text-right font-bold">${Number(c.amount).toFixed(2)}</TableCell>
                      <TableCell>
                        <Badge variant={c.status === 'paid' ? 'default' : 'secondary'}>
                          {c.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {c.status === 'paid' ? (
                          <Button size="sm" variant="ghost" onClick={() => handleMarkCommissionPaid(c.id, false)}>
                            Undo
                          </Button>
                        ) : (
                          <Button size="sm" onClick={() => handleMarkCommissionPaid(c.id, true)}>
                            Mark Sent
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Payout Dialog */}
        <Dialog open={payoutDialogOpen} onOpenChange={setPayoutDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Record Payout</DialogTitle>
              <DialogDescription>Record a payout for {selectedAffiliate.full_name}</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Amount ($)</Label>
                <Input type="number" value={payoutAmount} onChange={e => setPayoutAmount(e.target.value)} placeholder="0.00" />
              </div>
              <div>
                <Label>Status</Label>
                <Select value={payoutStatus} onValueChange={setPayoutStatus}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="paid">Paid</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="cancelled">Cancelled</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Notes</Label>
                <Textarea value={payoutNotes} onChange={e => setPayoutNotes(e.target.value)} placeholder="Optional notes..." />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setPayoutDialogOpen(false)}>Cancel</Button>
              <Button onClick={handleRecordPayout}>Save Payout</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  // Main list view
  return (
    <div className="space-y-6">
      {/* Overview cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card><CardContent className="pt-4 flex items-center gap-3">
          <Users className="w-8 h-8 text-primary" />
          <div>
            <div className="text-2xl font-bold">{totalStats.totalAffiliates}</div>
            <p className="text-xs text-muted-foreground">Affiliates</p>
          </div>
        </CardContent></Card>
        <Card><CardContent className="pt-4 flex items-center gap-3">
          <Eye className="w-8 h-8 text-blue-500" />
          <div>
            <div className="text-2xl font-bold">{totalStats.totalViews}</div>
            <p className="text-xs text-muted-foreground">Total Views</p>
          </div>
        </CardContent></Card>
        <Card><CardContent className="pt-4 flex items-center gap-3">
          <ShoppingCart className="w-8 h-8 text-green-500" />
          <div>
            <div className="text-2xl font-bold">{totalStats.totalReferrals}</div>
            <p className="text-xs text-muted-foreground">Total Referrals</p>
          </div>
        </CardContent></Card>
        <Card><CardContent className="pt-4 flex items-center gap-3">
          <DollarSign className="w-8 h-8 text-emerald-500" />
          <div>
            <div className="text-2xl font-bold">${totalStats.totalPaidOut.toFixed(2)}</div>
            <p className="text-xs text-muted-foreground">Total Paid Out</p>
          </div>
        </CardContent></Card>
      </div>

      {/* Search and actions */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Search affiliates..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="pl-9" />
        </div>
        <Button variant="outline" size="sm" onClick={handleTriggerWebhook}>
          <TrendingUp className="w-4 h-4 mr-1" /> Test Payout Webhook
        </Button>
        <Button variant="outline" size="icon" onClick={fetchAll} aria-label="Refresh"><RefreshCw className="w-4 h-4" /></Button>
      </div>

      {/* Pending commissions summary */}
      {commissions.filter(c => c.status === 'pending').length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <DollarSign className="w-5 h-5 text-emerald-500" />
              Pending Commissions ({commissions.filter(c => c.status === 'pending').length})
            </CardTitle>
            <CardDescription>
              Total pending: ${commissions.filter(c => c.status === 'pending').reduce((s, c) => s + Number(c.amount), 0).toFixed(2)} · Total paid: ${commissions.filter(c => c.status === 'paid').reduce((s, c) => s + Number(c.amount), 0).toFixed(2)}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Affiliate</TableHead>
                  <TableHead>Referred</TableHead>
                  <TableHead>Plan</TableHead>
                  <TableHead>Period</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Payout Info</TableHead>
                  <TableHead>Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {commissions.filter(c => c.status === 'pending').map(c => {
                  const aff = affiliates.find(a => a.id === c.affiliate_id);
                  const hasPayout = !!(aff as any)?.payout_method;
                  return (
                    <TableRow key={c.id}>
                      <TableCell className="text-xs">{aff?.full_name || 'Unknown'}</TableCell>
                      <TableCell className="text-xs">{c.referred_email}</TableCell>
                      <TableCell><Badge variant="outline">{c.plan}</Badge></TableCell>
                      <TableCell className="text-xs">{commissionPeriodLabel(c.period_index, c.period_start)}</TableCell>
                      <TableCell className="text-right font-bold">${Number(c.amount).toFixed(2)}</TableCell>
                      <TableCell>
                        <Badge variant={hasPayout ? 'default' : 'destructive'}>
                          {hasPayout ? 'On file' : 'Missing'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Button size="sm" onClick={() => handleMarkCommissionPaid(c.id, true)}>
                          Mark Sent
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <AffiliateReferralsPanel
        mode="admin"
        choices={affiliates.map((affiliate) => ({
          id: affiliate.id,
          fullName: affiliate.full_name,
          slug: affiliate.affiliate_slug,
        }))}
        fallbackReferrals={referrals}
      />

      {/* Affiliates table */}
      <Card>
        <CardHeader>
          <CardTitle>All Affiliates</CardTitle>
          <CardDescription>Manage affiliate partners and track performance</CardDescription>
        </CardHeader>
        <CardContent>
          <ScrollArea className="max-h-[600px]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Slug</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Views</TableHead>
                  <TableHead className="text-right">Clicks</TableHead>
                  <TableHead className="text-right">Referrals</TableHead>
                  <TableHead>Payout Info</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredAffiliates.map(affiliate => {
                  const stats = affiliateStats[affiliate.id];
                  const refCount = affiliateReferrals(affiliate.id).length;
                  return (
                    <TableRow key={affiliate.id} className="cursor-pointer" onClick={() => setSelectedAffiliate(affiliate)}>
                      <TableCell className="font-medium">{affiliate.full_name}</TableCell>
                      <TableCell className="text-muted-foreground">{affiliate.email}</TableCell>
                      <TableCell>
                        {affiliate.affiliate_slug ? (
                          <Badge variant="outline" className="font-mono text-xs">{affiliate.affiliate_slug}</Badge>
                        ) : (
                          <span className="text-muted-foreground text-xs">No slug</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Select 
                          value={affiliate.status || 'PENDING'} 
                          onValueChange={(v) => { 
                            // Stop row click propagation
                            handleUpdateStatus(affiliate.id, v);
                          }}
                        >
                          <SelectTrigger className="w-28 h-7 text-xs" onClick={e => e.stopPropagation()}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="PENDING">Pending</SelectItem>
                            <SelectItem value="APPROVED">Approved</SelectItem>
                            <SelectItem value="REJECTED">Rejected</SelectItem>
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell className="text-right">{stats?.views || 0}</TableCell>
                      <TableCell className="text-right">{stats?.clicks || 0}</TableCell>
                      <TableCell className="text-right">{refCount}</TableCell>
                      <TableCell onClick={e => e.stopPropagation()}>
                        {(affiliate as any).payout_method ? (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs"
                            onClick={() => setPayoutInfoAffiliate(affiliate)}
                          >
                            View payout info
                          </Button>
                        ) : (
                          <Badge variant="destructive">Missing</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <Button variant="ghost" size="icon" aria-label="Edit" onClick={(e) => {
                          e.stopPropagation();
                          setEditingAffiliate(affiliate);
                          setNewSlug(affiliate.affiliate_slug || '');
                        }}>
                          <Edit className="w-4 h-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Payout Info Dialog */}
      <Dialog open={!!payoutInfoAffiliate} onOpenChange={(open) => !open && setPayoutInfoAffiliate(null)}>
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Payout Info</DialogTitle>
            <DialogDescription>
              {payoutInfoAffiliate?.full_name} · {payoutInfoAffiliate?.email}
            </DialogDescription>
          </DialogHeader>
          {(() => {
            const pm: any = (payoutInfoAffiliate as any)?.payout_method;
            if (!pm) return <p className="text-sm text-muted-foreground">No payout method on file.</p>;
            const method = pm.method || pm.type || 'Unknown';
            const entries = Object.entries(pm).filter(([k]) => !['method', 'type'].includes(k));
            const plain = [`Method: ${method}`, ...entries.map(([k, v]) => `${k.replace(/_/g, ' ')}: ${typeof v === 'object' ? JSON.stringify(v) : String(v)}`)].join('\n');
            return (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Badge variant="outline" className="uppercase">{String(method)}</Badge>
                  <Button size="sm" variant="outline" onClick={() => { navigator.clipboard.writeText(plain); toast.success('Payout info copied'); }}>
                    <Copy className="w-4 h-4 mr-1" /> Copy all
                  </Button>
                </div>
                <dl className="grid grid-cols-[max-content_1fr] gap-x-3 gap-y-2 text-sm">
                  {entries.map(([k, v]) => (
                    <React.Fragment key={k}>
                      <dt className="text-muted-foreground capitalize">{k.replace(/_/g, ' ')}</dt>
                      <dd className="font-mono break-all flex items-start gap-2">
                        <span>{typeof v === 'object' ? JSON.stringify(v) : String(v)}</span>
                        <button
                          type="button"
                          className="text-muted-foreground hover:text-foreground"
                          onClick={() => { navigator.clipboard.writeText(typeof v === 'object' ? JSON.stringify(v) : String(v)); toast.success('Copied'); }}
                        >
                          <Copy className="w-3 h-3" />
                        </button>
                      </dd>
                    </React.Fragment>
                  ))}
                </dl>
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>

      {/* Edit Slug Dialog */}
      <Dialog open={!!editingAffiliate} onOpenChange={(open) => !open && setEditingAffiliate(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Affiliate Slug</DialogTitle>
            <DialogDescription>Change the URL slug for {editingAffiliate?.full_name}</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Affiliate Slug</Label>
              <Input value={newSlug} onChange={e => setNewSlug(e.target.value)} placeholder="e.g. john" />
            </div>
            <p className="text-xs text-muted-foreground">
              URLs will be: {BASE_URL}/?ref={newSlug || 'slug'}
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingAffiliate(null)}>Cancel</Button>
            <Button onClick={handleUpdateSlug}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

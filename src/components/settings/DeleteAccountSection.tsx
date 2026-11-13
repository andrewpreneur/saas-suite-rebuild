import { useState } from 'react';
import { Loader2, Trash2 } from 'lucide-react';
import { useUser } from '@/contexts/UserContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { canDeleteDisplayedAccount } from '../../../supabase/functions/delete-user-account/policy';
import { hardSignOut } from '@/lib/hardSignOut';
import { finishAccountDeletion } from '@/lib/finishAccountDeletion';

export default function DeleteAccountSection() {
  const { actualEmail, email, isImpersonating, clearUser } = useUser();
  const [open, setOpen] = useState(false);
  const [confirmation, setConfirmation] = useState('');
  const [acknowledged, setAcknowledged] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  if (!canDeleteDisplayedAccount(actualEmail, email, isImpersonating)) return null;

  const deleteAccount = async () => {
    if (confirmation !== 'DELETE' || !acknowledged || busy) return;
    setBusy(true);
    setError('');
    try {
      const { data: auth, error: authError } = await supabase.auth.getUser();
      if (authError || !auth.user?.email || auth.user.email.trim().toLowerCase() !== actualEmail?.trim().toLowerCase()) {
        throw new Error('Please sign in to your own account again before deleting it.');
      }
      const { data, error: invokeError } = await supabase.functions.invoke('delete-user-account', {
        body: { confirmation, email: auth.user.email.trim().toLowerCase() },
      });
      if (invokeError) {
        let message = 'Account deletion failed. Please try again.';
        try { message = (await invokeError.context.json()).error || message; } catch { /* retain safe message */ }
        throw new Error(message);
      }
      if (!data?.success) throw new Error(data?.error || 'Account deletion failed. Please try again.');
      await finishAccountDeletion(hardSignOut, clearUser, () => { window.location.href = '/'; });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Account deletion failed. Please try again.');
      setBusy(false);
    }
  };

  return <section className="mt-4 min-w-0 space-y-2 border-t border-border pt-4">
    <h3 className="font-semibold">Delete account</h3>
    <p className="text-sm text-muted-foreground">Permanently delete your SaaSSuite account and account data, then sign out and return to the home page. This cannot be undone.</p>
    <Button variant="destructive" className="w-full sm:w-auto" onClick={() => { setOpen(true); setError(''); setConfirmation(''); setAcknowledged(false); }}>
      <Trash2 className="mr-2 h-4 w-4" />Delete Account
    </Button>
    <Dialog open={open} onOpenChange={(value) => { if (!busy) setOpen(value); }}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-md" onEscapeKeyDown={(e) => { if (busy) e.preventDefault(); }} onInteractOutside={(e) => { if (busy) e.preventDefault(); }}>
        <DialogHeader>
          <DialogTitle>Permanently delete your account?</DialogTitle>
          <DialogDescription className="break-words">This deletes {actualEmail} from SaaSSuite, including your profile, Client Hub settings, saved connections, learning history and Copilot history. Your team will lose access to this workspace, and its live Hub links will stop working. You will be signed out and returned to the home page. Your HighLevel account is not deleted.</DialogDescription>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">Deleting your account does not cancel paid subscriptions. Cancel web subscriptions in Settings → Billing; cancel Apple or Google subscriptions in your phone’s subscription settings. Required billing and legal records may be retained.</p>
        <div className="flex items-start gap-2">
          <Checkbox id="delete-account-ack" checked={acknowledged} disabled={busy} onCheckedChange={(value) => setAcknowledged(value === true)} />
          <Label htmlFor="delete-account-ack" className="text-sm leading-relaxed">I understand deletion is permanent and I am responsible for canceling any subscriptions.</Label>
        </div>
        <div className="space-y-2">
          <Label htmlFor="delete-account-confirm">Type DELETE to confirm</Label>
          <Input id="delete-account-confirm" autoComplete="off" value={confirmation} disabled={busy} onChange={(e) => setConfirmation(e.target.value)} />
        </div>
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        <DialogFooter className="gap-2">
          <Button variant="outline" disabled={busy} onClick={() => setOpen(false)}>Keep Account</Button>
          <Button variant="destructive" disabled={busy || !acknowledged || confirmation !== 'DELETE'} onClick={deleteAccount}>
            {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{busy ? 'Deleting…' : 'Permanently Delete Account'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </section>;
}
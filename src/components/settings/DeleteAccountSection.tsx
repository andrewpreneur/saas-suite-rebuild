import { useState } from 'react';
import { ChevronDown, Loader2, Trash2 } from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
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
import { DangerZone } from '@/components/premium/settings/DangerZone';

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

  return <DangerZone
    title="Delete account"
    description="Permanently removes your SaaSSuite account and its data. This cannot be undone."
  >
    <Button variant="outline" className="h-11 w-full border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive sm:h-10 sm:w-auto" onClick={() => { setOpen(true); setError(''); setConfirmation(''); setAcknowledged(false); }}>
      <Trash2 className="mr-2 h-4 w-4" />Delete account
    </Button>
    <Dialog open={open} onOpenChange={(value) => { if (!busy) setOpen(value); }}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-md" onEscapeKeyDown={(e) => { if (busy) e.preventDefault(); }} onInteractOutside={(e) => { if (busy) e.preventDefault(); }}>
        <DialogHeader>
          <DialogTitle>Delete your account for good?</DialogTitle>
          <DialogDescription className="break-words">This deletes {actualEmail} and everything in its workspace, then signs you out.</DialogDescription>
        </DialogHeader>
        <Collapsible>
          <CollapsibleTrigger className="group flex min-h-11 w-full items-center justify-between gap-3 rounded-lg text-left text-sm font-medium text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            What gets deleted, and what does not
            <ChevronDown className="size-4 shrink-0 text-muted-foreground transition-transform duration-200 ease-out group-data-[state=open]:rotate-180 motion-reduce:transition-none" aria-hidden="true" />
          </CollapsibleTrigger>
          <CollapsibleContent>
            <ul className="list-disc space-y-1.5 pb-2 pl-5 text-sm text-muted-foreground">
              <li>Deleted: your profile, Client Hub settings, saved connections, learning history and Copilot history.</li>
              <li>Your team loses access to this workspace and its live Hub links stop working.</li>
              <li>Your HighLevel account is not deleted.</li>
              <li>Paid subscriptions are not cancelled. Cancel web plans in Settings, Billing, and Apple or Google plans in your phone’s subscription settings.</li>
              <li>Required billing and legal records may be retained.</li>
            </ul>
          </CollapsibleContent>
        </Collapsible>
        <div className="flex items-start gap-3">
          <Checkbox id="delete-account-ack" className="mt-0.5" checked={acknowledged} disabled={busy} onCheckedChange={(value) => setAcknowledged(value === true)} />
          <Label htmlFor="delete-account-ack" className="text-sm font-normal leading-relaxed">I understand this is permanent and that I must cancel any subscriptions myself.</Label>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="delete-account-confirm">Type DELETE to confirm</Label>
          <Input id="delete-account-confirm" autoComplete="off" autoCapitalize="characters" spellCheck={false} value={confirmation} disabled={busy} onChange={(e) => setConfirmation(e.target.value)} aria-invalid={!!error} aria-describedby={error ? 'delete-account-error' : undefined} />
          {error && <p id="delete-account-error" role="alert" className="text-sm text-destructive">{error}</p>}
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" className="h-11 sm:h-10" disabled={busy} onClick={() => setOpen(false)}>Keep account</Button>
          <Button variant="destructive" className="h-11 sm:h-10" disabled={busy || !acknowledged || confirmation !== 'DELETE'} onClick={deleteAccount}>
            {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{busy ? 'Deleting account' : 'Delete account for good'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </DangerZone>;
}
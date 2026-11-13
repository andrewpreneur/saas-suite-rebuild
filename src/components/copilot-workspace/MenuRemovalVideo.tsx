import { useState } from "react";
import { Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { MENU_REMOVAL_VIDEO_URL } from "../../../supabase/functions/_shared/menuRemovalGuide";

export function MenuRemovalVideoDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl p-4 sm:p-6">
        <DialogHeader className="pr-6">
          <DialogTitle>Menu Link Removal</DialogTitle>
          <DialogDescription>Training video</DialogDescription>
        </DialogHeader>
        {open ? (
          <video controls autoPlay preload="metadata" src={MENU_REMOVAL_VIDEO_URL} className="aspect-video w-full rounded-lg bg-muted object-contain" />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

export function MenuRemovalVideo() {
  const [open, setOpen] = useState(false);
  return <div className="flex min-w-0 flex-wrap items-center gap-3 border-b border-border py-3">
    <p className="min-w-0 flex-1 text-sm font-medium text-foreground">Menu Link Removal training</p>
    <Button variant="outline" size="sm" onClick={() => setOpen(true)}><Play className="h-4 w-4" />Watch now</Button>
    <MenuRemovalVideoDialog open={open} onOpenChange={setOpen} />
  </div>;
}

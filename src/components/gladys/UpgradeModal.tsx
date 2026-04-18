import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Crown } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
}

export const UpgradeModal = ({ open, onOpenChange }: Props) => (
  <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent className="border-gold/30">
      <DialogHeader>
        <div className="mx-auto bg-gradient-gold rounded-full p-3 mb-2 shadow-gold">
          <Crown className="h-6 w-6 text-primary-foreground" />
        </div>
        <DialogTitle className="text-center text-2xl font-display">Daily limit reached</DialogTitle>
        <DialogDescription className="text-center pt-2">
          You've used your 3 free scans for today. Come back tomorrow, or upgrade for unlimited scans.
        </DialogDescription>
      </DialogHeader>
      <div className="flex flex-col gap-2 mt-2">
        <Button className="bg-gradient-gold text-primary-foreground hover:opacity-90 font-semibold shadow-gold">
          Upgrade for unlimited scans
        </Button>
        <Button variant="ghost" onClick={() => onOpenChange(false)}>
          Maybe later
        </Button>
      </div>
    </DialogContent>
  </Dialog>
);

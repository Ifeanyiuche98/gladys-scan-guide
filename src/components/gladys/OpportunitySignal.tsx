import type { OpportunityTag } from "@/lib/scan-types";
import { Flame, TrendingUp, Sparkles, Moon } from "lucide-react";

const META: Record<OpportunityTag, { icon: typeof Flame; bg: string; text: string; ring: string }> = {
  "Early Gem": { icon: Sparkles, bg: "bg-gold/10", text: "text-gold", ring: "ring-gold/40" },
  "Trending": { icon: TrendingUp, bg: "bg-success/10", text: "text-success", ring: "ring-success/40" },
  "Overhyped": { icon: Flame, bg: "bg-warning/10", text: "text-warning", ring: "ring-warning/40" },
  "Dead Zone": { icon: Moon, bg: "bg-muted", text: "text-muted-foreground", ring: "ring-border" },
};

export const OpportunitySignal = ({ tag, reason }: { tag: OpportunityTag; reason: string }) => {
  const m = META[tag];
  const Icon = m.icon;
  return (
    <div className="bg-card border border-border rounded-2xl p-6 shadow-card-soft animate-fade-up">
      <p className="text-xs uppercase tracking-wider text-muted-foreground mb-3">Opportunity Signal</p>
      <div className="flex items-start gap-4">
        <div className={`${m.bg} ${m.ring} ring-1 rounded-xl p-3 shrink-0`}>
          <Icon className={`h-6 w-6 ${m.text}`} />
        </div>
        <div className="flex-1 min-w-0">
          <p className={`text-xl font-display font-bold ${m.text}`}>{tag}</p>
          <p className="text-sm text-muted-foreground mt-1.5 leading-relaxed">{reason}</p>
        </div>
      </div>
    </div>
  );
};

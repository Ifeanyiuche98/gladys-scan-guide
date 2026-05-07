import type { RecentScan } from "@/lib/recent-scans";
import { timeAgo } from "@/lib/recent-scans";
import { Clock } from "lucide-react";

interface Props {
  items: RecentScan[];
  onPick: (item: RecentScan) => void;
}

const VERDICT_STYLE: Record<RecentScan["verdict"], { label: string; cls: string; emoji: string }> = {
  "SAFE-ISH": { label: "SAFE-ISH", cls: "text-success bg-success/10 ring-success/30", emoji: "✅" },
  "CAUTION": { label: "CAUTION", cls: "text-warning bg-warning/10 ring-warning/30", emoji: "⚠️" },
  "AVOID": { label: "AVOID", cls: "text-destructive bg-destructive/10 ring-destructive/30", emoji: "🚨" },
};

export const RecentScans = ({ items, onPick }: Props) => {
  return (
    <section className="mt-8 animate-fade-up">
      <div className="flex items-center gap-2 mb-3 px-1">
        <Clock className="h-3.5 w-3.5 text-muted-foreground" />
        <h2 className="text-xs uppercase tracking-[0.18em] text-muted-foreground font-medium">
          Recent Scans
        </h2>
      </div>

      {items.length === 0 ? (
        <p className="text-xs text-muted-foreground/80 px-1">
          Your recent token checks will appear here.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {items.map((item) => {
            const v = VERDICT_STYLE[item.verdict];
            return (
              <li key={item.key}>
                <button
                  onClick={() => onPick(item)}
                  className="w-full flex items-center gap-3 bg-card/60 hover:bg-card border border-border hover:border-gold/40 rounded-xl px-3 py-2.5 transition-colors text-left"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="font-semibold text-sm truncate">{item.symbol}</span>
                      <span className="text-xs text-muted-foreground truncate">— {item.name}</span>
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[10px] text-muted-foreground/80">{item.chain}</span>
                      <span className="text-[10px] text-muted-foreground/60">·</span>
                      <span className="text-[10px] text-muted-foreground/80">{timeAgo(item.scannedAt)}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-sm font-bold tabular-nums">{item.riskScore}</span>
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ring-1 ${v.cls}`}>
                      {v.emoji} {v.label}
                    </span>
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
};

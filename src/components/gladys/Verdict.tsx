import type { Verdict as V } from "@/lib/scan-types";

const META: Record<V, { emoji: string; label: string; bg: string; ring: string; text: string }> = {
  "SAFE-ISH": {
    emoji: "✅",
    label: "SAFE-ISH",
    bg: "bg-success/10",
    ring: "ring-success/40",
    text: "text-success",
  },
  "CAUTION": {
    emoji: "⚠️",
    label: "CAUTION",
    bg: "bg-warning/10",
    ring: "ring-warning/40",
    text: "text-warning",
  },
  "AVOID": {
    emoji: "🚨",
    label: "AVOID",
    bg: "bg-destructive/10",
    ring: "ring-destructive/40",
    text: "text-destructive",
  },
};

export const VerdictBanner = ({ verdict, reason }: { verdict: V; reason: string }) => {
  const m = META[verdict];
  return (
    <div className={`${m.bg} ${m.ring} ring-2 rounded-2xl p-7 sm:p-8 text-center shadow-card-soft animate-fade-up`}>
      <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground mb-3">Final Verdict</p>
      <div className="flex items-center justify-center gap-3 mb-3">
        <span className="text-4xl">{m.emoji}</span>
        <span className={`text-3xl sm:text-4xl font-display font-bold tracking-tight ${m.text}`}>
          {m.label}
        </span>
      </div>
      <p className="text-sm sm:text-base text-foreground/80 max-w-md mx-auto leading-relaxed">
        {reason}
      </p>
    </div>
  );
};

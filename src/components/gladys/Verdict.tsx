import type { Verdict as V, Confidence, Outlook } from "@/lib/scan-types";
import { TrendingUp, Minus, TrendingDown, ShieldCheck } from "lucide-react";

const META: Record<V, { emoji: string; label: string; bg: string; ring: string; text: string }> = {
  "SAFE-ISH": { emoji: "✅", label: "SAFE-ISH", bg: "bg-success/10", ring: "ring-success/40", text: "text-success" },
  "CAUTION": { emoji: "⚠️", label: "CAUTION", bg: "bg-warning/10", ring: "ring-warning/40", text: "text-warning" },
  "AVOID": { emoji: "🚨", label: "AVOID", bg: "bg-destructive/10", ring: "ring-destructive/40", text: "text-destructive" },
};

const CONF_META: Record<Confidence, { text: string; bg: string }> = {
  High: { text: "text-success", bg: "bg-success/10 ring-success/30" },
  Medium: { text: "text-warning", bg: "bg-warning/10 ring-warning/30" },
  Low: { text: "text-destructive", bg: "bg-destructive/10 ring-destructive/30" },
};

const OUTLOOK_META: Record<Outlook, { icon: typeof TrendingUp; text: string; bg: string }> = {
  Bullish: { icon: TrendingUp, text: "text-success", bg: "bg-success/10 ring-success/30" },
  Neutral: { icon: Minus, text: "text-muted-foreground", bg: "bg-muted ring-border" },
  Weak: { icon: TrendingDown, text: "text-destructive", bg: "bg-destructive/10 ring-destructive/30" },
};

interface Props {
  verdict: V;
  reason: string;
  confidence?: Confidence;
  outlook?: Outlook;
}

export const VerdictBanner = ({ verdict, reason, confidence, outlook }: Props) => {
  const m = META[verdict];
  const OutlookIcon = outlook ? OUTLOOK_META[outlook].icon : null;
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

      {(confidence || outlook) && (
        <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
          {confidence && (
            <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full ring-1 ${CONF_META[confidence].bg} ${CONF_META[confidence].text}`}>
              <ShieldCheck className="h-3.5 w-3.5" />
              {confidence} Confidence
            </span>
          )}
          {outlook && OutlookIcon && (
            <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full ring-1 ${OUTLOOK_META[outlook].bg} ${OUTLOOK_META[outlook].text}`}>
              <OutlookIcon className="h-3.5 w-3.5" />
              {outlook} Outlook
            </span>
          )}
        </div>
      )}
    </div>
  );
};

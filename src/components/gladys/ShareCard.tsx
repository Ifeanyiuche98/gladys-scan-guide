import { forwardRef } from "react";
import type { ScanResult, Verdict } from "@/lib/scan-types";

const verdictMeta: Record<Verdict, { emoji: string; label: string; tone: string; ring: string; bar: string }> = {
  "SAFE-ISH": { emoji: "✅", label: "SAFE-ISH", tone: "text-emerald-400", ring: "ring-emerald-500/40", bar: "bg-emerald-500" },
  "CAUTION":  { emoji: "⚠️", label: "CAUTION",  tone: "text-amber-400",   ring: "ring-amber-500/40",   bar: "bg-amber-500" },
  "AVOID":    { emoji: "🚨", label: "AVOID",    tone: "text-red-400",     ring: "ring-red-500/40",     bar: "bg-red-500" },
};

function buildKeyInsight(result: ScanResult): string {
  const { token, riskBreakdown, classification, verdict } = result;
  if (classification === "MAJOR") return "Widely adopted asset with deep global liquidity.";

  const lowVol = token.volume24h !== undefined && token.volume24h < 50_000;
  const lowLiq = token.liquidityUsd !== undefined && token.liquidityUsd < 100_000;
  const whales = riskBreakdown.whaleConcentration < 50;
  const young = token.ageDays !== undefined && token.ageDays < 30;

  if (lowLiq) return "Thin liquidity — exiting may be difficult.";
  if (lowVol) return "Low trading activity — fewer real buyers if you want to sell.";
  if (whales) return "Concentrated holdings — a few wallets can move the price.";
  if (young) return "Brand new token — no real track record yet.";
  if (verdict === "AVOID") return "Multiple risk signals — proceed with extreme caution.";
  if (verdict === "CAUTION") return "Mixed signals — size small and stay cautious.";
  return "Looks reasonable on the basics — always do your own research.";
}

interface Props {
  result: ScanResult;
}

export const ShareCard = forwardRef<HTMLDivElement, Props>(({ result }, ref) => {
  const { token, riskScore, verdict } = result;
  const m = verdictMeta[verdict];
  const sym = token.symbol && token.symbol !== "?" ? token.symbol : "";
  const insight = buildKeyInsight(result);

  return (
    <div
      ref={ref}
      style={{ width: 540, height: 720 }}
      className="relative overflow-hidden rounded-[32px] bg-gradient-to-br from-[#0b0d12] via-[#0f1218] to-[#0a0c10] flex flex-col"
    >
      {/* Glow accents */}
      <div className={`absolute -top-24 -right-24 h-72 w-72 rounded-full blur-3xl opacity-30 ${m.bar}`} />
      <div className="absolute -bottom-32 -left-24 h-80 w-80 rounded-full blur-3xl opacity-10 bg-amber-400" />

      {/* Top: Token Identity */}
      <div className="relative px-10 pt-10">
        <div className="flex items-center justify-between">
          <div className="text-[11px] tracking-[0.35em] text-amber-400/80 font-semibold">GLADYS · SCAN</div>
          <div className="text-[10px] tracking-[0.25em] uppercase text-white/40">{token.chain}</div>
        </div>
        <div className="mt-6">
          <div className="text-3xl font-bold text-white leading-tight">
            {token.name}
          </div>
          {sym && <div className="text-base text-white/50 mt-1">${sym}</div>}
        </div>
      </div>

      {/* Center: Score + Verdict */}
      <div className="relative flex-1 px-10 flex flex-col items-center justify-center">
        <div className="text-[11px] tracking-[0.3em] uppercase text-white/40 mb-3">Safety Score</div>
        <div className="flex items-baseline">
          <span className={`text-[140px] leading-none font-black tracking-tight ${m.tone}`}>
            {riskScore}
          </span>
          <span className="text-3xl font-semibold text-white/40 ml-2">/100</span>
        </div>

        {/* Score bar */}
        <div className="mt-6 w-full max-w-[360px] h-2 rounded-full bg-white/10 overflow-hidden">
          <div className={`h-full ${m.bar}`} style={{ width: `${Math.max(4, riskScore)}%` }} />
        </div>

        {/* Verdict */}
        <div className={`mt-7 inline-flex items-center gap-3 px-5 py-2.5 rounded-full ring-2 ${m.ring} bg-white/5`}>
          <span className="text-2xl leading-none">{m.emoji}</span>
          <span className={`text-xl font-bold tracking-wide ${m.tone}`}>{m.label}</span>
        </div>
      </div>

      {/* Insight */}
      <div className="relative px-10">
        <div className="rounded-2xl bg-white/[0.04] ring-1 ring-white/10 px-5 py-4">
          <div className="text-[10px] tracking-[0.25em] uppercase text-white/40 mb-1">Key Insight</div>
          <p className="text-[15px] leading-snug text-white/90">{insight}</p>
        </div>
      </div>

      {/* Self-check trigger */}
      <div className="relative px-10 mt-4 text-center">
        <p className="text-[13px] font-semibold text-white/85">Would your token pass this test?</p>
        <p className="text-[11px] text-white/40 mt-0.5">Takes 5 seconds · Free to check</p>
      </div>

      {/* Branding */}
      <div className="relative px-10 pt-4 pb-6 flex items-center justify-between">
        <div className="text-[10px] tracking-[0.3em] uppercase text-white/40">Analyzed by GLADYS</div>
        <div className="text-[10px] text-white/30">Used by traders to spot risky tokens</div>
      </div>
    </div>
  );
});

ShareCard.displayName = "ShareCard";

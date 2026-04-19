import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { ScanResult } from "@/lib/scan-types";

interface Props {
  result: ScanResult;
}

type Flag = {
  level: "danger" | "caution" | "safe";
  message: string;
};

function buildFlags(result: ScanResult): Flag[] {
  const flags: Flag[] = [];
  const { token, riskBreakdown, riskScore } = result;

  // Liquidity
  if (riskBreakdown.liquidity < 30 || (token.liquidityUsd !== undefined && token.liquidityUsd < 25_000)) {
    flags.push({
      level: "danger",
      message: "Low liquidity — you may not be able to sell easily.",
    });
  } else if (riskBreakdown.liquidity < 60) {
    flags.push({
      level: "caution",
      message: "Liquidity is thin — large sells could move the price a lot.",
    });
  }

  // Whale concentration
  if (riskBreakdown.whaleConcentration < 35) {
    flags.push({
      level: "danger",
      message: "A few wallets likely control most of the supply — price can be manipulated.",
    });
  } else if (riskBreakdown.whaleConcentration < 60) {
    flags.push({
      level: "caution",
      message: "Holdings look somewhat concentrated — watch for sudden big moves.",
    });
  }

  // Age / contract risk
  if (token.ageDays !== undefined && token.ageDays < 7) {
    flags.push({
      level: "danger",
      message: "This token is very new — high uncertainty and risk.",
    });
  } else if (token.ageDays !== undefined && token.ageDays < 30) {
    flags.push({
      level: "caution",
      message: "Token is less than a month old — track record is limited.",
    });
  }

  // Volatility / pump-and-dump
  const change = Math.abs(token.priceChange24h ?? 0);
  if (change > 100) {
    flags.push({
      level: "danger",
      message: "Unusual trading activity detected — possible pump and dump.",
    });
  } else if (change > 40) {
    flags.push({
      level: "caution",
      message: "Big price swings in the last 24 hours — expect volatility.",
    });
  }

  // Volume
  if (!token.volume24h || token.volume24h < 1_000) {
    flags.push({
      level: "danger",
      message: "Almost no one is trading this — exiting may be very hard.",
    });
  } else if (token.volume24h < 50_000) {
    flags.push({
      level: "caution",
      message: "Trading volume is low — fewer buyers if you want to sell.",
    });
  }

  // Missing data
  const missingCore =
    token.liquidityUsd === undefined &&
    token.volume24h === undefined &&
    token.marketCap === undefined;
  if (missingCore || token.chain === "Unknown") {
    flags.push({
      level: "caution",
      message: "Limited data available — proceed with caution.",
    });
  }

  // All clear
  if (flags.length === 0) {
    flags.push({
      level: "safe",
      message: `No major red flags detected${riskScore >= 70 ? "" : ""}, but always do your own research.`,
    });
  }

  return flags;
}

const iconFor = (level: Flag["level"]) =>
  level === "danger" ? "❌" : level === "caution" ? "⚠️" : "✅";

const styleFor = (level: Flag["level"]) => {
  if (level === "danger") return "bg-destructive/10 border-destructive/30 text-destructive-foreground";
  if (level === "caution") return "bg-gold/10 border-gold/30 text-foreground";
  return "bg-emerald-500/10 border-emerald-500/30 text-foreground";
};

export const RedFlags = ({ result }: Props) => {
  const flags = buildFlags(result);

  return (
    <Card className="border-border/60 bg-card/60 backdrop-blur">
      <CardHeader className="pb-3">
        <CardTitle className="text-base sm:text-lg flex items-center gap-2">
          <span aria-hidden>🚨</span>
          <span>Red Flags Detected</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {flags.map((f, i) => (
          <div
            key={i}
            className={`flex items-start gap-3 rounded-lg border px-3 py-2.5 text-sm leading-snug ${styleFor(f.level)}`}
          >
            <span className="text-base leading-none pt-0.5" aria-hidden>
              {iconFor(f.level)}
            </span>
            <p className="flex-1">{f.message}</p>
          </div>
        ))}
      </CardContent>
    </Card>
  );
};

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { ScanResult } from "@/lib/scan-types";

interface Props {
  result: ScanResult;
}

type Flag = {
  level: "danger" | "caution" | "safe";
  message: string;
  weight: number; // higher = more severe / show first
};

// ---- formatters ----
const fmtUsd = (n: number) => {
  if (n >= 1_000_000_000) return `$${(n / 1_000_000_000).toFixed(2)}B`;
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}K`;
  return `$${n.toFixed(0)}`;
};

const fmtAge = (days: number) => {
  if (days < 1) return "less than a day";
  if (days === 1) return "1 day";
  if (days < 30) return `${days} days`;
  if (days < 365) return `${Math.floor(days / 30)} month${Math.floor(days / 30) === 1 ? "" : "s"}`;
  const years = (days / 365).toFixed(1);
  return `${years} years`;
};

function buildFlags(result: ScanResult): Flag[] {
  const flags: Flag[] = [];
  const { token, riskBreakdown } = result;
  const sym = token.symbol && token.symbol !== "?" ? token.symbol : token.name;

  // --- Liquidity (use real numbers when we have them) ---
  if (token.liquidityUsd === undefined) {
    flags.push({
      level: "caution",
      weight: 55,
      message: `No liquidity data found for ${sym} — we can't confirm you'd be able to sell.`,
    });
  } else if (token.liquidityUsd < 10_000) {
    flags.push({
      level: "danger",
      weight: 95,
      message: `Critically low liquidity (${fmtUsd(token.liquidityUsd)}) — exiting could be nearly impossible.`,
    });
  } else if (token.liquidityUsd < 50_000) {
    flags.push({
      level: "danger",
      weight: 85,
      message: `Very low liquidity (${fmtUsd(token.liquidityUsd)}) — even small sells will move the price hard.`,
    });
  } else if (token.liquidityUsd < 250_000) {
    flags.push({
      level: "caution",
      weight: 60,
      message: `Thin liquidity pool (${fmtUsd(token.liquidityUsd)}) — large trades will slip noticeably.`,
    });
  } else if (token.liquidityUsd >= 1_000_000) {
    flags.push({
      level: "safe",
      weight: 10,
      message: `Healthy liquidity (${fmtUsd(token.liquidityUsd)}) — easy to enter and exit.`,
    });
  }

  // --- 24h Volume ---
  if (token.volume24h === undefined) {
    flags.push({
      level: "caution",
      weight: 50,
      message: `No 24h trading volume reported for ${sym}.`,
    });
  } else if (token.volume24h < 500) {
    flags.push({
      level: "danger",
      weight: 90,
      message: `Almost no trading in the last 24h (${fmtUsd(token.volume24h)}) — looks abandoned.`,
    });
  } else if (token.volume24h < 25_000) {
    flags.push({
      level: "caution",
      weight: 65,
      message: `Weak 24h volume (${fmtUsd(token.volume24h)}) — few real buyers if you want out.`,
    });
  } else if (token.volume24h > 1_000_000) {
    flags.push({
      level: "safe",
      weight: 8,
      message: `Strong daily volume (${fmtUsd(token.volume24h)}) — active two-sided market.`,
    });
  }

  // --- Volume vs liquidity sanity (wash-trade smell) ---
  if (
    token.volume24h !== undefined &&
    token.liquidityUsd !== undefined &&
    token.liquidityUsd > 5_000 &&
    token.volume24h / token.liquidityUsd > 20
  ) {
    flags.push({
      level: "danger",
      weight: 80,
      message: `Volume is ${(token.volume24h / token.liquidityUsd).toFixed(0)}× the liquidity — possible wash trading.`,
    });
  }

  // --- Token / pair age ---
  if (token.ageDays !== undefined) {
    if (token.ageDays < 1) {
      flags.push({
        level: "danger",
        weight: 88,
        message: `Brand new — created ${fmtAge(token.ageDays)} ago. Extremely high rug risk.`,
      });
    } else if (token.ageDays < 7) {
      flags.push({
        level: "danger",
        weight: 75,
        message: `Only ${fmtAge(token.ageDays)} old — no track record yet.`,
      });
    } else if (token.ageDays < 30) {
      flags.push({
        level: "caution",
        weight: 55,
        message: `Young token — ${fmtAge(token.ageDays)} of history.`,
      });
    } else if (token.ageDays > 365) {
      flags.push({
        level: "safe",
        weight: 12,
        message: `Established for ${fmtAge(token.ageDays)} — survived multiple market cycles.`,
      });
    }
  }

  // --- Price action (directional, not just absolute) ---
  const change = token.priceChange24h;
  if (change !== undefined) {
    if (change > 100) {
      flags.push({
        level: "danger",
        weight: 78,
        message: `Up ${change.toFixed(0)}% in 24h — classic pump pattern, dump risk is high.`,
      });
    } else if (change < -50) {
      flags.push({
        level: "danger",
        weight: 82,
        message: `Down ${Math.abs(change).toFixed(0)}% in 24h — actively crashing right now.`,
      });
    } else if (change > 40) {
      flags.push({
        level: "caution",
        weight: 50,
        message: `Up ${change.toFixed(0)}% today — expect a pullback, don't chase.`,
      });
    } else if (change < -20) {
      flags.push({
        level: "caution",
        weight: 55,
        message: `Down ${Math.abs(change).toFixed(0)}% today — momentum is against it.`,
      });
    }
  }

  // --- Market cap signals ---
  if (token.marketCap !== undefined) {
    if (token.marketCap < 100_000) {
      flags.push({
        level: "danger",
        weight: 70,
        message: `Micro market cap (${fmtUsd(token.marketCap)}) — easily manipulated by a single buyer.`,
      });
    } else if (token.marketCap < 1_000_000) {
      flags.push({
        level: "caution",
        weight: 45,
        message: `Small market cap (${fmtUsd(token.marketCap)}) — expect high volatility.`,
      });
    }
  }

  // --- Whale concentration (from breakdown) ---
  if (riskBreakdown.whaleConcentration < 30) {
    flags.push({
      level: "danger",
      weight: 72,
      message: `Supply looks heavily concentrated — a few wallets can crash the price at will.`,
    });
  } else if (riskBreakdown.whaleConcentration < 55) {
    flags.push({
      level: "caution",
      weight: 48,
      message: `Holdings appear somewhat concentrated — watch for sudden whale moves.`,
    });
  }

  // --- Chain / data availability ---
  if (token.chain === "Unknown") {
    flags.push({
      level: "caution",
      weight: 60,
      message: `We couldn't identify which blockchain ${sym} runs on — verify before sending funds.`,
    });
  }

  const missingCore =
    token.liquidityUsd === undefined &&
    token.volume24h === undefined &&
    token.marketCap === undefined;
  if (missingCore) {
    flags.push({
      level: "danger",
      weight: 92,
      message: `No reliable market data found for ${sym} — could be unlisted, scam, or mistyped.`,
    });
  }

  // --- All clear fallback ---
  if (flags.filter((f) => f.level !== "safe").length === 0) {
    flags.push({
      level: "safe",
      weight: 1,
      message: `No major red flags detected for ${sym} — but always do your own research.`,
    });
  }

  // Sort by severity (danger > caution > safe), then by weight, cap to 5
  const levelRank = { danger: 3, caution: 2, safe: 1 };
  return flags
    .sort((a, b) => levelRank[b.level] - levelRank[a.level] || b.weight - a.weight)
    .slice(0, 5);
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
  const allClear = flags.length === 1 && flags[0].level === "safe";

  return (
    <Card className="border-border/60 bg-card/60 backdrop-blur">
      <CardHeader className="pb-3">
        <CardTitle className="text-base sm:text-lg flex items-center gap-2">
          <span aria-hidden>{allClear ? "✅" : "🚨"}</span>
          <span>{allClear ? "No Major Red Flags" : "Red Flags Detected"}</span>
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

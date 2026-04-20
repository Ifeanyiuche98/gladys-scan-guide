import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { ScanResult, Verdict } from "@/lib/scan-types";

interface Props {
  result: ScanResult;
}

interface Reason {
  weight: number; // higher = more impactful
  text: string;
}

function buildReasons(result: ScanResult): Reason[] {
  const { token, riskBreakdown, verdict } = result;
  const reasons: Reason[] = [];

  // Major asset heuristic: globally liquid across CEX+DEX, so missing
  // single-pool liquidity data is NOT a concern.
  const isMajorAsset =
    (token.marketCap ?? 0) >= 1_000_000_000 &&
    (token.volume24h ?? 0) >= 10_000_000;
  const isLargeAsset =
    (token.marketCap ?? 0) >= 100_000_000 &&
    (token.volume24h ?? 0) >= 1_000_000;

  // Liquidity
  if (token.liquidityUsd !== undefined) {
    if (token.liquidityUsd < 25_000) {
      reasons.push({ weight: 95, text: "Extremely low liquidity — exits could be very hard" });
    } else if (token.liquidityUsd < 100_000) {
      reasons.push({ weight: 75, text: "Liquidity is too low for safe exits" });
    } else if (token.liquidityUsd < 500_000) {
      reasons.push({ weight: 40, text: "Liquidity is thin — large sells move the price" });
    } else if (verdict === "SAFE-ISH") {
      reasons.push({ weight: 30, text: "Healthy liquidity makes buying and selling easier" });
    }
  } else if (isMajorAsset || isLargeAsset) {
    reasons.push({ weight: 35, text: "Widely traded across major exchanges with deep global liquidity" });
  } else if (riskBreakdown.liquidity < 60) {
    reasons.push({ weight: 60, text: "Liquidity data is unclear or limited" });
  }

  // Trading activity / volume
  if (!token.volume24h || token.volume24h < 1_000) {
    reasons.push({ weight: 90, text: "No active trading detected right now" });
  } else if (token.volume24h < 50_000) {
    reasons.push({ weight: 65, text: "Trading activity is weak" });
  } else if (verdict === "SAFE-ISH" && token.volume24h > 250_000) {
    reasons.push({ weight: 35, text: "Steady trading activity from real buyers and sellers" });
  }

  // Whale concentration
  if (riskBreakdown.whaleConcentration < 35) {
    reasons.push({ weight: 80, text: "A few wallets likely control most of the supply" });
  } else if (riskBreakdown.whaleConcentration < 60) {
    reasons.push({ weight: 50, text: "Holdings look somewhat concentrated in few wallets" });
  }

  // Token age
  if (token.ageDays !== undefined) {
    if (token.ageDays < 7) {
      reasons.push({ weight: 70, text: "Token is brand new — very little track record" });
    } else if (token.ageDays < 30) {
      reasons.push({ weight: 45, text: "Token is less than a month old" });
    } else if (token.ageDays > 365 && verdict === "SAFE-ISH") {
      reasons.push({ weight: 30, text: "Established token with over a year of history" });
    }
  }

  // Volatility
  const change = Math.abs(token.priceChange24h ?? 0);
  if (change > 100) {
    reasons.push({ weight: 70, text: "Extreme price swings — possible pump activity" });
  } else if (change > 40) {
    reasons.push({ weight: 45, text: "Big price swings in the last 24 hours" });
  }

  // Data availability
  const missingCore =
    token.liquidityUsd === undefined &&
    token.volume24h === undefined &&
    token.marketCap === undefined;
  if (missingCore || token.chain === "Unknown") {
    reasons.push({ weight: 85, text: "No reliable data available for this token" });
  }

  // Safe fallback
  if (reasons.length === 0) {
    if (verdict === "SAFE-ISH") {
      reasons.push({ weight: 1, text: "No major risk factors detected in our checks" });
    } else {
      reasons.push({ weight: 1, text: "Overall risk score landed in this range based on combined signals" });
    }
  }

  return reasons.sort((a, b) => b.weight - a.weight).slice(0, 4);
}

const verdictLabel: Record<Verdict, string> = {
  "SAFE-ISH": "SAFE-ISH",
  "CAUTION": "CAUTION",
  "AVOID": "AVOID",
};

const verdictColor: Record<Verdict, string> = {
  "SAFE-ISH": "text-success",
  "CAUTION": "text-warning",
  "AVOID": "text-destructive",
};

export const WhyVerdict = ({ result }: Props) => {
  const reasons = buildReasons(result);

  return (
    <Card className="border-border/60 bg-card/60 backdrop-blur">
      <CardHeader className="pb-3">
        <CardTitle className="text-base sm:text-lg flex items-center gap-2">
          <span aria-hidden>🧠</span>
          <span>Why This Verdict</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-foreground/80 leading-relaxed">
          This token is rated{" "}
          <span className={`font-semibold ${verdictColor[result.verdict]}`}>
            {verdictLabel[result.verdict]}
          </span>{" "}
          because:
        </p>
        <ul className="space-y-2">
          {reasons.map((r, i) => (
            <li
              key={i}
              className="flex items-start gap-2.5 text-sm leading-snug text-foreground/90"
            >
              <span
                className="mt-1.5 h-1.5 w-1.5 rounded-full bg-gold/80 flex-shrink-0"
                aria-hidden
              />
              <span>{r.text}</span>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
};

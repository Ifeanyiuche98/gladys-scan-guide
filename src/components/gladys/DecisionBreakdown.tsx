import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { ScanResult, Verdict } from "@/lib/scan-types";
import { CheckCircle2, AlertTriangle } from "lucide-react";

interface Props {
  result: ScanResult;
}

interface Signal {
  weight: number;
  text: string;
}

function buildSignals(result: ScanResult): { positives: Signal[]; risks: Signal[] } {
  const { token, riskBreakdown, classification, verdict } = result;
  const positives: Signal[] = [];
  const risks: Signal[] = [];

  // ---- MAJOR assets: anchor on positives, allow only realistic risks ----
  if (classification === "MAJOR") {
    positives.push({ weight: 100, text: "Widely adopted asset traded across major global exchanges" });
    positives.push({ weight: 90, text: "Deep global liquidity — easy to enter and exit" });
    positives.push({ weight: 80, text: "Consistent, high daily trading activity from real participants" });
    if ((token.ageDays ?? 0) > 365) {
      positives.push({ weight: 70, text: "Established track record across multiple market cycles" });
    }
    const change = Math.abs(token.priceChange24h ?? 0);
    if (change > 25) {
      risks.push({ weight: 60, text: "Notable short-term price movement — expect volatility" });
    } else if (change > 10) {
      risks.push({ weight: 40, text: "Moderate short-term price movement" });
    }
    return {
      positives: positives.sort((a, b) => b.weight - a.weight).slice(0, 4),
      risks: risks.sort((a, b) => b.weight - a.weight).slice(0, 2),
    };
  }

  // ---- MID / LOW / UNKNOWN ----

  // Liquidity
  if (token.liquidityUsd !== undefined) {
    if (token.liquidityUsd >= 500_000) {
      positives.push({ weight: 70, text: "Healthy liquidity supports smoother buying and selling" });
    } else if (token.liquidityUsd >= 100_000) {
      positives.push({ weight: 40, text: "Reasonable liquidity for moderate trade sizes" });
      if (classification === "LOW") risks.push({ weight: 50, text: "Liquidity may be thin for larger positions" });
    } else if (token.liquidityUsd >= 25_000) {
      risks.push({ weight: 75, text: "Liquidity is low — large sells will move the price" });
    } else {
      risks.push({ weight: 95, text: "Extremely low liquidity — exits could be very difficult" });
    }
  } else if (classification === "UNKNOWN") {
    risks.push({ weight: 70, text: "Liquidity data is unavailable" });
  }

  // Volume
  if (token.volume24h !== undefined) {
    if (token.volume24h >= 1_000_000) {
      positives.push({ weight: 60, text: "Strong daily trading activity from real buyers and sellers" });
    } else if (token.volume24h >= 100_000) {
      positives.push({ weight: 40, text: "Steady daily trading activity" });
    } else if (token.volume24h < 1_000) {
      risks.push({ weight: 90, text: "Limited trading activity right now" });
    } else if (token.volume24h < 50_000) {
      risks.push({ weight: 60, text: "Trading activity is weak" });
    }
  } else {
    risks.push({ weight: 65, text: "24h volume data is unavailable" });
  }

  // Whale concentration
  if (riskBreakdown.whaleConcentration < 35) {
    risks.push({ weight: 80, text: "A few wallets likely control most of the supply" });
  } else if (riskBreakdown.whaleConcentration < 60) {
    risks.push({ weight: 45, text: "Holdings appear somewhat concentrated" });
  } else if (riskBreakdown.whaleConcentration >= 75) {
    positives.push({ weight: 35, text: "Holdings appear reasonably distributed" });
  }

  // Age
  if (token.ageDays !== undefined) {
    if (token.ageDays < 7) {
      risks.push({ weight: 75, text: "Token is brand new — very little track record" });
    } else if (token.ageDays < 30) {
      risks.push({ weight: 50, text: "Token is less than a month old" });
    } else if (token.ageDays > 365) {
      positives.push({ weight: 50, text: "Established token with over a year of history" });
    }
  }

  // Volatility
  const change = Math.abs(token.priceChange24h ?? 0);
  if (change > 100) {
    risks.push({ weight: 70, text: "Extreme 24h price swings — possible pump activity" });
  } else if (change > 40) {
    risks.push({ weight: 45, text: "Big 24h price swings" });
  } else if (change < 5 && classification !== "UNKNOWN") {
    positives.push({ weight: 25, text: "Stable short-term price action" });
  }

  // Fallbacks
  if (positives.length === 0 && verdict === "SAFE-ISH") {
    positives.push({ weight: 1, text: "Overall metrics look reasonable for this asset class" });
  }
  if (risks.length === 0 && verdict !== "SAFE-ISH") {
    risks.push({ weight: 1, text: "Mixed signals across liquidity, activity and volatility" });
  }

  return {
    positives: positives.sort((a, b) => b.weight - a.weight).slice(0, 4),
    risks: risks.sort((a, b) => b.weight - a.weight).slice(0, 4),
  };
}

const verdictColor: Record<Verdict, string> = {
  "SAFE-ISH": "text-success",
  "CAUTION": "text-warning",
  "AVOID": "text-destructive",
};

export const DecisionBreakdown = ({ result }: Props) => {
  const { positives, risks } = buildSignals(result);

  return (
    <Card className="border-border/60 bg-card/60 backdrop-blur">
      <CardHeader className="pb-3">
        <CardTitle className="text-base sm:text-lg flex items-center gap-2">
          <span aria-hidden>🧠</span>
          <span>Decision Breakdown</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        <p className="text-sm text-foreground/80 leading-relaxed">
          This token is rated{" "}
          <span className={`font-semibold ${verdictColor[result.verdict]}`}>{result.verdict}</span>{" "}
          based on the signals below.
        </p>

        {positives.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-2">
              <CheckCircle2 className="h-4 w-4 text-success" />
              <h4 className="text-sm font-semibold text-success">Positive Signals</h4>
            </div>
            <ul className="space-y-1.5">
              {positives.map((s, i) => (
                <li key={i} className="flex items-start gap-2.5 text-sm leading-snug text-foreground/90">
                  <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-success/80 flex-shrink-0" aria-hidden />
                  <span>{s.text}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {risks.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle className="h-4 w-4 text-warning" />
              <h4 className="text-sm font-semibold text-warning">Risk Signals</h4>
            </div>
            <ul className="space-y-1.5">
              {risks.map((s, i) => (
                <li key={i} className="flex items-start gap-2.5 text-sm leading-snug text-foreground/90">
                  <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-warning/80 flex-shrink-0" aria-hidden />
                  <span>{s.text}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

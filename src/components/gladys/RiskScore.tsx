import type { RiskBreakdown } from "@/lib/scan-types";

interface Props {
  score: number;
  breakdown: RiskBreakdown;
}

const scoreColor = (s: number) => {
  if (s >= 70) return { hsl: "142 71% 45%", label: "Low Risk", text: "text-success" };
  if (s >= 40) return { hsl: "38 92% 55%", label: "Moderate Risk", text: "text-warning" };
  return { hsl: "0 84% 60%", label: "High Risk", text: "text-destructive" };
};

const Bar = ({ label, value }: { label: string; value: number }) => {
  const c = scoreColor(value);
  return (
    <div className="space-y-1.5">
      <div className="flex justify-between text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className={`font-semibold ${c.text}`}>{value}/100</span>
      </div>
      <div className="h-2 bg-secondary rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{ width: `${value}%`, backgroundColor: `hsl(${c.hsl})` }}
        />
      </div>
    </div>
  );
};

export const RiskScore = ({ score, breakdown }: Props) => {
  const c = scoreColor(score);
  const circumference = 2 * Math.PI * 70;
  const dash = (score / 100) * circumference;

  return (
    <div className="bg-card border border-border rounded-2xl p-6 shadow-card-soft animate-fade-up">
      <div className="flex flex-col sm:flex-row gap-6 items-center">
        <div className="relative shrink-0">
          <svg width="170" height="170" viewBox="0 0 170 170" className="-rotate-90">
            <circle cx="85" cy="85" r="70" stroke="hsl(var(--secondary))" strokeWidth="12" fill="none" />
            <circle
              cx="85"
              cy="85"
              r="70"
              stroke={`hsl(${c.hsl})`}
              strokeWidth="12"
              fill="none"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={circumference - dash}
              style={{ transition: "stroke-dashoffset 1s ease-out" }}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className={`text-5xl font-display font-bold ${c.text}`}>{score}</span>
            <span className="text-xs text-muted-foreground mt-1">/ 100</span>
          </div>
        </div>
        <div className="flex-1 w-full space-y-3">
          <div>
            <p className="text-xs uppercase tracking-wider text-muted-foreground">Safety Score</p>
            <p className={`text-lg font-semibold ${c.text}`}>{c.label}</p>
          </div>
          <Bar label="Liquidity" value={breakdown.liquidity} />
          <Bar label="Whale Concentration" value={breakdown.whaleConcentration} />
          <Bar label="Contract Risk" value={breakdown.contractRisk} />
          <Bar label="Volatility" value={breakdown.volatility} />
        </div>
      </div>
    </div>
  );
};

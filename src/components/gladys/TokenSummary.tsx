import type { ScanResult } from "@/lib/scan-types";
import { Badge } from "@/components/ui/badge";

const fmtNum = (n?: number) => {
  if (n === undefined || n === null) return "—";
  if (n >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(2)}M`;
  if (n >= 1e3) return `$${(n / 1e3).toFixed(2)}K`;
  if (n < 0.01 && n > 0) return `$${n.toExponential(2)}`;
  return `$${n.toFixed(2)}`;
};

export const TokenSummary = ({ result }: { result: ScanResult }) => {
  const { token, explainer } = result;
  return (
    <div className="bg-card border border-border rounded-2xl p-6 shadow-card-soft animate-fade-up">
      <div className="flex items-start justify-between gap-4 mb-4 flex-wrap">
        <div>
          <div className="flex items-center gap-3 flex-wrap">
            <h2 className="text-2xl sm:text-3xl font-display font-bold">{token.name}</h2>
            <span className="text-lg text-muted-foreground font-mono">{token.symbol}</span>
          </div>
          <Badge variant="outline" className="mt-2 border-gold/40 text-gold bg-gold/5">
            {token.chain}
          </Badge>
        </div>
        <div className="text-right">
          <p className="text-xs text-muted-foreground">Price</p>
          <p className="text-xl font-semibold">{fmtNum(token.priceUsd)}</p>
        </div>
      </div>

      <p className="text-foreground/90 leading-relaxed">{explainer.summary}</p>

      <div className="grid grid-cols-3 gap-3 mt-5 pt-5 border-t border-border">
        <Stat label="Market Cap" value={fmtNum(token.marketCap)} />
        <Stat label="24h Volume" value={fmtNum(token.volume24h)} />
        <Stat label="Liquidity" value={fmtNum(token.liquidityUsd)} />
      </div>
    </div>
  );
};

const Stat = ({ label, value }: { label: string; value: string }) => (
  <div>
    <p className="text-xs text-muted-foreground">{label}</p>
    <p className="text-sm font-semibold mt-0.5">{value}</p>
  </div>
);

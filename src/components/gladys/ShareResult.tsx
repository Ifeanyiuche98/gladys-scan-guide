import { useState } from "react";
import { Share2, Copy, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import type { ScanResult, Verdict } from "@/lib/scan-types";

const verdictEmoji: Record<Verdict, string> = {
  "SAFE-ISH": "✅",
  "CAUTION": "⚠️",
  "AVOID": "🚨",
};

function buildKeyInsights(result: ScanResult): string[] {
  const { token, riskBreakdown, verdict } = result;
  const insights: { weight: number; text: string }[] = [];

  const isMajorAsset =
    (token.marketCap ?? 0) >= 1_000_000_000 && (token.volume24h ?? 0) >= 10_000_000;

  if (token.liquidityUsd !== undefined) {
    if (token.liquidityUsd < 25_000) insights.push({ weight: 95, text: "Extremely low liquidity" });
    else if (token.liquidityUsd < 100_000) insights.push({ weight: 75, text: "Low liquidity" });
    else if (token.liquidityUsd < 500_000) insights.push({ weight: 40, text: "Thin liquidity" });
    else if (verdict === "SAFE-ISH") insights.push({ weight: 30, text: "Healthy liquidity" });
  } else if (isMajorAsset) {
    insights.push({ weight: 35, text: "Deep global exchange liquidity" });
  }

  if (!token.volume24h || token.volume24h < 1_000) insights.push({ weight: 90, text: "No active trading" });
  else if (token.volume24h < 50_000) insights.push({ weight: 65, text: "Weak trading activity" });
  else if (verdict === "SAFE-ISH" && token.volume24h > 250_000)
    insights.push({ weight: 30, text: "Steady trading activity" });

  if (riskBreakdown.whaleConcentration < 35)
    insights.push({ weight: 80, text: "High whale concentration" });
  else if (riskBreakdown.whaleConcentration < 60)
    insights.push({ weight: 50, text: "Somewhat concentrated holdings" });

  if (token.ageDays !== undefined) {
    if (token.ageDays < 7) insights.push({ weight: 70, text: "Brand new token" });
    else if (token.ageDays < 30) insights.push({ weight: 45, text: "Less than a month old" });
    else if (token.ageDays > 365 && verdict === "SAFE-ISH")
      insights.push({ weight: 25, text: "Established track record" });
  }

  const change = Math.abs(token.priceChange24h ?? 0);
  if (change > 100) insights.push({ weight: 70, text: "Extreme 24h price swings" });
  else if (change > 40) insights.push({ weight: 45, text: "Big 24h price swings" });

  if (insights.length === 0) {
    insights.push({
      weight: 1,
      text: verdict === "SAFE-ISH" ? "No major risks detected" : "Mixed risk signals",
    });
  }

  return insights
    .sort((a, b) => b.weight - a.weight)
    .slice(0, 3)
    .map((i) => i.text);
}

function buildShareText(result: ScanResult): string {
  const { token, verdict, riskScore } = result;
  const name = token.symbol ? `${token.name} ($${token.symbol})` : token.name;
  const insights = buildKeyInsights(result);
  const appLink = typeof window !== "undefined" ? window.location.origin : "https://gladys-scan-guide.lovable.app";

  return [
    `Just scanned ${name} on GLADYS Scan 🐺`,
    ``,
    `Verdict: ${verdictEmoji[verdict]} ${verdict}`,
    `Risk Score: ${riskScore}/100`,
    ``,
    `Key insights:`,
    ...insights.map((i) => `- ${i}`),
    ``,
    `Scan before you ape:`,
    appLink,
  ].join("\n");
}

interface Props {
  result: ScanResult;
  variant?: "full" | "icon";
}

export const ShareResult = ({ result, variant = "full" }: Props) => {
  const [copied, setCopied] = useState(false);

  const handleShare = async () => {
    const text = buildShareText(result);
    const title = `GLADYS Scan: ${result.token.name}`;

    // Try native share first (mobile-friendly)
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({ title, text });
        return;
      } catch (err) {
        // User cancelled or share failed — fall through to clipboard
        if ((err as Error)?.name === "AbortError") return;
      }
    }

    // Clipboard fallback
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      toast({
        title: "Copied to clipboard",
        description: "Share the result anywhere you like.",
      });
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast({
        title: "Couldn't share",
        description: "Try selecting and copying the result manually.",
        variant: "destructive",
      });
    }
  };

  if (variant === "icon") {
    return (
      <button
        onClick={handleShare}
        aria-label="Share scan result"
        className="inline-flex items-center justify-center h-9 w-9 rounded-full bg-gold/10 ring-1 ring-gold/30 text-gold hover:bg-gold/20 transition-colors"
      >
        <Share2 className="h-4 w-4" />
      </button>
    );
  }

  return (
    <Button
      onClick={handleShare}
      size="lg"
      className="bg-gradient-to-r from-gold to-gold/80 text-background hover:opacity-90 rounded-xl px-6 font-semibold shadow-card-soft"
    >
      {copied ? <Check className="h-4 w-4" /> : <Share2 className="h-4 w-4" />}
      {copied ? "Copied!" : "Share Result"}
    </Button>
  );
};

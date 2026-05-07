import { useRef, useState } from "react";
import { Share2, Check, Image as ImageIcon } from "lucide-react";
import { toPng } from "html-to-image";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import { ShareCard } from "./ShareCard";
import type { ScanResult, Verdict } from "@/lib/scan-types";

const verdictEmoji: Record<Verdict, string> = {
  "SAFE-ISH": "✅",
  "CAUTION": "⚠️",
  "AVOID": "🚨",
};

function buildKeyRisks(result: ScanResult): string[] {
  const { token, riskBreakdown, classification, verdict } = result;
  const risks: { weight: number; text: string }[] = [];

  if (classification === "MAJOR") {
    // For majors, surface positives framed as reassurance instead of risks.
    return ["Widely adopted asset", "Deep global liquidity", "High trading activity"];
  }

  if (token.liquidityUsd !== undefined) {
    if (token.liquidityUsd < 25_000) risks.push({ weight: 95, text: "Extremely low liquidity (very hard to exit)" });
    else if (token.liquidityUsd < 100_000) risks.push({ weight: 75, text: "Low liquidity (hard to exit)" });
    else if (token.liquidityUsd < 500_000) risks.push({ weight: 40, text: "Thin liquidity (slippage on bigger trades)" });
  }

  if (token.volume24h !== undefined) {
    if (token.volume24h < 1_000) risks.push({ weight: 92, text: "Almost no trading activity" });
    else if (token.volume24h < 50_000) risks.push({ weight: 65, text: "Very low trading activity" });
  }

  if (riskBreakdown.whaleConcentration < 35) risks.push({ weight: 80, text: "Heavy whale concentration (few wallets control supply)" });
  else if (riskBreakdown.whaleConcentration < 60) risks.push({ weight: 50, text: "Some whale concentration" });

  if (token.ageDays !== undefined) {
    if (token.ageDays < 7) risks.push({ weight: 78, text: "Brand new token (no track record)" });
    else if (token.ageDays < 30) risks.push({ weight: 45, text: "Less than a month old" });
  }

  const change = Math.abs(token.priceChange24h ?? 0);
  if (change > 100) risks.push({ weight: 70, text: "Extreme 24h price swings" });
  else if (change > 40) risks.push({ weight: 45, text: "Big 24h price swings" });

  if (risks.length === 0) {
    risks.push({
      weight: 1,
      text: verdict === "SAFE-ISH" ? "No major risks detected" : "Mixed risk signals",
    });
  }

  return risks
    .sort((a, b) => b.weight - a.weight)
    .slice(0, 3)
    .map((r) => r.text);
}

function buildInterpretation(result: ScanResult): string {
  const { token, riskBreakdown, classification, verdict } = result;

  if (classification === "MAJOR") {
    return "👉 This is a major asset — standard market risk still applies.";
  }

  const lowVol = token.volume24h !== undefined && token.volume24h < 50_000;
  const lowLiq = token.liquidityUsd !== undefined && token.liquidityUsd < 100_000;
  const whales = riskBreakdown.whaleConcentration < 50;
  const young = token.ageDays !== undefined && token.ageDays < 30;

  if (lowVol && lowLiq) return "👉 This isn't very active — entering is easy, exiting may be difficult.";
  if (lowLiq) return "👉 Liquidity is thin — getting out at a fair price could be tough.";
  if (lowVol) return "👉 Trading is quiet — fewer real buyers if you want to sell.";
  if (whales) return "👉 A few wallets hold a lot — they can move the price quickly.";
  if (young) return "👉 Very new token — there's no real history to judge it on yet.";
  if (verdict === "AVOID") return "👉 Multiple risk signals — worth a closer look before buying.";
  if (verdict === "CAUTION") return "👉 Mixed signals — proceed carefully and size small.";
  return "👉 Looks reasonable on the basics, but always do your own research.";
}

function buildShareText(result: ScanResult): string {
  const { token, verdict, riskScore } = result;
  const sym = token.symbol && token.symbol !== "?" ? token.symbol : token.name;
  const risks = buildKeyRisks(result);
  const appLink = typeof window !== "undefined" ? window.location.origin : "https://gladys-scan-guide.lovable.app";

  return [
    `⚠️ Thinking of buying ${token.name} ($${sym})?`,
    `GLADYS scan result 👇`,
    ``,
    `Verdict: ${verdictEmoji[verdict]} ${verdict}`,
    `Score: ${riskScore}/100`,
    ``,
    `Key risks:`,
    ...risks.map((r) => `- ${r}`),
    ``,
    buildInterpretation(result),
    ``,
    `Would your token pass this test? Scan it (takes 5s):`,
    appLink,
  ].join("\n");
}

interface Props {
  result: ScanResult;
  variant?: "full" | "icon";
}

export const ShareResult = ({ result, variant = "full" }: Props) => {
  const [copied, setCopied] = useState(false);
  const [generating, setGenerating] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  const handleShare = async () => {
    const text = buildShareText(result);
    const title = `GLADYS Scan: ${result.token.name}`;

    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({ title, text });
        return;
      } catch (err) {
        if ((err as Error)?.name === "AbortError") return;
      }
    }

    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      toast({ title: "Copied to clipboard", description: "Share the result anywhere you like." });
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast({ title: "Couldn't share", description: "Try selecting and copying the result manually.", variant: "destructive" });
    }
  };

  const handleShareCard = async () => {
    if (!cardRef.current) return;
    setGenerating(true);
    try {
      const dataUrl = await toPng(cardRef.current, {
        cacheBust: true,
        pixelRatio: 2,
        backgroundColor: "#0a0c10",
      });
      const blob = await (await fetch(dataUrl)).blob();
      const file = new File([blob], `gladys-${result.token.symbol || result.token.name}.png`, { type: "image/png" });

      // Try native share with file
      if (
        typeof navigator !== "undefined" &&
        navigator.canShare &&
        navigator.canShare({ files: [file] }) &&
        navigator.share
      ) {
        try {
          await navigator.share({
            files: [file],
            title: `GLADYS Scan: ${result.token.name}`,
            text: `${verdictEmoji[result.verdict]} ${result.verdict} — ${result.riskScore}/100`,
          });
          return;
        } catch (err) {
          if ((err as Error)?.name === "AbortError") return;
        }
      }

      // Fallback: download
      const link = document.createElement("a");
      link.href = dataUrl;
      link.download = file.name;
      link.click();
      toast({ title: "Card downloaded", description: "Share the image anywhere you like." });
    } catch {
      toast({ title: "Couldn't generate card", description: "Please try again.", variant: "destructive" });
    } finally {
      setGenerating(false);
    }
  };

  // Off-screen card for rendering
  const offscreenCard = (
    <div style={{ position: "fixed", left: -10000, top: 0, pointerEvents: "none" }} aria-hidden>
      <ShareCard ref={cardRef} result={result} />
    </div>
  );

  if (variant === "icon") {
    return (
      <>
        {offscreenCard}
        <button
          onClick={handleShare}
          aria-label="Share scan result"
          className="inline-flex items-center justify-center h-9 w-9 rounded-full bg-gold/10 ring-1 ring-gold/30 text-gold hover:bg-gold/20 transition-colors"
        >
          <Share2 className="h-4 w-4" />
        </button>
      </>
    );
  }

  return (
    <>
      {offscreenCard}
      <Button
        onClick={handleShare}
        size="lg"
        className="bg-gradient-to-r from-gold to-gold/80 text-background hover:opacity-90 rounded-xl px-6 font-semibold shadow-card-soft"
      >
        {copied ? <Check className="h-4 w-4" /> : <Share2 className="h-4 w-4" />}
        {copied ? "Copied!" : "Share Text"}
      </Button>
      <Button
        onClick={handleShareCard}
        size="lg"
        variant="outline"
        disabled={generating}
        className="border-gold/40 text-gold hover:bg-gold/10 hover:text-gold rounded-xl px-6 font-semibold"
      >
        <ImageIcon className="h-4 w-4" />
        {generating ? "Generating..." : "Share Card"}
      </Button>
    </>
  );
};

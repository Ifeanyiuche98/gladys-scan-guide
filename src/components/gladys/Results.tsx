import type { ScanResult } from "@/lib/scan-types";
import { TokenSummary } from "./TokenSummary";
import { RiskScore } from "./RiskScore";
import { OpportunitySignal } from "./OpportunitySignal";
import { RedFlags } from "./RedFlags";
import { BeginnerMode } from "./BeginnerMode";
import { VerdictBanner } from "./Verdict";
import { DecisionBreakdown } from "./DecisionBreakdown";
import { ShareResult } from "./ShareResult";
import { Button } from "@/components/ui/button";
import { RotateCw } from "lucide-react";

interface Props {
  result: ScanResult;
  onScanAnother: () => void;
}

export const Results = ({ result, onScanAnother }: Props) => (
  <div className="space-y-5">
    {/* Network safety warning — shown when chain couldn't be confidently identified */}
    {result.networkWarning && (
      <div className="bg-amber-500/10 border border-amber-500/40 rounded-2xl p-4 text-sm text-amber-200 animate-fade-up">
        <p className="font-semibold mb-1">⚠ Network not confidently identified</p>
        <p className="text-amber-100/80">{result.networkWarning}</p>
      </div>
    )}

    {/* 1. Asset name + basic info */}
    <TokenSummary result={result} />
    {/* 2. Risk Score */}
    <RiskScore score={result.riskScore} breakdown={result.riskBreakdown} />

    {/* 3. Final Verdict (with Confidence + Outlook) */}
    <div className="relative">
      <VerdictBanner
        verdict={result.verdict}
        reason={result.verdictReason}
        confidence={result.confidence}
        outlook={result.outlook}
      />
      <div className="absolute top-4 right-4">
        <ShareResult result={result} variant="icon" />
      </div>
    </div>

    {/* 4. Decision Breakdown */}
    <DecisionBreakdown result={result} />

    {/* 5. Red Flags (conditional content for MAJOR vs others handled inside) */}
    <RedFlags result={result} />

    {(() => {
      const explainerText = `${result.explainer?.summary ?? ""} ${result.explainer?.whyPeopleBuy ?? ""} ${result.explainer?.whatItDoes ?? ""}`.toLowerCase();
      const speculativeKeywords = /\b(meme|hype|speculat|no clear utility|no real utility|no use case|trading interest|community token|fan token|driven (mainly )?by (trading|speculation|hype))\b/;
      const structuralRisk =
        result.opportunity.tag === "Overhyped" ||
        (result.classification !== "MAJOR" && speculativeKeywords.test(explainerText));
      const reason =
        structuralRisk && /active trading.*reasonable fundamentals/i.test(result.opportunity.reason)
          ? "Active trading, but driven largely by market sentiment rather than strong fundamentals."
          : result.opportunity.reason;
      return <OpportunitySignal tag={result.opportunity.tag} reason={reason} />;
    })()}
    <BeginnerMode explainer={result.explainer} />

    <div className="pt-2 pb-4 flex flex-col gap-3 justify-center items-center">
      <p className="text-sm text-muted-foreground text-center max-w-md">
        Someone thinking of buying this? Share this result with them before they invest.
      </p>
      <div className="flex flex-col sm:flex-row gap-3 justify-center items-center">
      <ShareResult result={result} />
      <Button
        onClick={onScanAnother}
        size="lg"
        variant="outline"
        className="border-gold/40 text-gold hover:bg-gold/10 hover:text-gold rounded-xl px-6"
      >
        <RotateCw className="h-4 w-4" />
        Scan Another Token
      </Button>
    </div>
  </div>
);

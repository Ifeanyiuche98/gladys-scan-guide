import type { ScanResult } from "@/lib/scan-types";
import { TokenSummary } from "./TokenSummary";
import { RiskScore } from "./RiskScore";
import { OpportunitySignal } from "./OpportunitySignal";
import { RedFlags } from "./RedFlags";
import { BeginnerMode } from "./BeginnerMode";
import { VerdictBanner } from "./Verdict";
import { Button } from "@/components/ui/button";
import { RotateCw } from "lucide-react";

interface Props {
  result: ScanResult;
  onScanAnother: () => void;
}

export const Results = ({ result, onScanAnother }: Props) => (
  <div className="space-y-5">
    <VerdictBanner verdict={result.verdict} reason={result.verdictReason} />
    <TokenSummary result={result} />
    <RiskScore score={result.riskScore} breakdown={result.riskBreakdown} />
    <RedFlags result={result} />
    <OpportunitySignal tag={result.opportunity.tag} reason={result.opportunity.reason} />
    <BeginnerMode explainer={result.explainer} />

    <div className="pt-2 pb-4 flex justify-center">
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

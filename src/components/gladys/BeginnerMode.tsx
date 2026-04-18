import type { ScanResult } from "@/lib/scan-types";
import { GraduationCap } from "lucide-react";

export const BeginnerMode = ({ explainer }: { explainer: ScanResult["explainer"] }) => (
  <div className="bg-card border border-border rounded-2xl p-6 shadow-card-soft animate-fade-up">
    <div className="flex items-center gap-2.5 mb-5">
      <div className="bg-gold/10 ring-1 ring-gold/30 rounded-lg p-2">
        <GraduationCap className="h-5 w-5 text-gold" />
      </div>
      <h3 className="text-lg font-display font-bold">Explain Like I'm New</h3>
    </div>
    <div className="space-y-4">
      <Block title="What this token does" body={explainer.whatItDoes} />
      <Block title="Why people are buying it" body={explainer.whyPeopleBuy} />
      <Block title="What could go wrong" body={explainer.whatCouldGoWrong} />
    </div>
  </div>
);

const Block = ({ title, body }: { title: string; body: string }) => (
  <div>
    <p className="text-xs font-semibold uppercase tracking-wider text-gold/80 mb-1.5">{title}</p>
    <p className="text-sm text-foreground/90 leading-relaxed">{body}</p>
  </div>
);

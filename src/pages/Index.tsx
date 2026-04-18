import { useState } from "react";
import { Logo } from "@/components/gladys/Logo";
import { ScanInput } from "@/components/gladys/ScanInput";
import { Loader } from "@/components/gladys/Loader";
import { Results } from "@/components/gladys/Results";
import { UpgradeModal } from "@/components/gladys/UpgradeModal";
import { canScan, recordScan, getRemainingScans } from "@/lib/scan-limit";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import type { ScanResult } from "@/lib/scan-types";
import { ShieldCheck, Zap, BookOpen } from "lucide-react";

const Index = () => {
  const [status, setStatus] = useState<"idle" | "loading" | "result">("idle");
  const [result, setResult] = useState<ScanResult | null>(null);
  const [showUpgrade, setShowUpgrade] = useState(false);
  const [remaining, setRemaining] = useState(getRemainingScans());

  const handleScan = async (input: string) => {
    if (!canScan()) {
      setShowUpgrade(true);
      return;
    }

    setStatus("loading");
    setResult(null);

    try {
      const { data, error } = await supabase.functions.invoke("scan-token", {
        body: { input },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      recordScan();
      const serverRemaining = (data as { remainingScans?: number })?.remainingScans;
      setRemaining(typeof serverRemaining === "number" ? serverRemaining : getRemainingScans());
      setResult(data as ScanResult);
      setStatus("result");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Something went wrong";
      toast({
        title: "Scan failed",
        description: msg,
        variant: "destructive",
      });
      setStatus("idle");
    }
  };

  const reset = () => {
    setStatus("idle");
    setResult(null);
  };

  return (
    <div className="min-h-screen flex flex-col">
      <header className="container max-w-3xl pt-6 pb-4 flex items-center justify-between">
        <Logo />
        <div className="text-xs text-muted-foreground">
          <span className="text-gold font-semibold">{remaining}</span> / 3 scans today
        </div>
      </header>

      <main className="container max-w-3xl flex-1 pb-12">
        {status === "idle" && (
          <section className="pt-8 sm:pt-16 animate-fade-up">
            <div className="text-center mb-10 sm:mb-14">
              <h1 className="font-display font-bold text-4xl sm:text-6xl tracking-tight leading-[1.05]">
                Scan Before
                <br />
                You <span className="text-gradient-gold">Ape.</span>
              </h1>
              <p className="text-muted-foreground mt-5 max-w-md mx-auto text-base sm:text-lg">
                Instant safety + opportunity check on any crypto token — in plain English.
              </p>
            </div>

            <ScanInput onScan={handleScan} />

            <div className="grid sm:grid-cols-3 gap-4 mt-12">
              <Feature icon={ShieldCheck} title="Risk Score" body="Liquidity, whales, volatility — scored /100." />
              <Feature icon={Zap} title="Opportunity Signal" body="Spot early gems vs. overhyped traps." />
              <Feature icon={BookOpen} title="Beginner Mode" body="No jargon. Just a clear verdict." />
            </div>
          </section>
        )}

        {status === "loading" && <Loader />}

        {status === "result" && result && <Results result={result} onScanAnother={reset} />}
      </main>

      <footer className="container max-w-3xl py-6 text-center text-xs text-muted-foreground border-t border-border/50">
        GLADYS Scan • Not financial advice. Always do your own research.
      </footer>

      <UpgradeModal open={showUpgrade} onOpenChange={setShowUpgrade} />
    </div>
  );
};

const Feature = ({ icon: Icon, title, body }: { icon: typeof ShieldCheck; title: string; body: string }) => (
  <div className="bg-card/50 border border-border rounded-xl p-4">
    <div className="bg-gold/10 ring-1 ring-gold/30 rounded-lg p-2 w-fit mb-3">
      <Icon className="h-4 w-4 text-gold" />
    </div>
    <p className="font-semibold text-sm">{title}</p>
    <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{body}</p>
  </div>
);

export default Index;

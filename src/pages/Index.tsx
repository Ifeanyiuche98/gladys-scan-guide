import { useState } from "react";
import { Logo } from "@/components/gladys/Logo";
import { ScanInput } from "@/components/gladys/ScanInput";
import { Loader } from "@/components/gladys/Loader";
import { Results } from "@/components/gladys/Results";
import { Suggestions } from "@/components/gladys/Suggestions";
import { UpgradeModal } from "@/components/gladys/UpgradeModal";
import {
  canScan,
  recordScan,
  getRemainingScans,
  syncRemaining,
  markLimitReached,
  setLimitResetTime,
  SCAN_LIMIT,
} from "@/lib/scan-limit";
import { getClientId } from "@/lib/client-id";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import type { ScanResult, TokenSuggestion } from "@/lib/scan-types";
import { ShieldCheck, Zap, BookOpen } from "lucide-react";

const Index = () => {
  const [status, setStatus] = useState<"idle" | "loading" | "result">("idle");
  const [result, setResult] = useState<ScanResult | null>(null);
  const [showUpgrade, setShowUpgrade] = useState(false);
  const [remaining, setRemaining] = useState(getRemainingScans());
  const [suggestions, setSuggestions] = useState<{ message: string; items: TokenSuggestion[] } | null>(null);

  const handleScan = async (input: string, opts?: { coingeckoId?: string }) => {
    if (!canScan()) {
      setShowUpgrade(true);
      return;
    }

    setStatus("loading");
    setResult(null);
    setSuggestions(null);

    const clientId = getClientId();

    try {
      const { data, error } = await supabase.functions.invoke("scan-token", {
        body: { input, ...(opts?.coingeckoId ? { coingeckoId: opts.coingeckoId } : {}) },
        headers: { "x-gladys-client-id": clientId },
      });

      // Non-2xx response: supabase-js wraps it in FunctionsHttpError. Parse
      // the JSON body to surface our structured error.
      if (error) {
        let payload:
          | {
              error?: string;
              rateLimited?: boolean;
              burst?: boolean;
              contractUnresolved?: boolean;
              tokenUnresolved?: boolean;
              limitResetTime?: string;
            }
          | null = null;
        let httpStatus: number | undefined;
        const ctx = (error as { context?: { response?: Response } }).context;
        if (ctx?.response) {
          httpStatus = ctx.response.status;
          try {
            payload = await ctx.response.clone().json();
          } catch {
            payload = null;
          }
        }

        if (payload?.rateLimited) {
          if (payload.burst) {
            setStatus("idle");
            toast({
              title: "Slow down",
              description: payload.error ?? "Too many scans in a row. Try again in a few seconds.",
            });
          } else {
            // 429 daily limit → modal only, no error toast
            markLimitReached();
            setLimitResetTime(payload.limitResetTime);
            setRemaining(0);
            setStatus("idle");
            setShowUpgrade(true);
          }
          return;
        }

        if (payload?.contractUnresolved) {
          setStatus("idle");
          toast({
            title: "Contract not recognized",
            description: payload.error ?? "We couldn't verify this contract on supported networks.",
            variant: "destructive",
          });
          return;
        }

        if ((payload as { tokenUnresolved?: boolean } | null)?.tokenUnresolved) {
          setStatus("idle");
          toast({
            title: "Couldn't identify token",
            description: payload?.error ?? "Token not found. Please check the spelling.",
            variant: "destructive",
          });
          return;
        }

        // 500 / unknown server failure
        if (httpStatus === 500 || httpStatus === undefined) {
          setStatus("idle");
          toast({
            title: "Scan failed",
            description: "Something went wrong while analyzing this token. Please try again.",
            variant: "destructive",
          });
          return;
        }

        // Other non-2xx — surface clean message, never raw infra error.
        setStatus("idle");
        toast({
          title: "Scan failed",
          description: payload?.error ?? "Something went wrong while analyzing this token. Please try again.",
          variant: "destructive",
        });
        return;
      }

      if (data?.error) throw new Error(data.error);

      const serverRemaining = (data as { remainingScans?: number })?.remainingScans;
      const serverReset = (data as { limitResetTime?: string })?.limitResetTime;
      if (typeof serverRemaining === "number") {
        syncRemaining(serverRemaining);
        setRemaining(serverRemaining);
      } else {
        recordScan();
        setRemaining(getRemainingScans());
      }
      if (serverReset) setLimitResetTime(serverReset);
      setResult(data as ScanResult);
      setStatus("result");
    } catch (e) {
      // Network failure (no response received) or unexpected throw.
      // Never expose raw "Edge Function returned non-2xx status code" or stack traces.
      const isNetwork =
        typeof navigator !== "undefined" && navigator.onLine === false ||
        (e instanceof TypeError && /fetch|network/i.test(e.message));
      toast({
        title: isNetwork ? "Network issue" : "Scan failed",
        description: isNetwork
          ? "Network issue detected. Please check your connection and try again."
          : "Something went wrong while analyzing this token. Please try again.",
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
        <Logo variant="icon" size="sm" className="sm:hidden" />
        <Logo variant="full" size="sm" className="hidden sm:block" />
        <div className="text-xs text-muted-foreground">
          <span className="text-gold font-semibold">{remaining}</span> / {SCAN_LIMIT} scans today
        </div>
      </header>

      <main className="container max-w-3xl flex-1 pb-12">
        {status === "idle" && (
          <section className="pt-8 sm:pt-16 animate-fade-up">
            <div className="text-center mb-10 sm:mb-14">
              <div className="flex justify-center mb-8">
                <Logo variant="full" size="lg" />
              </div>
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

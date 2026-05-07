import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Search, Sparkles } from "lucide-react";

interface Props {
  onScan: (input: string) => void;
  disabled?: boolean;
}

export const ScanInput = ({ onScan, disabled }: Props) => {
  const [value, setValue] = useState("");

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const v = value.trim();
    if (v) onScan(v);
  };

  return (
    <form onSubmit={submit} className="w-full">
      <div className="relative group">
        <div className="absolute -inset-px bg-gradient-gold rounded-2xl opacity-40 group-focus-within:opacity-80 blur transition-opacity" />
        <div className="relative bg-card border border-border rounded-2xl p-2 sm:p-2.5 flex flex-col sm:flex-row gap-2 shadow-card-soft">
          <div className="flex items-center gap-3 flex-1 px-3 sm:px-4">
            <Search className="h-5 w-5 text-muted-foreground shrink-0" />
            <input
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder="Paste token name or contract address…"
              className="flex-1 bg-transparent outline-none py-3 text-base placeholder:text-muted-foreground/70"
              autoComplete="off"
              spellCheck={false}
            />
          </div>
          <Button
            type="submit"
            disabled={disabled || !value.trim()}
            size="lg"
            className="bg-gradient-gold text-primary-foreground hover:opacity-90 font-semibold shadow-gold h-12 px-6 rounded-xl"
          >
            <Sparkles className="h-4 w-4" />
            Scan Token
          </Button>
        </div>
      </div>
      <p className="text-xs text-muted-foreground text-center mt-3">
        Get a quick risk breakdown before making a decision.
      </p>
      <div className="flex flex-wrap justify-center items-center gap-x-4 gap-y-1.5 mt-3 text-[11px] sm:text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1"><span className="text-gold">✓</span> Contract-aware</span>
        <span className="inline-flex items-center gap-1"><span className="text-gold">✓</span> Beginner-friendly</span>
        <span className="inline-flex items-center gap-1"><span className="text-gold">✓</span> No wallet connection required</span>
      </div>
    </form>
  );
};

import type { TokenSuggestion } from "@/lib/scan-types";
import { Button } from "@/components/ui/button";
import { Search } from "lucide-react";

interface Props {
  message: string;
  suggestions: TokenSuggestion[];
  onPick: (s: TokenSuggestion) => void;
  onDismiss: () => void;
}

export const Suggestions = ({ message, suggestions, onPick, onDismiss }: Props) => {
  return (
    <div className="bg-card border border-gold/30 rounded-2xl p-5 shadow-card-soft animate-fade-up mt-6">
      <div className="flex items-start gap-3 mb-4">
        <div className="bg-gold/10 ring-1 ring-gold/30 rounded-lg p-2">
          <Search className="h-4 w-4 text-gold" />
        </div>
        <div>
          <p className="font-semibold text-sm">Did you mean…</p>
          <p className="text-xs text-muted-foreground mt-0.5">{message}</p>
        </div>
      </div>

      <ul className="space-y-2">
        {suggestions.map((s) => (
          <li key={s.id}>
            <button
              onClick={() => onPick(s)}
              className="w-full text-left px-4 py-3 rounded-xl border border-border hover:border-gold/50 hover:bg-gold/5 transition-colors flex items-center justify-between"
            >
              <span className="font-medium text-sm">{s.name}</span>
              <span className="text-xs text-muted-foreground font-mono">{s.symbol}</span>
            </button>
          </li>
        ))}
      </ul>

      <Button variant="ghost" size="sm" onClick={onDismiss} className="mt-3 w-full text-xs">
        None of these — I'll refine my search
      </Button>
    </div>
  );
};

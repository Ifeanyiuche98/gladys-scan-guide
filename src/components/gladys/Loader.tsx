import { useEffect, useState } from "react";
import { Logo } from "./Logo";

const STEPS = [
  "Analyzing contract…",
  "Checking liquidity…",
  "Scanning risk signals…",
  "Asking the AI for a verdict…",
];

export const Loader = () => {
  const [i, setI] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setI((v) => (v + 1) % STEPS.length), 1400);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="flex flex-col items-center justify-center py-20 gap-8 animate-fade-up">
      <div className="relative">
        <div className="absolute inset-0 rounded-full bg-gradient-gold blur-3xl opacity-40 animate-pulse-gold" />
        <div className="relative h-28 w-28 rounded-full border border-gold/20 flex items-center justify-center">
          <div className="absolute inset-0 rounded-full border-t-2 border-gold animate-spin" />
          <Logo variant="mark" size="md" className="animate-pulse-gold" />
        </div>
      </div>
      <p className="font-display text-lg text-foreground/90 text-center px-6">
        GLADYS is analyzing this token<span className="text-gold">…</span>
      </p>
      <div className="h-6 text-center relative w-full">
        {STEPS.map((s, idx) => (
          <p
            key={s}
            className={`text-sm font-medium transition-all duration-500 absolute inset-x-0 ${
              idx === i ? "text-gold opacity-100 translate-y-0" : "opacity-0 translate-y-2"
            }`}
          >
            {s}
          </p>
        ))}
      </div>
    </div>
  );
};

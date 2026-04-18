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
        <div className="absolute inset-0 rounded-full bg-gradient-gold blur-2xl opacity-30 animate-pulse-gold" />
        <div className="relative h-20 w-20 rounded-full border-2 border-gold/30 flex items-center justify-center">
          <div className="h-16 w-16 rounded-full border-t-2 border-gold animate-spin" />
        </div>
      </div>
      <div className="text-center space-y-2">
        <Logo size="sm" />
      </div>
      <div className="h-6 text-center">
        {STEPS.map((s, idx) => (
          <p
            key={s}
            className={`text-sm font-medium transition-all duration-500 ${
              idx === i ? "text-gold opacity-100" : "opacity-0 absolute"
            }`}
            style={idx === i ? {} : { transform: "translateY(8px)" }}
          >
            {s}
          </p>
        ))}
      </div>
    </div>
  );
};

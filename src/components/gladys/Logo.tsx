import { ShieldCheck } from "lucide-react";

export const Logo = ({ size = "md" }: { size?: "sm" | "md" | "lg" }) => {
  const text = size === "lg" ? "text-3xl" : size === "sm" ? "text-lg" : "text-xl";
  const icon = size === "lg" ? "h-8 w-8" : size === "sm" ? "h-5 w-5" : "h-6 w-6";
  return (
    <div className="flex items-center gap-2.5">
      <div className="relative">
        <div className="absolute inset-0 bg-gradient-gold blur-md opacity-50" />
        <div className="relative bg-gradient-gold rounded-lg p-1.5">
          <ShieldCheck className={`${icon} text-primary-foreground`} strokeWidth={2.5} />
        </div>
      </div>
      <div className="font-display font-bold tracking-tight leading-none">
        <span className={`${text} text-foreground`}>GLADYS</span>
        <span className={`${text} text-gradient-gold ml-1.5`}>Scan</span>
      </div>
    </div>
  );
};

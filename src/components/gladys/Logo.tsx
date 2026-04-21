import fullLogo from "@/assets/gladys-logo-full.png";
import iconLogo from "@/assets/gladys-icon.png";
import markLogo from "@/assets/gladys-mark.png";

type LogoVariant = "full" | "icon" | "mark";
type LogoSize = "sm" | "md" | "lg";

interface LogoProps {
  variant?: LogoVariant;
  size?: LogoSize;
  className?: string;
}

const SIZE_MAP: Record<LogoVariant, Record<LogoSize, string>> = {
  full: { sm: "h-8", md: "h-10", lg: "h-16 sm:h-20" },
  icon: { sm: "h-8 w-8", md: "h-10 w-10", lg: "h-14 w-14" },
  mark: { sm: "h-10 w-10", md: "h-16 w-16", lg: "h-24 w-24" },
};

export const Logo = ({ variant = "full", size = "md", className = "" }: LogoProps) => {
  const src = variant === "full" ? fullLogo : variant === "icon" ? iconLogo : markLogo;
  const alt = variant === "full" ? "GLADYS Scan" : "GLADYS";
  const sizing = SIZE_MAP[variant][size];
  const square = variant !== "full";

  return (
    <img
      src={src}
      alt={alt}
      className={`${sizing} ${square ? "object-contain" : "w-auto object-contain"} select-none ${className}`}
      draggable={false}
    />
  );
};

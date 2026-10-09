import xyraLogo from "@/assets/xyra-logo.png";
import xyraLogoDark from "@/assets/xyra-logo-dark.png";
import xyraMark from "@/assets/xyra-mark.png";
import { cn } from "@/utils";

// Full wordmark; swaps to the light-on-dark variant in dark mode.
export function XyraLogo({ className }: { className?: string }) {
  return (
    <>
      <img src={xyraLogo} alt="Xyra" className={cn("h-8 w-auto object-contain dark:hidden", className)} />
      <img src={xyraLogoDark} alt="Xyra" className={cn("hidden h-8 w-auto object-contain dark:block", className)} />
    </>
  );
}

// Icon-only mark (collapsed sidebar, login).
export function XyraMark({ className }: { className?: string }) {
  return <img src={xyraMark} alt="Xyra" className={cn("h-8 w-auto object-contain", className)} />;
}

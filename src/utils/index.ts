import { type ClassValue, clsx } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

// index.css defines custom font sizes (text-theme-xs, text-title-sm, ...).
// Without registering them, tailwind-merge reads them as text colors and drops
// them whenever a real color like text-gray-500 follows.
const twMerge = extendTailwindMerge({
  extend: { theme: { text: ["theme-xs", "theme-sm", "theme-xl", "title-sm", "title-md", "title-lg", "title-xl", "title-2xl"] } },
});

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(...inputs));
}

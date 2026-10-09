import type { ReactNode } from "react";
import { cn } from "@/utils";

type Tab<K extends string> = { id: K; label: ReactNode };

// Tab bar only; the page renders the active panel itself.
export default function Tabs<K extends string>({
  tabs,
  selected,
  onChange,
}: {
  tabs: Tab<K>[];
  selected: K;
  onChange: (id: K) => void;
}) {
  return (
    <div className="flex gap-1 overflow-x-auto border-b border-gray-200 dark:border-gray-800">
      {tabs.map((t) => (
        <button
          key={t.id}
          type="button"
          onClick={() => onChange(t.id)}
          className={cn(
            "inline-flex shrink-0 items-center gap-2 border-b-2 px-3 py-2.5 text-sm font-medium transition",
            selected === t.id
              ? "border-brand-500 text-brand-500 dark:border-brand-400 dark:text-brand-400"
              : "border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200",
          )}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}
